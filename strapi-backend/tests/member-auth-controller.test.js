'use strict';
const { test, describe, beforeEach } = require('node:test');
const assert = require('node:assert');
const bcrypt = require('bcryptjs');

process.env.PUBLIC_AUTH_JWT_SECRET = 'test-secret-cho-unit-test';
process.env.PUBLIC_SITE_URL = 'https://vbsf.test';

const auth = require('../src/utils/public-auth');
const { createMockStrapi, createMockCtx } = require('./helpers/mock-strapi');
const controller = require('../src/api/member/controllers/member-auth');

const UID = 'api::member.member';
const KNOWN_HASH = bcrypt.hashSync('123456', 10);

function seed() {
  global.strapi = createMockStrapi({
    [UID]: [{
      documentId: 'm1', code: 'VBSF-2026-00098', name: 'Nguyễn Phúc Long',
      cccd: '079095001234', phone: '0901234567', password: KNOWN_HASH,
      province: 'TP.HCM', status: 'active', email: 'long@vbsf.vn',
    }],
  });
  return global.strapi;
}

const validBody = {
  name: 'Lê Đăng Ký', cccd: '012345678901', phone: '0977123456', password: 'matkhau123',
  province: 'Đà Nẵng', email: 'moi@vbsf.vn', dob: '1995-01-01', address: 'Số 5', club: 'CLB Mới',
};

describe('member-auth.register: kiểm tra đầu vào', () => {
  beforeEach(seed);

  const cases = [
    ['thiếu họ tên', { ...validBody, name: '' }, /đủ họ tên/],
    ['thiếu CCCD', { ...validBody, cccd: '' }, /đủ họ tên/],
    ['thiếu số điện thoại', { ...validBody, phone: '' }, /đủ họ tên/],
    ['thiếu mật khẩu', { ...validBody, password: '' }, /đủ họ tên/],
    ['CCCD có chữ', { ...validBody, cccd: 'abc123456' }, /CCCD không hợp lệ/],
    ['CCCD quá ngắn', { ...validBody, cccd: '1234' }, /CCCD không hợp lệ/],
    ['SĐT không bắt đầu bằng 0', { ...validBody, phone: '9771234567' }, /điện thoại không hợp lệ/],
    ['SĐT quá ngắn', { ...validBody, phone: '0912' }, /điện thoại không hợp lệ/],
    ['mật khẩu dưới 6 ký tự', { ...validBody, password: '12345' }, /ít nhất 6 ký tự/],
    ['tỉnh ngoài danh sách', { ...validBody, province: 'Không Có Tỉnh Này' }, /Tỉnh \/ thành không hợp lệ/],
  ];

  cases.forEach(([label, body, pattern]) => {
    test(label + ' → 400, không tạo hồ sơ', async () => {
      const ctx = createMockCtx({ body });
      await controller.register(ctx);
      assert.strictEqual(ctx._error.status, 400);
      assert.match(ctx._error.message, pattern);
      assert.strictEqual(global.strapi._tables[UID].length, 1, 'không được tạo bản ghi mới');
    });
  });

  test('SĐT có khoảng trắng vẫn hợp lệ sau khi chuẩn hoá', async () => {
    const ctx = createMockCtx({ body: { ...validBody, phone: '097 712 3456' } });
    await controller.register(ctx);
    assert.strictEqual(ctx._error, null);
    assert.strictEqual(global.strapi._tables[UID][1].phone, '0977123456');
  });
});

describe('member-auth.register: trùng hồ sơ', () => {
  beforeEach(seed);

  test('trùng số điện thoại → 409 với thông báo về SĐT', async () => {
    const ctx = createMockCtx({ body: { ...validBody, phone: '0901234567' } });
    await controller.register(ctx);
    assert.strictEqual(ctx._error.status, 409);
    assert.match(ctx._error.message, /điện thoại này đã được đăng ký/);
  });

  test('trùng CCCD → 409 với thông báo về CCCD', async () => {
    const ctx = createMockCtx({ body: { ...validBody, cccd: '079095001234' } });
    await controller.register(ctx);
    assert.strictEqual(ctx._error.status, 409);
    assert.match(ctx._error.message, /CCCD này đã được đăng ký/);
  });
});

describe('member-auth.register: tạo hồ sơ thành công', () => {
  beforeEach(seed);

  test('sinh mã kế tiếp, đặt trạng thái chờ, trả token + hồ sơ', async () => {
    const ctx = createMockCtx({ body: validBody });
    await controller.register(ctx);

    assert.strictEqual(ctx._error, null);
    assert.ok(ctx.body.token, 'phải trả token đăng nhập');
    assert.strictEqual(ctx.body.member.status, 'pending');
    assert.match(ctx.body.member.code, /^VBSF-\d{4}-\d{5}$/);
    assert.strictEqual(ctx.body.member.name, 'Lê Đăng Ký');
  });

  test('không trả mật khẩu ra ngoài', async () => {
    const ctx = createMockCtx({ body: validBody });
    await controller.register(ctx);
    assert.ok(!('password' in ctx.body.member));
  });

  test('token trả về dùng được cho /me', async () => {
    const ctx = createMockCtx({ body: validBody });
    await controller.register(ctx);
    const payload = auth.readToken(createMockCtx({ headers: { authorization: 'Bearer ' + ctx.body.token } }));
    assert.strictEqual(payload.kind, 'member');
  });

  test('các field tuỳ chọn để trống thì không lưu chuỗi rỗng', async () => {
    const ctx = createMockCtx({
      body: { name: 'Tối giản', cccd: '111222333444', phone: '0988777666', password: 'matkhau123' },
    });
    await controller.register(ctx);
    const row = global.strapi._tables[UID][1];
    assert.strictEqual(row.email, undefined);
    assert.strictEqual(row.club, undefined);
    assert.strictEqual(row.province, undefined);
  });
});

describe('member-auth.login', () => {
  beforeEach(seed);

  test('đúng thông tin → trả token và hồ sơ', async () => {
    const ctx = createMockCtx({ body: { phone: '0901234567', password: '123456' } });
    await controller.login(ctx);
    assert.strictEqual(ctx._error, null);
    assert.strictEqual(ctx.body.member.name, 'Nguyễn Phúc Long');
    assert.ok(ctx.body.token);
  });

  test('sai mật khẩu và số chưa đăng ký trả CÙNG một thông báo', async () => {
    const wrongPass = createMockCtx({ body: { phone: '0901234567', password: 'saibet' } });
    await controller.login(wrongPass);
    const noAccount = createMockCtx({ body: { phone: '0900000000', password: '123456' } });
    await controller.login(noAccount);

    assert.strictEqual(wrongPass._error.status, 401);
    assert.strictEqual(noAccount._error.status, 401);
    assert.strictEqual(wrongPass._error.message, noAccount._error.message);
  });

  test('thiếu trường → 400', async () => {
    const ctx = createMockCtx({ body: { phone: '0901234567' } });
    await controller.login(ctx);
    assert.strictEqual(ctx._error.status, 400);
  });

  test('không trả mật khẩu trong hồ sơ', async () => {
    const ctx = createMockCtx({ body: { phone: '0901234567', password: '123456' } });
    await controller.login(ctx);
    assert.ok(!('password' in ctx.body.member));
  });
});

describe('member-auth.me', () => {
  beforeEach(seed);

  test('token hợp lệ → trả hồ sơ của chính chủ', async () => {
    const token = auth.signToken({ kind: 'member', documentId: 'm1' });
    const ctx = createMockCtx({ headers: { authorization: 'Bearer ' + token } });
    await controller.me(ctx);
    assert.strictEqual(ctx.body.member.code, 'VBSF-2026-00098');
  });

  test('không có token → 401', async () => {
    const ctx = createMockCtx();
    await controller.me(ctx);
    assert.strictEqual(ctx._error.status, 401);
  });

  test('token của tổ chức không dùng được cho hội viên', async () => {
    const token = auth.signToken({ kind: 'org', documentId: 'm1' });
    const ctx = createMockCtx({ headers: { authorization: 'Bearer ' + token } });
    await controller.me(ctx);
    assert.strictEqual(ctx._error.status, 401);
  });

  test('hồ sơ đã bị xoá → 401 thay vì lỗi 500', async () => {
    const token = auth.signToken({ kind: 'member', documentId: 'khong-ton-tai' });
    const ctx = createMockCtx({ headers: { authorization: 'Bearer ' + token } });
    await controller.me(ctx);
    assert.strictEqual(ctx._error.status, 401);
  });
});

describe('member-auth.cccdStatus', () => {
  beforeEach(seed);

  test('CCCD đã có hồ sơ → found kèm trạng thái, KHÔNG kèm danh tính', async () => {
    const ctx = createMockCtx({ body: { cccd: '079095001234' } });
    await controller.cccdStatus(ctx);
    assert.deepStrictEqual(ctx.body, { found: true, status: 'active' });
    assert.ok(!('name' in ctx.body) && !('code' in ctx.body), 'không được lộ danh tính');
  });

  test('CCCD chưa có hồ sơ → found:false', async () => {
    const ctx = createMockCtx({ body: { cccd: '000000000000' } });
    await controller.cccdStatus(ctx);
    assert.deepStrictEqual(ctx.body, { found: false, status: null });
  });

  test('CCCD sai định dạng → 400', async () => {
    const ctx = createMockCtx({ body: { cccd: 'abc' } });
    await controller.cccdStatus(ctx);
    assert.strictEqual(ctx._error.status, 400);
  });
});

describe('member-auth.avatar', () => {
  beforeEach(seed);

  const png = { mimetype: 'image/png', size: 1024, originalFilename: 'a.png' };
  const bearer = () => ({ authorization: 'Bearer ' + auth.signToken({ kind: 'member', documentId: 'm1' }) });

  test('không có token → 401, không upload gì', async () => {
    const ctx = createMockCtx({ files: { file: png } });
    await controller.avatar(ctx);
    assert.strictEqual(ctx._error.status, 401);
    assert.strictEqual(global.strapi._uploads.length, 0);
  });

  test('không chọn tệp → 400', async () => {
    const ctx = createMockCtx({ headers: bearer(), files: {} });
    await controller.avatar(ctx);
    assert.match(ctx._error.message, /Chưa chọn ảnh/);
  });

  test('tệp không phải ảnh bị từ chối', async () => {
    const ctx = createMockCtx({ headers: bearer(), files: { file: { mimetype: 'application/pdf', size: 10 } } });
    await controller.avatar(ctx);
    assert.match(ctx._error.message, /phải là ảnh/);
    assert.strictEqual(global.strapi._uploads.length, 0);
  });

  test('ảnh quá 3 MB bị từ chối', async () => {
    const ctx = createMockCtx({ headers: bearer(), files: { file: { mimetype: 'image/png', size: 4 * 1024 * 1024 } } });
    await controller.avatar(ctx);
    assert.match(ctx._error.message, /3 MB/);
    assert.strictEqual(global.strapi._uploads.length, 0);
  });

  test('ảnh hợp lệ được gắn vào đúng hồ sơ của người đang đăng nhập', async () => {
    const ctx = createMockCtx({ headers: bearer(), files: { file: png } });
    await controller.avatar(ctx);
    assert.strictEqual(ctx._error, null);
    assert.strictEqual(global.strapi._tables[UID][0].avatar, 1);
    assert.ok(!('password' in ctx.body.member));
  });

  test('nhận cả field tên "files" (một số client gửi kiểu này)', async () => {
    const ctx = createMockCtx({ headers: bearer(), files: { files: [png] } });
    await controller.avatar(ctx);
    assert.strictEqual(ctx._error, null);
    assert.strictEqual(global.strapi._uploads.length, 1);
  });
});

describe('member-auth: quên & đặt lại mật khẩu', () => {
  beforeEach(seed);

  test('forgotPassword luôn trả thông báo trung tính', async () => {
    const has = createMockCtx({ body: { phone: '0901234567' } });
    await controller.forgotPassword(has);
    const hasNot = createMockCtx({ body: { phone: '0900000000' } });
    await controller.forgotPassword(hasNot);
    assert.strictEqual(has.body.message, hasNot.body.message);
    assert.strictEqual(has.body.ok, true);
  });

  test('resetPassword với mã sai → 400', async () => {
    const ctx = createMockCtx({ body: { token: 'sai', password: 'matkhaumoi' } });
    await controller.resetPassword(ctx);
    assert.strictEqual(ctx._error.status, 400);
  });

  test('resetPassword với mã đúng → đổi được mật khẩu', async () => {
    await controller.forgotPassword(createMockCtx({ body: { phone: '0901234567' } }));
    const token = global.strapi._emails[0].text.match(/reset=([a-f0-9]{64})/)[1];
    const ctx = createMockCtx({ body: { token, password: 'matkhaumoi' } });
    await controller.resetPassword(ctx);
    assert.strictEqual(ctx._error, null);
    assert.strictEqual(ctx.body.ok, true);
    assert.strictEqual(global.strapi._tables[UID][0].password, 'hashed:matkhaumoi');
  });
});
