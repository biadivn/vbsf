'use strict';
/* Site public đọc /api/members ẩn danh để dựng bảng xếp hạng và danh sách hội
   viên. Bản ghi hội viên chứa CCCD, số điện thoại, email, ngày sinh, địa chỉ —
   không được trả cho người đọc ẩn danh. Request đã đăng nhập (CMS) vẫn nhận đủ. */
const { createCoreController } = require('@strapi/strapi').factories;
const { PRIVATE_MEMBER_FIELDS } = require('../../../utils/public-auth');

function strip(entry) {
  if (!entry) return entry;
  PRIVATE_MEMBER_FIELDS.forEach((f) => delete entry[f]);
  return entry;
}

module.exports = createCoreController('api::member.member', () => ({
  async find(ctx) {
    const res = await super.find(ctx);
    if (!ctx.state.user && Array.isArray(res.data)) res.data.forEach(strip);
    return res;
  },
  async findOne(ctx) {
    const res = await super.findOne(ctx);
    if (!ctx.state.user) strip(res.data);
    return res;
  },
}));
