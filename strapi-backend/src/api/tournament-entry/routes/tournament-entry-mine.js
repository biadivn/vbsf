'use strict';
/* Đội đọc lại đơn của CHÍNH MÌNH cho một giải — trang đăng ký dùng để đánh dấu
   ai đã nộp rồi.

   Tách khỏi tournament-entry-submit.js vì hạn mức khác hẳn: nhận đơn là 5 lần/
   phút (FORM_LIMIT, chống bơm đơn), còn đây là đọc, trang gọi mỗi lần đổi giải
   hoặc tải lại — dùng chung hạn mức với khu vực tài khoản đội. */
const { rateLimit, TEAM_AREA_LIMIT } = require('../../../utils/rate-limit');

module.exports = {
  routes: [
    {
      method: 'POST',
      path: '/tournament-entries/mine-team',
      handler: 'tournament-entry-submit.mineTeam',
      config: { auth: false, middlewares: [rateLimit(TEAM_AREA_LIMIT)] },
    },
  ],
};
