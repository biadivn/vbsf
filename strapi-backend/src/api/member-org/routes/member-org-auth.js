'use strict';
/* Đăng nhập / đăng ký hội viên tổ chức cho SITE PUBLIC — xem ghi chú ở
   src/api/member/routes/member-auth.js. */
const { rateLimit, AUTH_LIMIT, PASSWORD_RESET_LIMIT } = require('../../../utils/rate-limit');

const authGuard = { auth: false, middlewares: [rateLimit(AUTH_LIMIT)] };
const resetGuard = { auth: false, middlewares: [rateLimit(PASSWORD_RESET_LIMIT)] };

module.exports = {
  routes: [
    { method: 'POST', path: '/org-auth/register', handler: 'member-org-auth.register', config: authGuard },
    { method: 'POST', path: '/org-auth/login', handler: 'member-org-auth.login', config: authGuard },
    { method: 'GET', path: '/org-auth/me', handler: 'member-org-auth.me', config: authGuard },
    { method: 'POST', path: '/org-auth/forgot-password', handler: 'member-org-auth.forgotPassword', config: resetGuard },
    { method: 'POST', path: '/org-auth/reset-password', handler: 'member-org-auth.resetPassword', config: resetGuard },
  ],
};
