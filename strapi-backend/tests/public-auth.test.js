'use strict';
const { test, describe } = require('node:test');
const assert = require('node:assert');
const bcrypt = require('bcryptjs');

process.env.PUBLIC_AUTH_JWT_SECRET = 'test-secret-cho-unit-test';
const auth = require('../src/utils/public-auth');
const { createMockStrapi, createMockCtx } = require('./helpers/mock-strapi');

describe('public-auth: token phiên', () => {
  test('ký rồi đọc lại được payload', () => {
    const token = auth.signToken({ kind: 'member', documentId: 'abc' });
    const ctx = createMockCtx({ headers: { authorization: 'Bearer ' + token } });
    const payload = auth.readToken(ctx);
    assert.strictEqual(payload.kind, 'member');
    assert.strictEqual(payload.documentId, 'abc');
  });

  test('không có header Authorization thì trả null', () => {
    assert.strictEqual(auth.readToken(createMockCtx()), null);
  });

  test('header không phải Bearer thì trả null', () => {
    assert.strictEqual(auth.readToken(createMockCtx({ headers: { authorization: 'Basic xyz' } })), null);
  });

  test('token bị sửa thì trả null chứ không ném lỗi', () => {
    const token = auth.signToken({ kind: 'member', documentId: 'abc' });
    const ctx = createMockCtx({ headers: { authorization: 'Bearer ' + token.slice(0, -3) + 'xxx' } });
    assert.strictEqual(auth.readToken(ctx), null);
  });

  test('token ký bằng secret khác thì bị từ chối', () => {
    const jwt = require('jsonwebtoken');
    const foreign = jwt.sign({ kind: 'member', documentId: 'abc' }, 'secret-khac');
    assert.strictEqual(auth.readToken(createMockCtx({ headers: { authorization: 'Bearer ' + foreign } })), null);
  });
});

describe('public-auth: lọc field trước khi trả ra ngoài', () => {
  const record = {
    documentId: 'd1', name: 'Nguyễn Phúc Long', code: 'VBSF-2026-00098',
    password: '$2a$10$hash', resetTokenHash: 'abc', resetTokenExpiry: '2026-01-01T00:00:00.000Z',
    cccd: '079095001234', phone: '0901234567', email: 'a@b.vn', dob: '1995-01-01', address: 'Số 1',
    club: 'CLB Sài Gòn', province: 'TP.HCM',
  };

  test('selfView bỏ mật khẩu và token nhưng giữ hồ sơ của chính chủ', () => {
    const view = auth.selfView(record);
    assert.ok(!('password' in view));
    assert.ok(!('resetTokenHash' in view));
    assert.ok(!('resetTokenExpiry' in view));
    assert.strictEqual(view.cccd, '079095001234');
    assert.strictEqual(view.phone, '0901234567');
  });

  test('publicView (hội viên) bỏ toàn bộ dữ liệu định danh', () => {
    const view = auth.publicView(record, 'member');
    auth.PRIVATE_MEMBER_FIELDS.concat(['password', 'resetTokenHash']).forEach((f) => {
      assert.ok(!(f in view), 'còn lộ field ' + f);
    });
    assert.strictEqual(view.name, 'Nguyễn Phúc Long');
    assert.strictEqual(view.club, 'CLB Sài Gòn');
  });

  test('publicView (tổ chức) bỏ mã số thuế và liên hệ', () => {
    const org = { name: 'CLB Sài Gòn', taxCode: '123', phone: '09', repPhone: '09', repEmail: 'x@y.vn', address: 'Q1' };
    const view = auth.publicView(org, 'org');
    auth.PRIVATE_ORG_FIELDS.forEach((f) => assert.ok(!(f in view), 'còn lộ field ' + f));
    assert.strictEqual(view.address, 'Q1');
  });

  test('bản ghi rỗng/null không làm hàm ném lỗi', () => {
    assert.strictEqual(auth.selfView(null), null);
    assert.strictEqual(auth.publicView(undefined, 'member'), undefined);
  });
});

describe('public-auth: mật khẩu', () => {
  test('so khớp đúng với hash bcrypt', async () => {
    const hash = bcrypt.hashSync('matkhau123', 10);
    assert.strictEqual(await auth.comparePassword('matkhau123', hash), true);
    assert.strictEqual(await auth.comparePassword('saibet', hash), false);
  });

  test('hồ sơ chưa có mật khẩu thì luôn false, không ném lỗi', async () => {
    assert.strictEqual(await auth.comparePassword('bất kỳ', null), false);
    assert.strictEqual(await auth.comparePassword('bất kỳ', ''), false);
  });
});

describe('public-auth: chuẩn hoá số điện thoại', () => {
  test('bỏ khoảng trắng, dấu chấm và gạch nối', () => {
    assert.strictEqual(auth.normalizePhone('090 123 4567'), '0901234567');
    assert.strictEqual(auth.normalizePhone('090-123.4567'), '0901234567');
  });

  test('null/undefined trả chuỗi rỗng', () => {
    assert.strictEqual(auth.normalizePhone(null), '');
    assert.strictEqual(auth.normalizePhone(undefined), '');
  });
});

describe('public-auth: token đặt lại mật khẩu', () => {
  test('token là chuỗi hex 64 ký tự và lưu bản băm chứ không lưu bản gốc', () => {
    const reset = auth.createResetToken();
    assert.match(reset.token, /^[a-f0-9]{64}$/);
    assert.strictEqual(reset.hash, auth.hashResetToken(reset.token));
    assert.notStrictEqual(reset.hash, reset.token);
  });

  test('hạn dùng nằm trong tương lai và đúng cửa sổ 30 phút', () => {
    const reset = auth.createResetToken();
    const ms = new Date(reset.expiry).getTime() - Date.now();
    assert.ok(ms > 0 && ms <= auth.RESET_TTL_MS, 'hạn dùng ngoài khoảng mong đợi: ' + ms);
  });

  test('mỗi lần sinh ra một token khác nhau', () => {
    assert.notStrictEqual(auth.createResetToken().token, auth.createResetToken().token);
  });
});

describe('public-auth: sinh mã hội viên kế tiếp', () => {
  test('lấy số lớn nhất đang có rồi +1, giữ nguyên độ dài', async () => {
    const strapi = createMockStrapi({
      'api::member.member': [{ code: 'VBSF-2026-00098' }, { code: 'VBSF-2026-00123' }, { code: 'VBSF-2025-00410' }],
    });
    const code = await auth.nextCode(strapi, 'api::member.member', 'VBSF-2026-', 5);
    assert.strictEqual(code, 'VBSF-2026-00124');
  });

  test('chưa có bản ghi nào thì bắt đầu từ 1', async () => {
    const strapi = createMockStrapi({ 'api::member.member': [] });
    assert.strictEqual(await auth.nextCode(strapi, 'api::member.member', 'VBSF-TC-2026-', 3), 'VBSF-TC-2026-001');
  });

  test('bỏ qua mã sai định dạng thay vì sinh ra NaN', async () => {
    const strapi = createMockStrapi({
      'api::member.member': [{ code: 'VBSF-2026-khong-phai-so' }, { code: null }, { code: 'VBSF-2026-00007' }],
    });
    assert.strictEqual(await auth.nextCode(strapi, 'api::member.member', 'VBSF-2026-', 5), 'VBSF-2026-00008');
  });
});

describe('public-auth: cấu hình secret', () => {
  test('thiếu cả PUBLIC_AUTH_JWT_SECRET lẫn JWT_SECRET thì báo lỗi rõ ràng', () => {
    const saved = { p: process.env.PUBLIC_AUTH_JWT_SECRET, j: process.env.JWT_SECRET };
    delete process.env.PUBLIC_AUTH_JWT_SECRET;
    delete process.env.JWT_SECRET;
    try {
      assert.throws(() => auth.signToken({ kind: 'member' }), /PUBLIC_AUTH_JWT_SECRET/);
    } finally {
      process.env.PUBLIC_AUTH_JWT_SECRET = saved.p;
      if (saved.j) process.env.JWT_SECRET = saved.j;
    }
  });
});
