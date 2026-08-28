'use strict';
/* Các route của site public đều để `auth: false` (gọi được không cần đăng nhập).
   Test này khoá lại bất biến: hễ route công khai thì BẮT BUỘC có middleware giới
   hạn tần suất — quên gắn một cái là mở toang cửa brute-force. */
const { test, describe } = require('node:test');
const assert = require('node:assert');

const { AUTH_LIMIT, PASSWORD_RESET_LIMIT } = require('../src/utils/rate-limit');
const { DEFAULTS } = require('../src/utils/features');
const { createMockCtx } = require('./helpers/mock-strapi');

/* Route đặt lại mật khẩu chỉ được đăng ký khi PASSWORD_RESET_ENABLED=true, nên
   nạp lại module với cờ đặt sẵn để test được cả hai trạng thái. */
function loadRoutes(passwordResetEnabled) {
  const saved = process.env.PASSWORD_RESET_ENABLED;
  if (passwordResetEnabled === undefined) delete process.env.PASSWORD_RESET_ENABLED;
  else process.env.PASSWORD_RESET_ENABLED = String(passwordResetEnabled);
  ['../src/utils/features', '../src/api/member/routes/member-auth', '../src/api/member-org/routes/member-org-auth']
    .forEach((m) => { delete require.cache[require.resolve(m)]; });
  const member = require('../src/api/member/routes/member-auth');
  const org = require('../src/api/member-org/routes/member-org-auth');
  if (saved === undefined) delete process.env.PASSWORD_RESET_ENABLED;
  else process.env.PASSWORD_RESET_ENABLED = saved;
  return { member, org, all: member.routes.concat(org.routes) };
}

const enabled = loadRoutes(true);
const memberRoutes = enabled.member;
const orgRoutes = enabled.org;
const allRoutes = enabled.all;

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

describe('cờ tắt tính năng đặt lại mật khẩu', () => {
  test('mặc định (không set biến môi trường) là TẮT — fail-closed', () => {
    assert.strictEqual(DEFAULTS.passwordReset, false);
    const off = loadRoutes(undefined);
    assert.strictEqual(off.all.filter((r) => /password$/.test(r.path)).length, 0);
  });

  test('tắt thì KHÔNG đăng ký route forgot/reset, các route khác giữ nguyên', () => {
    const off = loadRoutes(false);
    assert.deepStrictEqual(off.member.routes.map((r) => r.path), [
      '/member-auth/register', '/member-auth/login', '/member-auth/me',
      '/member-auth/cccd-status', '/member-auth/avatar',
    ]);
    assert.deepStrictEqual(off.org.routes.map((r) => r.path), [
      '/org-auth/register', '/org-auth/login', '/org-auth/me',
    ]);
  });

  test('giá trị ngoài "true" đều coi là tắt', () => {
    ['', 'false', '1', 'yes', 'TRUE '].forEach((v) => {
      assert.strictEqual(loadRoutes(v).all.filter((r) => /password$/.test(r.path)).length, 0, 'giá trị: ' + JSON.stringify(v));
    });
  });

  test('bật thì có đủ 4 route đặt lại mật khẩu', () => {
    assert.strictEqual(loadRoutes(true).all.filter((r) => /password$/.test(r.path)).length, 4);
  });

  test('cờ mặc định phía site khớp với backend', () => {
    const fs = require('node:fs');
    const path = require('node:path');
    const configFile = path.join(__dirname, '..', '..', 'site-js', 'config.js');
    if (!fs.existsSync(configFile)) return; // ngoài build context của Docker
    const src = fs.readFileSync(configFile, 'utf8');
    const match = src.match(/passwordReset:\s*(true|false)/);
    assert.ok(match, 'site-js/config.js phải khai báo cờ passwordReset');
    assert.strictEqual(match[1] === 'true', DEFAULTS.passwordReset,
      'cờ passwordReset ở site-js/config.js lệch với mặc định của backend');
  });
});

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
