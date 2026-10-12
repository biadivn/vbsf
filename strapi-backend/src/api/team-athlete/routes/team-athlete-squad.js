'use strict';
/* `auth: false` = không dùng JWT của CMS; danh tính đội lấy từ token site
   public và được kiểm trong controller. */
const { rateLimit, TEAM_AREA_LIMIT } = require('../../../utils/rate-limit');

const guard = { auth: false, middlewares: [rateLimit(TEAM_AREA_LIMIT)] };

module.exports = {
  routes: [
    { method: 'POST', path: '/team-athletes/mine', handler: 'team-athlete-squad.mine', config: guard },
    { method: 'POST', path: '/team-athletes/save', handler: 'team-athlete-squad.save', config: guard },
    { method: 'POST', path: '/team-athletes/save-bulk', handler: 'team-athlete-squad.saveBulk', config: guard },
    { method: 'POST', path: '/team-athletes/remove', handler: 'team-athlete-squad.remove', config: guard },
  ],
};
