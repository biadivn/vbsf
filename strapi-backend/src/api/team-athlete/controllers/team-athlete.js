'use strict';
/* Core controller (CMS gọi qua JWT — xem CONTENT_MANAGE_UIDS trong src/index.js)
   với hai phần thêm:

   - `create`: vận hành thêm VĐV vào đội ngay trong CMS. Tên đội, mã hội viên và
     hiệu lực hội viên đều do máy chủ tự gắn từ `teamDocId`/`cccd` — không nhận
     từ request. Nếu nhận thì một bản ghi gõ tay có thể mang mã hội viên của
     người khác, hoặc tự nhận `memberValid: true`, và điều kiện "hội viên còn
     hiệu lực" của mục 2.1 mất hết ý nghĩa.
   - `importRoster`: nhập cả danh sách từ tệp cho một tổ chức (nhập hộ). Quy tắc
     nằm trong src/utils/org-roster.js, dùng chung với luồng tổ chức tự nhập
     trên site để hai bên không lệch nhau. */
const { createCoreController } = require('@strapi/strapi').factories;
const entryLogic = require('../../../utils/tournament-entry');
const roster = require('../../../utils/org-roster');

const UID = 'api::team-athlete.team-athlete';
const ORG_UID = 'api::member-org.member-org';
const MEMBER_UID = 'api::member.member';

/** Mã hội viên + hiệu lực khớp theo CCCD, soi lại ngay lúc ghi. */
async function matchByCccd(cccd) {
  if (!cccd) return { memberCode: '', memberValid: false };
  const members = await strapi.documents(MEMBER_UID).findMany({
    filters: { cccd: { $eq: cccd } },
    fields: ['code', 'cccd', 'status', 'expiry'],
    limit: 5,
  });
  return entryLogic.matchMember(members, cccd);
}

module.exports = createCoreController(UID, () => ({
  async create(ctx) {
    const incoming = (ctx.request.body && ctx.request.body.data) || {};

    const teamDocId = String(incoming.teamDocId || '').trim();
    if (!teamDocId) return ctx.badRequest('Chưa chọn hội viên tổ chức cho vận động viên.');
    const org = await strapi.documents(ORG_UID).findOne({ documentId: teamDocId });
    if (!org) return ctx.badRequest('Không tìm thấy hội viên tổ chức đã chọn.');

    const fullName = String(incoming.fullName || '').trim();
    const cccd = roster.cccdKey(incoming.cccd);
    if (!fullName || !cccd) return ctx.badRequest('Thiếu họ tên hoặc số căn cước của vận động viên.');

    const dup = await strapi.documents(UID).findMany({
      filters: { teamDocId, cccd: { $eq: cccd }, status: { $ne: 'removed' } },
      fields: ['documentId'],
      limit: 1,
    });
    if (dup.length) return ctx.badRequest('Vận động viên có số căn cước này đã có trong danh sách đội.');

    ctx.request.body.data = {
      ...incoming,
      fullName,
      cccd,
      teamDocId,
      teamName: org.name,
      ...(await matchByCccd(cccd)),
      // Thêm tay vẫn đi qua bước xác nhận như đội tự thêm, trừ khi vận hành
      // chủ động chọn trạng thái khác ngay trong form.
      status: incoming.status || 'pending',
    };
    return super.create(ctx);
  },

  /* Hiệu lực hội viên là thuộc tính của HỒ SƠ HỘI VIÊN, không phải thứ vận hành
     bật/tắt trên bản ghi VĐV: mỗi lần lưu, máy chủ soi lại theo CCCD và ghi đè
     memberCode/memberValid, bất kể request gửi lên gì. CMS cũng không còn ô
     bật/tắt — nó hiển thị theo hồ sơ hội viên hiện tại. */
  async update(ctx) {
    const incoming = (ctx.request.body && ctx.request.body.data) || {};

    const current = await strapi.documents(UID).findOne({ documentId: ctx.params.id });
    if (!current) return ctx.notFound('Không tìm thấy vận động viên.');

    const cccd = incoming.cccd !== undefined ? roster.cccdKey(incoming.cccd) : current.cccd;
    ctx.request.body.data = { ...incoming, ...(await matchByCccd(cccd)) };
    return super.update(ctx);
  },

  async importRoster(ctx) {
    const body = ctx.request.body || {};
    const teamDocId = String(body.teamDocId || '').trim();
    if (!teamDocId) return ctx.badRequest('Chưa chọn hội viên tổ chức để nhập danh sách.');

    const org = await strapi.documents(ORG_UID).findOne({ documentId: teamDocId });
    if (!org) return ctx.badRequest('Không tìm thấy hội viên tổ chức.');

    const out = await roster.applyRosterImport(strapi, { org, rows: body.athletes || [] });
    if (out.error) return ctx.badRequest(out.error);

    ctx.body = { ok: true, ...out.data };
  },
}));
