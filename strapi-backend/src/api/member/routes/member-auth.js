'use strict';
/* Đăng nhập / đăng ký hội viên cá nhân cho SITE PUBLIC.

   Không dùng plugin users-permissions: hội viên là bản ghi `api::member.member`
   (có hồ sơ, điểm xếp hạng...), không phải tài khoản quản trị CMS. Ba route này
   để `auth: false` nên gọi được từ site tĩnh; việc xác thực do controller
   `member-auth` tự làm bằng bcrypt + JWT riêng. */
module.exports = {
  routes: [
    { method: 'POST', path: '/member-auth/register', handler: 'member-auth.register', config: { auth: false } },
    { method: 'POST', path: '/member-auth/login', handler: 'member-auth.login', config: { auth: false } },
    { method: 'GET', path: '/member-auth/me', handler: 'member-auth.me', config: { auth: false } },
    { method: 'POST', path: '/member-auth/cccd-status', handler: 'member-auth.cccdStatus', config: { auth: false } },
  ],
};
