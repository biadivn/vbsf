'use strict';
/* Xem ghi chú ở src/api/member/controllers/member.js — với hội viên tổ chức thì
   dữ liệu cần giấu là mã số thuế và các số điện thoại/email liên hệ. */
const { createCoreController } = require('@strapi/strapi').factories;
const { PRIVATE_ORG_FIELDS } = require('../../../utils/public-auth');

function strip(entry) {
  if (!entry) return entry;
  PRIVATE_ORG_FIELDS.forEach((f) => delete entry[f]);
  return entry;
}

module.exports = createCoreController('api::member-org.member-org', () => ({
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
