'use strict';
const { test, describe, beforeEach } = require('node:test');
const assert = require('node:assert');
const bcrypt = require('bcryptjs');

process.env.PUBLIC_AUTH_JWT_SECRET = 'test-secret-cho-unit-test';
process.env.PUBLIC_SITE_URL = 'https://vbsf.test';

const auth = require('../src/utils/public-auth');
const { createMockStrapi, createMockCtx } = require('./helpers/mock-strapi');
const controller = require('../src/api/member-org/controllers/member-org-auth');

const UID = 'api::member-org.member-org';

function seed() {
  global.strapi = createMockStrapi({
    [UID]: [{
      documentId: 'o1', code: 'VBSF-TC-2019-001', name: 'CLB Sài Gòn',
      phone: '0901112233', password: bcrypt.hashSync('123456', 10),
      orgType: 'Câu lạc bộ', repName: 'Nguyễn Văn Hòa', repEmail: 'clb@vbsf.vn',
      address: 'Quận 1, TP.HCM', status: 'active',
    }],
  });
  return global.strapi;
}

const validBody = {
  name: 'CLB Mới', orgType: 'Doanh nghiệp', repName: 'Trần Đại Diện', repTitle: 'Giám đốc',
  phone: '0966123456', password: 'matkhau123', address: 'Số 2, Quận 3', province: 'TP.HCM',
  repEmail: 'moi@vbsf.vn', taxCode: '0101010101',
};

describe('org-auth.register: kiểm tra đầu vào', () => {
  beforeEach(seed);

  const cases = [
    ['thiếu tên tổ chức', { ...validBody, name: '' }, /đủ tên tổ chức/],
    ['thiếu người đại diện', { ...validBody, repName: '' }, /đủ tên tổ chức/],
    ['thiếu địa chỉ', { ...validBody, address: '' }, /đủ tên tổ chức/],
    ['thiếu số điện thoại', { ...validBody, phone: '' }, /đủ tên tổ chức/],
    ['thiếu mật khẩu', { ...validBody, password: '' }, /đủ tên tổ chức/],
    ['SĐT sai định dạng', { ...validBody, phone: '123' }, /điện thoại không hợp lệ/],
    ['mật khẩu quá ngắn', { ...validBody, password: 'abc' }, /ít nhất 6 ký tự/],
    ['loại hình ngoài danh sách', { ...validBody, orgType: 'Kiểu lạ' }, /Loại hình tổ chức không hợp lệ/],
    ['tỉnh ngoài danh sách', { ...validBody, province: 'Tỉnh Lạ' }, /Tỉnh \/ thành không hợp lệ/],
  ];

  cases.forEach(([label, body, pattern]) => {
    test(label + ' → 400', async () => {
      const ctx = createMockCtx({ body });
      await controller.register(ctx);
      assert.strictEqual(ctx._error.status, 400);
      assert.match(ctx._error.message, pattern);
      assert.strictEqual(global.strapi._tables[UID].length, 1);
    });
  });

  test('trùng số điện thoại → 409', async () => {
    const ctx = createMockCtx({ body: { ...validBody, phone: '0901112233' } });
    await controller.register(ctx);
    assert.strictEqual(ctx._error.status, 409);
  });
});

describe('org-auth.register: tạo hồ sơ thành công', () => {
  beforeEach(seed);

  test('sinh mã tổ chức, trạng thái chờ duyệt, có ngày gia nhập', async () => {
    const ctx = createMockCtx({ body: validBody });
    await controller.register(ctx);
    assert.strictEqual(ctx._error, null);
    assert.match(ctx.body.org.code, /^VBSF-TC-\d{4}-\d{3}$/);
    assert.strictEqual(ctx.body.org.status, 'pending');
    assert.match(ctx.body.org.joinDate, /^\d{4}-\d{2}-\d{2}$/);
    assert.ok(ctx.body.token);
  });

  test('không khai repPhone thì lấy theo số điện thoại tổ chức', async () => {
    const ctx = createMockCtx({ body: { ...validBody, repPhone: undefined } });
    await controller.register(ctx);
    assert.strictEqual(global.strapi._tables[UID][1].repPhone, '0966123456');
  });

  test('không trả mật khẩu ra ngoài', async () => {
    const ctx = createMockCtx({ body: validBody });
    await controller.register(ctx);
    assert.ok(!('password' in ctx.body.org));
  });

  test('chỉ khai trường bắt buộc: các field tuỳ chọn không lưu chuỗi rỗng', async () => {
    const ctx = createMockCtx({
      body: { name: 'CLB Tối Giản', repName: 'Người Đại Diện', address: 'Số 1', phone: '0955000111', password: 'matkhau123' },
    });
    await controller.register(ctx);
    assert.strictEqual(ctx._error, null);
    const row = global.strapi._tables[UID][1];
    assert.strictEqual(row.orgType, undefined);
    assert.strictEqual(row.taxCode, undefined);
    assert.strictEqual(row.province, undefined);
    assert.strictEqual(row.repTitle, undefined);
    assert.strictEqual(row.repEmail, undefined);
  });

  test('SĐT ghi kèm khoảng trắng vẫn được chuẩn hoá', async () => {
    const ctx = createMockCtx({ body: { ...validBody, phone: '096 612 3456' } });
    await controller.register(ctx);
    assert.strictEqual(global.strapi._tables[UID][1].phone, '0966123456');
  });

  test('repPhone có khoảng trắng cũng được chuẩn hoá', async () => {
    const ctx = createMockCtx({ body: { ...validBody, repPhone: '098 765 4321' } });
    await controller.register(ctx);
    assert.strictEqual(global.strapi._tables[UID][1].repPhone, '0987654321');
  });

  test('body rỗng hoàn toàn → 400 chứ không phải lỗi 500', async () => {
    const ctx = createMockCtx({ body: undefined });
    await controller.register(ctx);
    assert.strictEqual(ctx._error.status, 400);
  });
});

describe('org-auth.login', () => {
  beforeEach(seed);

  test('đúng thông tin → trả token và hồ sơ', async () => {
    const ctx = createMockCtx({ body: { phone: '0901112233', password: '123456' } });
    await controller.login(ctx);
    assert.strictEqual(ctx.body.org.name, 'CLB Sài Gòn');
    assert.ok(ctx.body.token);
  });

  test('sai mật khẩu và số chưa đăng ký trả cùng thông báo', async () => {
    const a = createMockCtx({ body: { phone: '0901112233', password: 'sai' } });
    await controller.login(a);
    const b = createMockCtx({ body: { phone: '0900000000', password: '123456' } });
    await controller.login(b);
    assert.strictEqual(a._error.message, b._error.message);
    assert.strictEqual(a._error.status, 401);
  });

  test('thiếu trường → 400', async () => {
    const ctx = createMockCtx({ body: {} });
    await controller.login(ctx);
    assert.strictEqual(ctx._error.status, 400);
  });

  test('body rỗng hoàn toàn → 400', async () => {
    const ctx = createMockCtx({ body: undefined });
    await controller.login(ctx);
    assert.strictEqual(ctx._error.status, 400);
  });
});

describe('org-auth.me', () => {
  beforeEach(seed);

  test('token tổ chức hợp lệ → trả hồ sơ', async () => {
    const token = auth.signToken({ kind: 'org', documentId: 'o1' });
    const ctx = createMockCtx({ headers: { authorization: 'Bearer ' + token } });
    await controller.me(ctx);
    assert.strictEqual(ctx.body.org.code, 'VBSF-TC-2019-001');
  });

  test('token hội viên cá nhân không dùng được', async () => {
    const token = auth.signToken({ kind: 'member', documentId: 'o1' });
    const ctx = createMockCtx({ headers: { authorization: 'Bearer ' + token } });
    await controller.me(ctx);
    assert.strictEqual(ctx._error.status, 401);
  });

  test('không token → 401', async () => {
    const ctx = createMockCtx();
    await controller.me(ctx);
    assert.strictEqual(ctx._error.status, 401);
  });

  test('hồ sơ đã bị xoá → 401', async () => {
    const token = auth.signToken({ kind: 'org', documentId: 'khong-co' });
    const ctx = createMockCtx({ headers: { authorization: 'Bearer ' + token } });
    await controller.me(ctx);
    assert.strictEqual(ctx._error.status, 401);
  });
});

describe('org-auth: quên & đặt lại mật khẩu', () => {
  beforeEach(seed);

  test('gửi mã tới email người đại diện', async () => {
    const ctx = createMockCtx({ body: { phone: '0901112233' } });
    await controller.forgotPassword(ctx);
    assert.strictEqual(ctx.body.ok, true);
    assert.strictEqual(global.strapi._emails[0].to, 'clb@vbsf.vn');
  });

  test('số không tồn tại vẫn trả cùng thông báo', async () => {
    const a = createMockCtx({ body: { phone: '0901112233' } });
    await controller.forgotPassword(a);
    const b = createMockCtx({ body: { phone: '0900000000' } });
    await controller.forgotPassword(b);
    assert.strictEqual(a.body.message, b.body.message);
  });

  test('đặt lại mật khẩu bằng mã hợp lệ', async () => {
    await controller.forgotPassword(createMockCtx({ body: { phone: '0901112233' } }));
    const token = global.strapi._emails[0].text.match(/reset=([a-f0-9]{64})/)[1];
    const ctx = createMockCtx({ body: { token, password: 'matkhaumoi' } });
    await controller.resetPassword(ctx);
    assert.strictEqual(ctx.body.ok, true);
    assert.strictEqual(global.strapi._tables[UID][0].password, 'hashed:matkhaumoi');
  });

  test('mã sai → 400', async () => {
    const ctx = createMockCtx({ body: { token: 'sai', password: 'matkhaumoi' } });
    await controller.resetPassword(ctx);
    assert.strictEqual(ctx._error.status, 400);
  });

  test('gọi không kèm body → 400 chứ không phải lỗi 500', async () => {
    const forgot = createMockCtx({ body: undefined });
    await controller.forgotPassword(forgot);
    assert.strictEqual(forgot.body.ok, true);
    const reset = createMockCtx({ body: undefined });
    await controller.resetPassword(reset);
    assert.strictEqual(reset._error.status, 400);
  });
});
