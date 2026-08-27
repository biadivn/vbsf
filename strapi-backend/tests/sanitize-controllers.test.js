'use strict';
/* Hai controller này là hàng rào riêng tư của site public: /api/members và
   /api/member-orgs được đọc ẩn danh, nên CCCD/SĐT/email/mã số thuế không được
   lọt ra. Test chạy thẳng vào controller với createCoreController giả. */
const { test, describe, beforeEach } = require('node:test');
const assert = require('node:assert');

process.env.PUBLIC_AUTH_JWT_SECRET = 'test-secret-cho-unit-test';

const { createMockCtx, stubCoreControllerFactory } = require('./helpers/mock-strapi');

const MEMBER_ROW = {
  documentId: 'm1', code: 'VBSF-2026-00098', name: 'Nguyễn Phúc Long',
  cccd: '079095001234', phone: '0901234567', email: 'long@vbsf.vn',
  dob: '1995-01-01', address: 'Số 1, Quận 1', club: 'CLB Sài Gòn',
  province: 'TP.HCM', status: 'active',
};
const ORG_ROW = {
  documentId: 'o1', code: 'VBSF-TC-2019-001', name: 'CLB Sài Gòn',
  taxCode: '0101010101', phone: '0901112233', repPhone: '0901112233',
  repEmail: 'clb@vbsf.vn', repName: 'Nguyễn Văn Hòa', address: 'Quận 1', status: 'active',
};

/** Nạp lại controller với core giả trả về `rows` (mỗi test một bản sạch). */
function loadController(modulePath, rows) {
  stubCoreControllerFactory({
    async find() { return { data: rows.map((r) => ({ ...r })), meta: { pagination: { total: rows.length } } }; },
    async findOne() { return { data: { ...rows[0] } }; },
  });
  delete require.cache[require.resolve(modulePath)];
  return require(modulePath);
}

describe('member controller: lọc dữ liệu định danh', () => {
  let controller;
  beforeEach(() => { controller = loadController('../src/api/member/controllers/member', [MEMBER_ROW]); });

  const PRIVATE = ['cccd', 'phone', 'email', 'dob', 'address'];

  test('find ẩn danh: bỏ hết field định danh, giữ dữ liệu công khai', async () => {
    const res = await controller.find(createMockCtx());
    const row = res.data[0];
    PRIVATE.forEach((f) => assert.ok(!(f in row), 'còn lộ ' + f));
    assert.strictEqual(row.name, 'Nguyễn Phúc Long');
    assert.strictEqual(row.club, 'CLB Sài Gòn');
    assert.strictEqual(row.code, 'VBSF-2026-00098');
  });

  test('findOne ẩn danh: cũng bị lọc', async () => {
    const res = await controller.findOne(createMockCtx());
    PRIVATE.forEach((f) => assert.ok(!(f in res.data), 'còn lộ ' + f));
  });

  test('đã đăng nhập (CMS): giữ nguyên đủ dữ liệu', async () => {
    const ctx = createMockCtx({ state: { user: { id: 1 } } });
    const res = await controller.find(ctx);
    assert.strictEqual(res.data[0].cccd, '079095001234');
    assert.strictEqual(res.data[0].phone, '0901234567');
  });

  test('findOne đã đăng nhập: giữ nguyên', async () => {
    const res = await controller.findOne(createMockCtx({ state: { user: { id: 1 } } }));
    assert.strictEqual(res.data.cccd, '079095001234');
  });

  test('lọc từng phần tử của cả trang, không chỉ phần tử đầu', async () => {
    controller = loadController('../src/api/member/controllers/member', [
      MEMBER_ROW, { ...MEMBER_ROW, documentId: 'm2', name: 'Trần Quốc Bảo' },
    ]);
    const res = await controller.find(createMockCtx());
    res.data.forEach((row) => PRIVATE.forEach((f) => assert.ok(!(f in row), 'còn lộ ' + f)));
  });

  test('meta phân trang được giữ nguyên', async () => {
    const res = await controller.find(createMockCtx());
    assert.strictEqual(res.meta.pagination.total, 1);
  });
});

describe('member-org controller: lọc liên hệ và mã số thuế', () => {
  let controller;
  beforeEach(() => { controller = loadController('../src/api/member-org/controllers/member-org', [ORG_ROW]); });

  const PRIVATE = ['taxCode', 'phone', 'repPhone', 'repEmail'];

  test('find ẩn danh: bỏ mã số thuế và mọi số/điện thoại liên hệ', async () => {
    const res = await controller.find(createMockCtx());
    PRIVATE.forEach((f) => assert.ok(!(f in res.data[0]), 'còn lộ ' + f));
    assert.strictEqual(res.data[0].repName, 'Nguyễn Văn Hòa');
    assert.strictEqual(res.data[0].address, 'Quận 1');
  });

  test('findOne ẩn danh: cũng bị lọc', async () => {
    const res = await controller.findOne(createMockCtx());
    PRIVATE.forEach((f) => assert.ok(!(f in res.data), 'còn lộ ' + f));
  });

  test('đã đăng nhập: giữ nguyên đủ dữ liệu', async () => {
    const res = await controller.find(createMockCtx({ state: { user: { id: 1 } } }));
    assert.strictEqual(res.data[0].taxCode, '0101010101');
    assert.strictEqual(res.data[0].repEmail, 'clb@vbsf.vn');
  });

  test('findOne đã đăng nhập: giữ nguyên', async () => {
    const res = await controller.findOne(createMockCtx({ state: { user: { id: 1 } } }));
    assert.strictEqual(res.data.repPhone, '0901112233');
  });
});
