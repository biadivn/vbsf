'use strict';
const { test, describe } = require('node:test');
const assert = require('node:assert');

const { rateLimit, AUTH_LIMIT, PASSWORD_RESET_LIMIT } = require('../src/utils/rate-limit');
const { createMockCtx } = require('./helpers/mock-strapi');

/** Gọi middleware n lần từ cùng một IP, trả về mảng status thu được. */
async function hit(middleware, times, ip) {
  const statuses = [];
  for (let i = 0; i < times; i++) {
    const ctx = createMockCtx({ ip: ip || '1.2.3.4' });
    let passed = false;
    await middleware(ctx, async () => { passed = true; });
    statuses.push(passed ? 200 : ctx.status);
  }
  return statuses;
}

describe('rate-limit: hạn mức theo IP', () => {
  test('cho qua đúng `max` request rồi chặn phần dư', async () => {
    const mw = rateLimit({ max: 3, windowMs: 1000 });
    assert.deepStrictEqual(await hit(mw, 5), [200, 200, 200, 429, 429]);
  });

  test('mỗi IP có bộ đếm riêng', async () => {
    const mw = rateLimit({ max: 2, windowMs: 1000 });
    assert.deepStrictEqual(await hit(mw, 3, '1.1.1.1'), [200, 200, 429]);
    // IP khác vẫn còn nguyên hạn mức
    assert.deepStrictEqual(await hit(mw, 2, '2.2.2.2'), [200, 200]);
  });

  test('hết cửa sổ thì được gọi lại', async (t) => {
    const mw = rateLimit({ max: 1, windowMs: 40 });
    assert.deepStrictEqual(await hit(mw, 2), [200, 429]);
    await new Promise((r) => setTimeout(r, 60));
    assert.deepStrictEqual(await hit(mw, 1), [200]);
  });

  test('request không có IP vẫn được đếm (gom vào khoá "unknown")', async () => {
    const mw = rateLimit({ max: 1, windowMs: 1000 });
    const ctx1 = createMockCtx({ ip: '' });
    const ctx2 = createMockCtx({ ip: '' });
    await mw(ctx1, async () => {});
    await mw(ctx2, async () => {});
    assert.strictEqual(ctx2.status, 429);
  });
});

describe('rate-limit: phản hồi khi bị chặn', () => {
  test('trả 429 kèm Retry-After và thông báo tuỳ biến', async () => {
    const mw = rateLimit({ max: 1, windowMs: 60000, message: 'Chậm lại nào.' });
    const ok = createMockCtx();
    await mw(ok, async () => {});
    const blocked = createMockCtx();
    await mw(blocked, async () => { throw new Error('không được gọi next khi đã quá hạn'); });

    assert.strictEqual(blocked.status, 429);
    assert.strictEqual(blocked.body.error.name, 'TooManyRequests');
    assert.strictEqual(blocked.body.error.message, 'Chậm lại nào.');
    const retry = Number(blocked.headers['Retry-After']);
    assert.ok(retry >= 1 && retry <= 60, 'Retry-After không hợp lý: ' + retry);
  });

  test('không truyền message thì dùng thông báo mặc định', async () => {
    const mw = rateLimit({ max: 0, windowMs: 1000 });
    const ctx = createMockCtx();
    await mw(ctx, async () => {});
    assert.match(ctx.body.error.message, /quá nhanh/i);
  });

  test('không gọi next() khi đã quá hạn', async () => {
    const mw = rateLimit({ max: 1, windowMs: 1000 });
    let calls = 0;
    const run = () => mw(createMockCtx(), async () => { calls++; });
    await run();
    await run();
    await run();
    assert.strictEqual(calls, 1);
  });
});

describe('rate-limit: hạn mức cấu hình sẵn cho site public', () => {
  test('nhóm đăng nhập/đăng ký là 10 request mỗi giây', () => {
    assert.deepStrictEqual({ max: AUTH_LIMIT.max, windowMs: AUTH_LIMIT.windowMs }, { max: 10, windowMs: 1000 });
  });

  test('nhóm quên mật khẩu là 5 request mỗi phút', () => {
    assert.strictEqual(PASSWORD_RESET_LIMIT.max, 5);
    assert.strictEqual(PASSWORD_RESET_LIMIT.windowMs, 60000);
    assert.match(PASSWORD_RESET_LIMIT.message, /đặt lại mật khẩu/i);
  });

  test('hạn mức 10 RPS thực sự chặn request thứ 11', async () => {
    const mw = rateLimit(AUTH_LIMIT);
    const statuses = await hit(mw, 12, '9.9.9.9');
    assert.deepStrictEqual(statuses.slice(0, 10), new Array(10).fill(200));
    assert.deepStrictEqual(statuses.slice(10), [429, 429]);
  });

  test('hạn mức 5 RPM thực sự chặn request thứ 6', async () => {
    const mw = rateLimit(PASSWORD_RESET_LIMIT);
    const statuses = await hit(mw, 7, '8.8.8.8');
    assert.deepStrictEqual(statuses, [200, 200, 200, 200, 200, 429, 429]);
  });
});

describe('rate-limit: dọn bộ nhớ', () => {
  test('IP hết hạn bị xoá khỏi bộ đếm thay vì tích tụ mãi', async () => {
    const mw = rateLimit({ max: 1, windowMs: 30 });
    for (let i = 0; i < 50; i++) await mw(createMockCtx({ ip: '10.0.0.' + i }), async () => {});
    await new Promise((r) => setTimeout(r, 50));
    // Sau khi hết cửa sổ, một IP cũ bất kỳ phải được cho qua lại từ đầu.
    const ctx = createMockCtx({ ip: '10.0.0.7' });
    let passed = false;
    await mw(ctx, async () => { passed = true; });
    assert.strictEqual(passed, true);
  });
});
