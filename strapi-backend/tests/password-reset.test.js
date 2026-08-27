'use strict';
const { test, describe, beforeEach } = require('node:test');
const assert = require('node:assert');

process.env.PUBLIC_AUTH_JWT_SECRET = 'test-secret-cho-unit-test';
process.env.PUBLIC_SITE_URL = 'https://vbsf.test';

const auth = require('../src/utils/public-auth');
const reset = require('../src/utils/password-reset');
const { createMockStrapi } = require('./helpers/mock-strapi');

const UID = 'api::member.member';

function seedStrapi() {
  return createMockStrapi({
    [UID]: [
      { documentId: 'm1', name: 'Nguyễn Phúc Long', phone: '0901234567', email: 'long@vbsf.vn', password: 'hashed:123456' },
      { documentId: 'm2', name: 'Không có email', phone: '0909999999', email: null, password: 'hashed:123456' },
    ],
  });
}

describe('password-reset: link đặt lại', () => {
  test('dựng từ PUBLIC_SITE_URL, có token và hash trang hội viên', () => {
    const link = reset.resetLink('abc123');
    assert.strictEqual(link, 'https://vbsf.test/?reset=abc123#hoi-vien');
  });

  test('token được encode để ký tự đặc biệt không phá URL', () => {
    assert.ok(reset.resetLink('a b&c').includes('a%20b%26c'));
  });
});

describe('password-reset: bước 1 — yêu cầu', () => {
  let strapi;
  beforeEach(() => { strapi = seedStrapi(); });

  test('số có tài khoản: lưu bản băm + hạn dùng, gửi email', async () => {
    const res = await reset.requestReset(strapi, { uid: UID, phone: '0901234567', emailField: 'email' });
    assert.strictEqual(res.ok, true);
    assert.strictEqual(res.via, 'email');

    const row = strapi._tables[UID][0];
    assert.match(row.resetTokenHash, /^[a-f0-9]{64}$/);
    assert.ok(new Date(row.resetTokenExpiry).getTime() > Date.now());
    assert.strictEqual(strapi._emails.length, 1);
    assert.strictEqual(strapi._emails[0].to, 'long@vbsf.vn');
    assert.match(strapi._emails[0].text, /https:\/\/vbsf\.test\/\?reset=/);
  });

  test('email gửi đi KHÔNG chứa bản băm lưu trong CSDL', async () => {
    await reset.requestReset(strapi, { uid: UID, phone: '0901234567', emailField: 'email' });
    const hash = strapi._tables[UID][0].resetTokenHash;
    assert.ok(!strapi._emails[0].text.includes(hash));
  });

  test('số KHÔNG có tài khoản: vẫn ok, không gửi gì, không ghi gì', async () => {
    const res = await reset.requestReset(strapi, { uid: UID, phone: '0900000000', emailField: 'email' });
    assert.deepStrictEqual(res, { ok: true });
    assert.strictEqual(strapi._emails.length, 0);
    assert.ok(!strapi._tables[UID][0].resetTokenHash);
  });

  test('số điện thoại rỗng thì thoát sớm', async () => {
    assert.deepStrictEqual(await reset.requestReset(strapi, { uid: UID, phone: '', emailField: 'email' }), { ok: true });
    assert.strictEqual(strapi._emails.length, 0);
  });

  test('số nhập kèm khoảng trắng vẫn khớp hồ sơ', async () => {
    const res = await reset.requestReset(strapi, { uid: UID, phone: '090 123 4567', emailField: 'email' });
    assert.strictEqual(res.via, 'email');
  });

  test('hồ sơ chưa có email: vẫn tạo token, chuyển sang ghi log', async () => {
    const res = await reset.requestReset(strapi, { uid: UID, phone: '0909999999', emailField: 'email' });
    assert.strictEqual(res.via, 'log');
    assert.ok(strapi._tables[UID][1].resetTokenHash);
    assert.strictEqual(strapi._emails.length, 0);
  });

  test('email provider lỗi thì không ném ra ngoài, chỉ chuyển sang log', async () => {
    strapi.plugin = () => ({ service: () => ({ send() { throw new Error('SMTP sập'); } }) });
    const res = await reset.requestReset(strapi, { uid: UID, phone: '0901234567', emailField: 'email' });
    assert.strictEqual(res.via, 'log');
    assert.ok(strapi._tables[UID][0].resetTokenHash, 'token vẫn phải được lưu');
  });
});

describe('password-reset: bước 2 — đổi mật khẩu', () => {
  let strapi;
  let token;

  beforeEach(async () => {
    strapi = seedStrapi();
    await reset.requestReset(strapi, { uid: UID, phone: '0901234567', emailField: 'email' });
    // Lấy token gốc từ email đã gửi (CSDL chỉ có bản băm).
    token = strapi._emails[0].text.match(/reset=([a-f0-9]{64})/)[1];
  });

  test('token hợp lệ: đổi mật khẩu và xoá token', async () => {
    const res = await reset.performReset(strapi, { uid: UID, token, password: 'matkhaumoi' });
    assert.deepStrictEqual(res, { ok: true });
    const row = strapi._tables[UID][0];
    assert.strictEqual(row.password, 'hashed:matkhaumoi');
    assert.strictEqual(row.resetTokenHash, null);
    assert.strictEqual(row.resetTokenExpiry, null);
  });

  test('token chỉ dùng được một lần', async () => {
    await reset.performReset(strapi, { uid: UID, token, password: 'matkhaumoi' });
    const again = await reset.performReset(strapi, { uid: UID, token, password: 'lannua123' });
    assert.match(again.error, /không hợp lệ hoặc đã được sử dụng/);
    assert.strictEqual(strapi._tables[UID][0].password, 'hashed:matkhaumoi');
  });

  test('token không tồn tại bị từ chối', async () => {
    const res = await reset.performReset(strapi, { uid: UID, token: 'khongtontai', password: 'matkhaumoi' });
    assert.match(res.error, /không hợp lệ/);
  });

  test('thiếu token bị từ chối', async () => {
    assert.match((await reset.performReset(strapi, { uid: UID, token: '', password: 'matkhaumoi' })).error, /Thiếu mã/);
  });

  test('mật khẩu dưới 6 ký tự bị từ chối trước cả khi tra token', async () => {
    const res = await reset.performReset(strapi, { uid: UID, token, password: '123' });
    assert.match(res.error, /ít nhất 6 ký tự/);
    assert.ok(strapi._tables[UID][0].resetTokenHash, 'token không được xoá khi đổi thất bại');
  });

  test('token hết hạn bị từ chối', async () => {
    strapi._tables[UID][0].resetTokenExpiry = new Date(Date.now() - 1000).toISOString();
    const res = await reset.performReset(strapi, { uid: UID, token, password: 'matkhaumoi' });
    assert.match(res.error, /hết hạn/);
    assert.strictEqual(strapi._tables[UID][0].password, 'hashed:123456', 'mật khẩu cũ phải giữ nguyên');
  });

  test('hồ sơ có băm nhưng thiếu hạn dùng cũng bị từ chối', async () => {
    strapi._tables[UID][0].resetTokenExpiry = null;
    assert.match((await reset.performReset(strapi, { uid: UID, token, password: 'matkhaumoi' })).error, /hết hạn/);
  });

  test('băm lưu trong CSDL khớp đúng hàm băm công khai', () => {
    assert.strictEqual(strapi._tables[UID][0].resetTokenHash, auth.hashResetToken(token));
  });
});
