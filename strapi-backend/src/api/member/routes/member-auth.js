'use strict';
/* Đăng nhập / đăng ký hội viên cá nhân cho SITE PUBLIC.

   Không dùng plugin users-permissions: hội viên là bản ghi `api::member.member`
   (có hồ sơ, điểm xếp hạng...), không phải tài khoản quản trị CMS. Các route để
   `auth: false` nên gọi được từ site tĩnh; việc xác thực do controller
   `member-auth` tự làm bằng bcrypt + JWT riêng.

   Mọi route đều có giới hạn tần suất theo IP (src/utils/rate-limit.js): 10 req/s
   cho đăng nhập/đăng ký, 5 req/phút cho quên & đặt lại mật khẩu. */
const { rateLimit, AUTH_LIMIT, PASSWORD_RESET_LIMIT } = require('../../../utils/rate-limit');
const { passwordResetEnabled } = require('../../../utils/features');

const authGuard = { auth: false, middlewares: [rateLimit(AUTH_LIMIT)] };
const resetGuard = { auth: false, middlewares: [rateLimit(PASSWORD_RESET_LIMIT)] };

/* Route đặt lại mật khẩu chỉ tồn tại khi PASSWORD_RESET_ENABLED=true — chưa có
   máy chủ email thì không đăng ký, gọi vào sẽ 404 thay vì hứa suông với người
   dùng. Xem src/utils/features.js để biết cách bật lại. */
const passwordResetRoutes = [
  { method: 'POST', path: '/member-auth/forgot-password', handler: 'member-auth.forgotPassword', config: resetGuard },
  { method: 'POST', path: '/member-auth/reset-password', handler: 'member-auth.resetPassword', config: resetGuard },
];

module.exports = {
  routes: [
    { method: 'POST', path: '/member-auth/register', handler: 'member-auth.register', config: authGuard },
    { method: 'POST', path: '/member-auth/login', handler: 'member-auth.login', config: authGuard },
    { method: 'GET', path: '/member-auth/me', handler: 'member-auth.me', config: authGuard },
    { method: 'POST', path: '/member-auth/cccd-status', handler: 'member-auth.cccdStatus', config: authGuard },
    { method: 'POST', path: '/member-auth/avatar', handler: 'member-auth.avatar', config: authGuard },
  ].concat(passwordResetEnabled() ? passwordResetRoutes : []),
};
