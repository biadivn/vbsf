'use strict';
/* Endpoint công khai cho form trên site: auth:false + giới hạn 5 lần/phút/IP.
   Quyền `create` của core controller KHÔNG mở cho khách ẩn danh. */
const { rateLimit, FORM_LIMIT } = require('../../../utils/rate-limit');

module.exports = {
  routes: [
    {
      method: 'POST',
      path: '/tournament-registrations/submit',
      handler: 'tournament-registration-submit.submit',
      config: { auth: false, middlewares: [rateLimit(FORM_LIMIT)] },
    },
  ],
};
