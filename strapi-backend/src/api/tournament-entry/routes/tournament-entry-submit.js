'use strict';
/* Hai endpoint công khai của luồng đăng ký thi đấu. `auth: false` ở đây nghĩa là
   không dùng JWT của CMS; danh tính người gửi lấy từ token site public và được
   kiểm trong controller (đội tỉnh/thành hay hội viên). */
const { rateLimit, FORM_LIMIT } = require('../../../utils/rate-limit');

const guard = { auth: false, middlewares: [rateLimit(FORM_LIMIT)] };

module.exports = {
  routes: [
    {
      method: 'POST',
      path: '/tournament-entries/submit-team',
      handler: 'tournament-entry-submit.submitTeam',
      config: guard,
    },
    {
      method: 'POST',
      path: '/tournament-entries/submit',
      handler: 'tournament-entry-submit.submitSelf',
      config: guard,
    },
  ],
};
