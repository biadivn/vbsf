'use strict';
/* Giới hạn tần suất cho các endpoint công khai của site (đăng ký, đăng nhập,
   quên mật khẩu). Cửa sổ trượt, đếm theo IP, lưu trong bộ nhớ tiến trình.

   LƯU Ý KHI CHẠY NHIỀU INSTANCE: bộ đếm là cục bộ của từng tiến trình, nên N
   instance sau load balancer sẽ cho phép tới N lần hạn mức. Muốn chính xác
   tuyệt đối thì thay Map bằng Redis — với quy mô hiện tại (1 container, xem
   docker-compose.yml) thì bộ đếm cục bộ là đủ.

   Dùng trực tiếp trong `config.middlewares` của route:
     middlewares: [rateLimit({ max: 10, windowMs: 1000 })]
*/

/** Dọn các IP đã hết hạn để Map không phình vô hạn. */
function sweep(hits, windowMs, now) {
  hits.forEach((stamps, key) => {
    const alive = stamps.filter((t) => now - t < windowMs);
    if (alive.length) hits.set(key, alive);
    else hits.delete(key);
  });
}

function rateLimit(options) {
  const max = options.max;
  const windowMs = options.windowMs;
  const message = options.message || 'Bạn thao tác quá nhanh. Vui lòng thử lại sau ít phút.';
  const hits = new Map();
  let lastSweep = 0;

  return async function rateLimitMiddleware(ctx, next) {
    const now = Date.now();
    // Quét dọn nhiều nhất 1 lần mỗi cửa sổ, tránh chạy trên từng request.
    if (now - lastSweep > windowMs) {
      sweep(hits, windowMs, now);
      lastSweep = now;
    }

    const key = ctx.request.ip || 'unknown';
    const stamps = (hits.get(key) || []).filter((t) => now - t < windowMs);

    if (stamps.length >= max) {
      const retryAfter = Math.ceil((windowMs - (now - stamps[0])) / 1000);
      ctx.set('Retry-After', String(Math.max(retryAfter, 1)));
      ctx.status = 429;
      ctx.body = { data: null, error: { status: 429, name: 'TooManyRequests', message, details: {} } };
      return;
    }

    stamps.push(now);
    hits.set(key, stamps);
    await next();
  };
}

/* Hạn mức dùng chung cho site public — khai báo một chỗ để 2 nhóm route
   (hội viên cá nhân / tổ chức) không lệch nhau. */
const AUTH_LIMIT = { max: 10, windowMs: 1000 }; // 10 request/giây/IP
const PASSWORD_RESET_LIMIT = {
  max: 5,
  windowMs: 60 * 1000, // 5 request/phút/IP
  message: 'Bạn đã yêu cầu đặt lại mật khẩu quá nhiều lần. Vui lòng thử lại sau một phút.',
};

/* Form công khai (liên hệ, đăng ký thi đấu, báo chuyển khoản): 5 lần/phút/IP —
   đủ cho người dùng thật gửi lại khi gõ sai, đủ chặt để không thành hộp thư rác. */
const FORM_LIMIT = {
  max: 5,
  windowMs: 60 * 1000,
  message: 'Bạn gửi quá nhiều lần. Vui lòng thử lại sau một phút.',
};

module.exports = { rateLimit, AUTH_LIMIT, PASSWORD_RESET_LIMIT, FORM_LIMIT };
