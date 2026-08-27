'use strict';
/* Đăng nhập / đăng ký hội viên tổ chức cho SITE PUBLIC — xem ghi chú ở
   src/api/member/routes/member-auth.js. */
module.exports = {
  routes: [
    { method: 'POST', path: '/org-auth/register', handler: 'member-org-auth.register', config: { auth: false } },
    { method: 'POST', path: '/org-auth/login', handler: 'member-org-auth.login', config: { auth: false } },
    { method: 'GET', path: '/org-auth/me', handler: 'member-org-auth.me', config: { auth: false } },
  ],
};
