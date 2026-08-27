'use strict';
/* site-js/member-auth.js là IIFE chạy trong trình duyệt: nạp bằng vm với một
   `window`/`location`/`localStorage`/`fetch` giả, rồi test qua window.VBSF_AUTH.

   File nằm ngoài build context của Docker (chỉ có thư mục strapi-backend), nên
   khi không tìm thấy thì bỏ qua thay vì làm hỏng build image. */
const { test, describe, beforeEach, afterEach } = require('node:test');
const assert = require('node:assert');
const fs = require('node:fs');
const path = require('node:path');

const SOURCE = path.join(__dirname, '..', '..', 'site-js', 'member-auth.js');
const available = fs.existsSync(SOURCE);

/* Module là IIFE viết cho trình duyệt: đặt sẵn các global mà nó cần rồi
   require() (không dùng vm — coverage của Node không tính được mã chạy trong
   vm, mà đây là file nằm trong ngưỡng 80%). */
function loadModule(responder) {
  const calls = [];
  const store = new Map();

  global.location = { protocol: 'http:', hostname: 'localhost' };
  global.localStorage = {
    getItem: (k) => (store.has(k) ? store.get(k) : null),
    setItem: (k, v) => store.set(k, String(v)),
    removeItem: (k) => store.delete(k),
  };
  global.FormData = class FormData {
    constructor() { this.entries = []; }
    append(k, v) { this.entries.push([k, v]); }
  };
  global.fetch = async (url, options) => {
    calls.push({ url, options: options || {} });
    return responder(url, options || {});
  };
  global.window = {};

  delete require.cache[require.resolve(SOURCE)];
  const auth = require(SOURCE);
  return { auth, calls, store };
}

function cleanupGlobals() {
  ['location', 'localStorage', 'FormData', 'fetch', 'window'].forEach((k) => { delete global[k]; });
}

/** Trả về response giả kiểu fetch. */
function reply(status, body) {
  return { ok: status >= 200 && status < 300, status, json: async () => body };
}

const MEMBER = {
  documentId: 'm1', code: 'VBSF-2026-00098', name: 'Nguyễn Phúc Long',
  phone: '0901234567', cccd: '079095001234', club: 'CLB Sài Gòn', province: 'TP.HCM',
  status: 'active', expiry: '2026-12-31',
  avatar: { url: '/uploads/a.png' },
  disciplines: [
    { category: 'Snooker', points: 2075, rank: 1, matches: 10, trend: 'eq', trendValue: 0 },
    { category: 'Pool 9 bi', points: 2485, rank: 1, matches: 45, trend: 'up', trendValue: 1 },
  ],
};
const ORG = {
  documentId: 'o1', code: 'VBSF-TC-2019-001', name: 'CLB Sài Gòn', orgType: 'Câu lạc bộ',
  phone: '0901112233', repName: 'Nguyễn Văn Hòa', joinDate: '2019-01-01',
  status: 'active', expiry: '2026-12-31',
};

describe('site-js/member-auth', { skip: available ? false : 'không có site-js/ trong build context' }, () => {
  afterEach(cleanupGlobals);

  describe('đăng nhập hội viên', () => {
    let ctx;
    beforeEach(() => {
      ctx = loadModule(() => reply(200, { token: 'tok-123', member: MEMBER }));
    });

    test('gọi đúng endpoint với phương thức và body JSON', async () => {
      await ctx.auth.loginMember('0901234567', '123456');
      const call = ctx.calls[0];
      assert.strictEqual(call.url, 'http://localhost:1337/api/member-auth/login');
      assert.strictEqual(call.options.method, 'POST');
      assert.deepStrictEqual(JSON.parse(call.options.body), { phone: '0901234567', password: '123456' });
    });

    test('lưu token vào localStorage để giữ phiên', async () => {
      await ctx.auth.loginMember('0901234567', '123456');
      assert.strictEqual(ctx.store.get('vbsf_member_token'), 'tok-123');
    });

    test('làm phẳng hồ sơ theo bộ môn điểm cao nhất', async () => {
      const m = await ctx.auth.loginMember('0901234567', '123456');
      assert.strictEqual(m.points, 2485);
      assert.strictEqual(m.rank, 1);
      assert.strictEqual(m.matches, 45);
      assert.strictEqual(m.trend, 'up');
    });

    test('đổi ngày ISO sang dd/mm/yyyy và dựng URL ảnh tuyệt đối', async () => {
      const m = await ctx.auth.loginMember('0901234567', '123456');
      assert.strictEqual(m.expiry, '31/12/2026');
      assert.strictEqual(m.avatar, 'http://localhost:1337/uploads/a.png');
    });
  });

  describe('lỗi đăng nhập', () => {
    test('ném đúng thông báo mà backend trả về', async () => {
      const ctx = loadModule(() => reply(401, { error: { message: 'Số điện thoại hoặc mật khẩu không đúng.' } }));
      await assert.rejects(() => ctx.auth.loginMember('09', 'x'), /không đúng/);
      assert.ok(!ctx.store.has('vbsf_member_token'), 'không được lưu token khi đăng nhập hỏng');
    });

    test('lỗi không kèm message thì dùng thông báo mặc định', async () => {
      const ctx = loadModule(() => reply(500, {}));
      await assert.rejects(() => ctx.auth.loginMember('09', 'x'), /Có lỗi xảy ra/);
    });

    test('mất mạng thì báo không kết nối được máy chủ', async () => {
      const ctx = loadModule(() => { throw new Error('network down'); });
      await assert.rejects(() => ctx.auth.loginMember('09', 'x'), /Không kết nối được máy chủ/);
    });
  });

  describe('khôi phục phiên', () => {
    test('không có token thì trả null, không gọi API', async () => {
      const ctx = loadModule(() => reply(200, { member: MEMBER }));
      assert.strictEqual(await ctx.auth.restoreMember(), null);
      assert.strictEqual(ctx.calls.length, 0);
    });

    test('token còn hiệu lực thì trả hồ sơ và gửi Bearer', async () => {
      const ctx = loadModule(() => reply(200, { member: MEMBER }));
      ctx.store.set('vbsf_member_token', 'tok-123');
      const m = await ctx.auth.restoreMember();
      assert.strictEqual(m.code, 'VBSF-2026-00098');
      assert.strictEqual(ctx.calls[0].options.headers.Authorization, 'Bearer tok-123');
    });

    test('token hỏng thì xoá khỏi localStorage và trả null', async () => {
      const ctx = loadModule(() => reply(401, { error: { message: 'Phiên đăng nhập không hợp lệ.' } }));
      ctx.store.set('vbsf_member_token', 'tok-cu');
      assert.strictEqual(await ctx.auth.restoreMember(), null);
      assert.ok(!ctx.store.has('vbsf_member_token'));
    });

    test('khôi phục phiên tổ chức hoạt động tương tự', async () => {
      const ctx = loadModule(() => reply(200, { org: ORG }));
      ctx.store.set('vbsf_org_token', 'tok-org');
      const o = await ctx.auth.restoreOrg();
      assert.strictEqual(o.joinYear, '2019');
      assert.strictEqual(o.expiry, '31/12/2026');
    });

    test('token tổ chức hỏng cũng được dọn', async () => {
      const ctx = loadModule(() => reply(401, {}));
      ctx.store.set('vbsf_org_token', 'tok-cu');
      assert.strictEqual(await ctx.auth.restoreOrg(), null);
      assert.ok(!ctx.store.has('vbsf_org_token'));
    });

    test('chưa đăng nhập tổ chức thì trả null, không gọi API', async () => {
      const ctx = loadModule(() => reply(200, { org: ORG }));
      assert.strictEqual(await ctx.auth.restoreOrg(), null);
      assert.strictEqual(ctx.calls.length, 0);
    });
  });

  describe('đăng ký', () => {
    test('hội viên: gửi nguyên payload và lưu token', async () => {
      const ctx = loadModule(() => reply(200, { token: 'tok-new', member: MEMBER }));
      await ctx.auth.registerMember({ name: 'A', cccd: '1', phone: '09', password: 'x' });
      assert.match(ctx.calls[0].url, /member-auth\/register$/);
      assert.strictEqual(JSON.parse(ctx.calls[0].options.body).name, 'A');
      assert.strictEqual(ctx.store.get('vbsf_member_token'), 'tok-new');
    });

    test('tổ chức: gọi endpoint org-auth và lưu token riêng', async () => {
      const ctx = loadModule(() => reply(200, { token: 'tok-org', org: ORG }));
      const o = await ctx.auth.registerOrg({ name: 'CLB' });
      assert.match(ctx.calls[0].url, /org-auth\/register$/);
      assert.strictEqual(ctx.store.get('vbsf_org_token'), 'tok-org');
      assert.strictEqual(o.name, 'CLB Sài Gòn');
    });

    test('đăng nhập tổ chức lưu token vào khoá riêng của tổ chức', async () => {
      const ctx = loadModule(() => reply(200, { token: 'tok-org2', org: ORG }));
      await ctx.auth.loginOrg('0901112233', '123456');
      assert.strictEqual(ctx.store.get('vbsf_org_token'), 'tok-org2');
      assert.ok(!ctx.store.has('vbsf_member_token'), 'không được lẫn sang phiên hội viên');
    });
  });

  describe('đăng xuất', () => {
    test('xoá đúng token của từng loại tài khoản', async () => {
      const ctx = loadModule(() => reply(200, {}));
      ctx.store.set('vbsf_member_token', 'a');
      ctx.store.set('vbsf_org_token', 'b');
      ctx.auth.logoutMember();
      assert.ok(!ctx.store.has('vbsf_member_token'));
      assert.strictEqual(ctx.store.get('vbsf_org_token'), 'b');
      ctx.auth.logoutOrg();
      assert.ok(!ctx.store.has('vbsf_org_token'));
    });
  });

  describe('quên & đặt lại mật khẩu', () => {
    test('chọn đúng endpoint theo loại tài khoản', async () => {
      const ctx = loadModule(() => reply(200, { ok: true, message: 'Đã gửi.' }));
      await ctx.auth.forgotPassword('member', '09');
      await ctx.auth.forgotPassword('org', '09');
      assert.match(ctx.calls[0].url, /member-auth\/forgot-password$/);
      assert.match(ctx.calls[1].url, /org-auth\/forgot-password$/);
    });

    test('trả nguyên thông báo của backend', async () => {
      const ctx = loadModule(() => reply(200, { ok: true, message: 'Nếu số này có tài khoản…' }));
      assert.strictEqual(await ctx.auth.forgotPassword('member', '09'), 'Nếu số này có tài khoản…');
    });

    test('đặt lại mật khẩu gửi kèm token và mật khẩu mới', async () => {
      const ctx = loadModule(() => reply(200, { ok: true, message: 'Xong.' }));
      await ctx.auth.resetPassword('member', 'tok', 'matkhaumoi');
      assert.deepStrictEqual(JSON.parse(ctx.calls[0].options.body), { token: 'tok', password: 'matkhaumoi' });
    });

    test('mã sai thì ném lỗi kèm thông báo backend', async () => {
      const ctx = loadModule(() => reply(400, { error: { message: 'Mã đặt lại không hợp lệ.' } }));
      await assert.rejects(() => ctx.auth.resetPassword('member', 'sai', 'matkhaumoi'), /không hợp lệ/);
    });
  });

  describe('tải ảnh đại diện', () => {
    test('chưa đăng nhập thì báo lỗi ngay, không gọi API', async () => {
      const ctx = loadModule(() => reply(200, {}));
      await assert.rejects(() => ctx.auth.uploadAvatar({ name: 'a.png' }), /cần đăng nhập/);
      assert.strictEqual(ctx.calls.length, 0);
    });

    test('gửi multipart kèm Bearer token', async () => {
      const ctx = loadModule(() => reply(200, { member: MEMBER }));
      ctx.store.set('vbsf_member_token', 'tok-123');
      const m = await ctx.auth.uploadAvatar({ name: 'a.png' });
      assert.strictEqual(ctx.calls[0].options.headers.Authorization, 'Bearer tok-123');
      assert.deepStrictEqual(ctx.calls[0].options.body.entries[0][0], 'file');
      assert.strictEqual(m.avatar, 'http://localhost:1337/uploads/a.png');
    });

    test('backend từ chối thì ném đúng thông báo', async () => {
      const ctx = loadModule(() => reply(400, { error: { message: 'Ảnh không được vượt quá 3 MB.' } }));
      ctx.store.set('vbsf_member_token', 'tok-123');
      await assert.rejects(() => ctx.auth.uploadAvatar({ name: 'a.png' }), /3 MB/);
    });

    test('mất mạng khi tải ảnh → báo không kết nối được máy chủ', async () => {
      const ctx = loadModule(() => { throw new Error('offline'); });
      ctx.store.set('vbsf_member_token', 'tok-123');
      await assert.rejects(() => ctx.auth.uploadAvatar({ name: 'a.png' }), /Không kết nối được máy chủ/);
    });

    test('backend lỗi không kèm message → thông báo mặc định', async () => {
      const ctx = loadModule(() => reply(500, {}));
      ctx.store.set('vbsf_member_token', 'tok-123');
      await assert.rejects(() => ctx.auth.uploadAvatar({ name: 'a.png' }), /Không tải được ảnh lên/);
    });
  });

  describe('hồ sơ thiếu trường tuỳ chọn', () => {
    test('hội viên chưa có bộ môn/ảnh/CLB: các field rỗng, không undefined', async () => {
      const bare = { documentId: 'm9', code: 'VBSF-2026-00999', name: 'Hồ sơ trống', phone: '0900000000', status: 'pending' };
      const ctx = loadModule(() => reply(200, { token: 't', member: bare }));
      const m = await ctx.auth.loginMember('09', 'x');
      assert.strictEqual(m.club, '');
      assert.strictEqual(m.province, '');
      assert.strictEqual(m.email, '');
      assert.strictEqual(m.category, '');
      assert.strictEqual(m.avatar, '');
      assert.strictEqual(m.expiry, '');
      assert.deepStrictEqual(m.disciplines, []);
      assert.strictEqual(m.rank, undefined);
    });

    test('ảnh có URL tuyệt đối thì giữ nguyên, không nối thêm host', async () => {
      const withAbs = { ...MEMBER, avatar: { url: 'https://cdn.vbsf.vn/a.png' } };
      const ctx = loadModule(() => reply(200, { token: 't', member: withAbs }));
      const m = await ctx.auth.loginMember('09', 'x');
      assert.strictEqual(m.avatar, 'https://cdn.vbsf.vn/a.png');
    });

    test('tổ chức thiếu trường tuỳ chọn: trả chuỗi rỗng', async () => {
      const bare = { documentId: 'o9', code: 'VBSF-TC-2026-009', name: 'Tổ chức trống', phone: '0900000001', status: 'pending' };
      const ctx = loadModule(() => reply(200, { token: 't', org: bare }));
      const o = await ctx.auth.loginOrg('09', 'x');
      assert.strictEqual(o.orgType, '');
      assert.strictEqual(o.address, '');
      assert.strictEqual(o.repEmail, '');
      assert.strictEqual(o.joinYear, '');
      assert.strictEqual(o.expiry, '');
    });

    test('hàm làm phẳng chịu được member/org null', async () => {
      const ctx = loadModule(() => reply(200, { token: 't', member: null }));
      assert.strictEqual(await ctx.auth.loginMember('09', 'x'), null);
      const ctx2 = loadModule(() => reply(200, { token: 't', org: null }));
      assert.strictEqual(await ctx2.auth.loginOrg('09', 'x'), null);
    });

    test('ngày không đúng định dạng ISO được trả nguyên văn', async () => {
      const odd = { ...MEMBER, expiry: 'chưa rõ' };
      const ctx = loadModule(() => reply(200, { token: 't', member: odd }));
      assert.strictEqual((await ctx.auth.loginMember('09', 'x')).expiry, 'chưa rõ');
    });
  });

  describe('tra trạng thái CCCD', () => {
    test('trả kết quả của backend', async () => {
      const ctx = loadModule(() => reply(200, { found: true, status: 'active' }));
      assert.deepStrictEqual(await ctx.auth.cccdStatus('079095001234'), { found: true, status: 'active' });
    });

    test('lỗi mạng không làm hỏng form — coi như chưa có hồ sơ', async () => {
      const ctx = loadModule(() => { throw new Error('offline'); });
      // Object dựng bên trong sandbox có prototype riêng nên so từng field.
      const res = await ctx.auth.cccdStatus('079095001234');
      assert.strictEqual(res.found, false);
      assert.strictEqual(res.status, null);
    });
  });

  describe('localStorage bị chặn (chế độ riêng tư)', () => {
    test('đọc/ghi token không làm sập luồng đăng nhập', async () => {
      const calls = [];
      global.location = { protocol: 'https:', hostname: 'vbsf.vn' };
      global.localStorage = {
        getItem() { throw new Error('bị chặn'); },
        setItem() { throw new Error('bị chặn'); },
        removeItem() { throw new Error('bị chặn'); },
      };
      global.FormData = class { append() {} };
      global.fetch = async (url) => { calls.push(url); return reply(200, { token: 't', member: MEMBER }); };
      global.window = {};
      delete require.cache[require.resolve(SOURCE)];
      const auth = require(SOURCE);

      const m = await auth.loginMember('09', 'x');
      assert.strictEqual(m.name, 'Nguyễn Phúc Long');
      assert.strictEqual(await auth.restoreMember(), null);
      // Trên domain thật thì gọi đường dẫn tương đối (nginx proxy chung domain).
      assert.strictEqual(calls[0], '/api/member-auth/login');
    });
  });
});
