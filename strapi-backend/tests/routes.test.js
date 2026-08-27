'use strict';
/* Các route của site public đều để `auth: false` (gọi được không cần đăng nhập).
   Test này khoá lại bất biến: hễ route công khai thì BẮT BUỘC có middleware giới
   hạn tần suất — quên gắn một cái là mở toang cửa brute-force. */
const { test, describe } = require('node:test');
const assert = require('node:assert');

const memberRoutes = require('../src/api/member/routes/member-auth');
const orgRoutes = require('../src/api/member-org/routes/member-org-auth');
const { AUTH_LIMIT, PASSWORD_RESET_LIMIT } = require('../src/utils/rate-limit');
const { createMockCtx } = require('./helpers/mock-strapi');

const allRoutes = memberRoutes.routes.concat(orgRoutes.routes);

/** Gọi middleware của route n lần, đếm số lần được cho qua. */
async function passesBefore429(route, times) {
  const mw = route.config.middlewares[0];
  let passed = 0;
  for (let i = 0; i < times; i++) {
    const ctx = createMockCtx({ ip: 'test-' + route.path });
    await mw(ctx, async () => { passed++; });
  }
  return passed;
}

describe('route công khai: bất biến bảo mật', () => {
  test('mọi route auth:false đều có middleware giới hạn tần suất', () => {
    allRoutes.forEach((r) => {
      assert.strictEqual(r.config.auth, false, r.path + ': phải khai báo auth rõ ràng');
      assert.ok(Array.isArray(r.config.middlewares), r.path + ': thiếu middlewares');
      assert.strictEqual(typeof r.config.middlewares[0], 'function', r.path + ': thiếu rate limit');
    });
  });

  test('không có route công khai nào dùng phương thức ngoài GET/POST', () => {
    allRoutes.forEach((r) => assert.ok(['GET', 'POST'].includes(r.method), r.path + ': ' + r.method));
  });

  test('handler trỏ đúng controller theo tên file', () => {
    memberRoutes.routes.forEach((r) => assert.match(r.handler, /^member-auth\./, r.path));
    orgRoutes.routes.forEach((r) => assert.match(r.handler, /^member-org-auth\./, r.path));
  });

  test('đường dẫn không trùng nhau', () => {
    const keys = allRoutes.map((r) => r.method + ' ' + r.path);
    assert.strictEqual(new Set(keys).size, keys.length);
  });
});

describe('route công khai: đúng hạn mức theo nhóm', () => {
  const isResetRoute = (r) => /password$/.test(r.path);

  test('route quên/đặt lại mật khẩu dùng hạn mức 5 request/phút', async () => {
    const routes = allRoutes.filter(isResetRoute);
    assert.strictEqual(routes.length, 4, 'phải có 4 route (2 cho hội viên, 2 cho tổ chức)');
    for (const r of routes) {
      assert.strictEqual(await passesBefore429(r, PASSWORD_RESET_LIMIT.max + 3), PASSWORD_RESET_LIMIT.max, r.path);
    }
  });

  test('route đăng nhập/đăng ký dùng hạn mức 10 request/giây', async () => {
    const routes = allRoutes.filter((r) => !isResetRoute(r));
    assert.ok(routes.length >= 6);
    for (const r of routes) {
      assert.strictEqual(await passesBefore429(r, AUTH_LIMIT.max + 2), AUTH_LIMIT.max, r.path);
    }
  });

  test('các route trong cùng một file chia sẻ một bộ đếm', () => {
    const middlewares = new Set(memberRoutes.routes.filter((r) => !/password$/.test(r.path))
      .map((r) => r.config.middlewares[0]));
    assert.strictEqual(middlewares.size, 1, 'mỗi route mà một bộ đếm riêng thì hạn mức bị nhân lên');
  });
});
