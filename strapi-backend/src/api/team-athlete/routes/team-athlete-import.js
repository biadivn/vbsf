'use strict';
/* Nhập danh sách VĐV vào MỘT tổ chức bất kỳ — dành cho vận hành Liên đoàn làm
   trong CMS (nhập hộ tổ chức gửi danh sách qua email/giấy).

   Khác hẳn các route trong team-athlete-squad.js: ở đó `auth: false` vì danh
   tính lấy từ token site của chính tổ chức và chỉ sửa được danh sách của mình.
   Route này chọn được tổ chức qua `teamDocId`, nên BẮT BUỘC đi qua JWT của CMS
   (không đặt `auth: false`) — quyền tương ứng được cấp cho role Authenticated
   trong src/index.js. */
const { rateLimit, TEAM_AREA_LIMIT } = require('../../../utils/rate-limit');

module.exports = {
  routes: [
    {
      method: 'POST',
      path: '/team-athletes/import',
      handler: 'team-athlete.importRoster',
      config: { middlewares: [rateLimit(TEAM_AREA_LIMIT)] },
    },
  ],
};
