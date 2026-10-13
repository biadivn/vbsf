'use strict';
/* Hội viên tổ chức tự quản danh sách VĐV của mình (mục 1.2), từ SITE PUBLIC.
   Mọi loại hình đều dùng được (đội tỉnh/thành, CLB, trường học...) — không kiểm
   orgType ở đâu cả.

   Danh tính lấy từ token site public (kind 'org'), không phải JWT của CMS. Mọi
   truy vấn đều kẹp theo teamDocId của chính người gửi: không có endpoint nào ở
   đây đọc hay sửa được danh sách của đội khác, kể cả khi đoán đúng documentId.

   Trạng thái 'confirmed' chỉ do vận hành Liên đoàn đặt trong CMS — đội thêm
   người thì luôn vào 'pending'. */

const auth = require('../../../utils/public-auth');
const entryLogic = require('../../../utils/tournament-entry');
const roster = require('../../../utils/org-roster');
const { text } = require('../../../utils/public-forms');

const UID = 'api::team-athlete.team-athlete';
const ORG_UID = 'api::member-org.member-org';
const MEMBER_UID = 'api::member.member';

/** Đội đang đăng nhập, hoặc null. */
async function readTeam(ctx) {
  const payload = auth.readToken(ctx);
  if (!payload || payload.kind !== 'org' || !payload.documentId) return null;
  return strapi.documents(ORG_UID).findOne({ documentId: payload.documentId });
}

/* Gắn mã hội viên + hiệu lực theo CCCD để đội thấy ngay ai đã là hội viên còn
   hiệu lực — điều kiện 2.1.1 của danh sách thi đấu chính thức. */
async function matchByCccd(cccd) {
  if (!cccd) return { memberCode: '', memberValid: false };
  const members = await strapi.documents(MEMBER_UID).findMany({
    filters: { cccd: { $eq: cccd } },
    fields: ['code', 'cccd', 'status', 'expiry'],
    limit: 5,
  });
  return entryLogic.matchMember(members, cccd);
}

async function listSquad(teamDocId) {
  return strapi.documents(UID).findMany({
    filters: { teamDocId, status: { $ne: 'removed' } },
    sort: ['fullName:asc'],
    limit: 500,
  });
}

async function mine(ctx) {
  const team = await readTeam(ctx);
  if (!team) return ctx.badRequest('Vui lòng đăng nhập bằng tài khoản hội viên tổ chức.');
  /* Hiệu lực hội viên soi lại theo hồ sơ hiện tại, không trả giá trị đã lưu —
     hồ sơ hết hạn hay vừa được duyệt hội phí thì đơn vị phải thấy ngay. */
  const athletes = await roster.withLiveMemberMatch(strapi, await listSquad(team.documentId));
  ctx.body = { team: { name: team.name, code: team.code }, athletes };
}

async function save(ctx) {
  const team = await readTeam(ctx);
  if (!team) return ctx.badRequest('Vui lòng đăng nhập bằng tài khoản hội viên tổ chức.');

  const body = ctx.request.body || {};
  const built = entryLogic.normalizeSquadAthlete(body);
  if (built.error) return ctx.badRequest(built.error);

  const documentId = text(body.documentId, 60);
  if (documentId) {
    const existing = await strapi.documents(UID).findOne({ documentId });
    const allowed = entryLogic.canEditSquadRow(existing, team.documentId);
    if (!allowed.ok) return ctx.badRequest(allowed.error);
    const match = await matchByCccd(built.data.cccd);
    const updated = await strapi.documents(UID).update({
      documentId,
      data: { ...built.data, ...match, status: 'pending' },
      status: 'published',
    });
    ctx.body = { ok: true, athlete: updated, message: 'Đã cập nhật. Liên đoàn sẽ xác nhận lại.' };
    return;
  }

  /* Cùng một CCCD trong cùng một đội thì coi là sửa hồ sơ cũ, không tạo bản ghi
     thứ hai — danh sách hai dòng trùng người là thứ vận hành không gỡ được. */
  const dup = (await strapi.documents(UID).findMany({
    filters: { teamDocId: team.documentId, cccd: { $eq: built.data.cccd }, status: { $ne: 'removed' } },
    fields: ['documentId', 'status'],
    limit: 1,
  }))[0];
  if (dup) {
    return ctx.badRequest('Vận động viên có số căn cước này đã có trong danh sách đội.');
  }

  const match = await matchByCccd(built.data.cccd);
  const created = await strapi.documents(UID).create({
    data: {
      ...built.data,
      ...match,
      teamDocId: team.documentId,
      teamName: team.name,
      status: 'pending',
    },
    status: 'published',
  });
  ctx.body = { ok: true, athlete: created, message: 'Đã thêm vào danh sách đội. Liên đoàn sẽ xác nhận.' };
}

/* Nhập cả danh sách từ tệp CSV. Bỏ qua người đã có trong đội thay vì dừng cả
   lượt nhập: đội thường nhập lại tệp đã bổ sung thêm vài dòng, chặn hết thì
   lần nào cũng phải tự lọc tay những người đã nhập.

   Dòng nào chưa có hồ sơ hội viên cá nhân thì được tạo luôn (trạng thái chờ hội
   phí) — xem src/utils/org-roster.js. Quy tắc nằm ở đó để CMS nhập hộ cũng ra
   đúng kết quả như đội tự nhập. */
async function saveBulk(ctx) {
  const team = await readTeam(ctx);
  if (!team) return ctx.badRequest('Vui lòng đăng nhập bằng tài khoản hội viên tổ chức.');

  const rows = ((ctx.request.body || {}).athletes) || [];
  const out = await roster.applyRosterImport(strapi, { org: team, rows });
  if (out.error) return ctx.badRequest(out.error);

  ctx.body = {
    ok: true,
    // `added`/`skipped` giữ lại cho giao diện cũ đang đọc hai số này.
    added: out.data.summary.added,
    skipped: out.data.summary.skipped,
    summary: out.data.summary,
    rows: out.data.rows,
    message: out.data.message,
  };
}

/* Bỏ khỏi đội = đánh dấu 'removed', không xoá hẳn: bản ghi còn được tham chiếu
   trong các đơn đăng ký giải đã gửi, xoá đi là mất dấu vết hồ sơ đã duyệt. */
async function remove(ctx) {
  const team = await readTeam(ctx);
  if (!team) return ctx.badRequest('Vui lòng đăng nhập bằng tài khoản hội viên tổ chức.');

  const documentId = text((ctx.request.body || {}).documentId, 60);
  const existing = documentId ? await strapi.documents(UID).findOne({ documentId }) : null;
  if (!existing || existing.teamDocId !== team.documentId) {
    return ctx.badRequest('Không tìm thấy vận động viên trong danh sách đội.');
  }
  await strapi.documents(UID).update({
    documentId, data: { status: 'removed' }, status: 'published',
  });
  ctx.body = { ok: true, message: 'Đã bỏ khỏi danh sách đội.' };
}

module.exports = { mine, save, saveBulk, remove };
