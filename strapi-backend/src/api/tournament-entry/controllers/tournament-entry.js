'use strict';
/* Chỉ CMS (JWT admin) gọi được collection này — xem CONTENT_MANAGE_UIDS trong
   src/index.js. Override `update` để chốt điều kiện vào danh sách thi đấu chính
   thức ở phía máy chủ: nút trên CMS là giao diện, còn quy định 2.1 (hội viên
   còn hiệu lực VÀ đã nộp lệ phí) phải được kiểm ở đây, nếu không thì chỉ cần
   một request PUT là bỏ qua được cả hai điều kiện. */
const { createCoreController } = require('@strapi/strapi').factories;
const entryLogic = require('../../../utils/tournament-entry');

const MEMBER_UID = 'api::member.member';
const UID = 'api::tournament-entry.tournament-entry';

module.exports = createCoreController(UID, () => ({
  async update(ctx) {
    const incoming = (ctx.request.body && ctx.request.body.data) || {};
    if (incoming.status !== 'official') return super.update(ctx);

    const entry = await strapi.documents(UID).findOne({ documentId: ctx.params.id });
    if (!entry) return ctx.notFound('Không tìm thấy bản ghi đăng ký.');

    const cccd = incoming.cccd !== undefined ? incoming.cccd : entry.cccd;
    const members = cccd
      ? await strapi.documents(MEMBER_UID).findMany({
        filters: { cccd: { $eq: cccd } },
        fields: ['code', 'cccd', 'status', 'expiry'],
        limit: 5,
      })
      : [];

    const confirmed = entryLogic.confirmOfficial(entry, incoming, members);
    if (!confirmed.ok) return ctx.badRequest(confirmed.error);

    /* Ghi lại mã hội viên + hiệu lực vừa soi được, để danh sách chính thức mang
       đúng trạng thái tại thời điểm duyệt chứ không phải lúc nộp đơn. */
    ctx.request.body.data = { ...incoming, ...confirmed.data };
    return super.update(ctx);
  },
}));
