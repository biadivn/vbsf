'use strict';
/* Nhận đơn đăng ký thi đấu từ SITE PUBLIC.

   Không mở `create` của core controller cho khách: làm vậy là cho phép tự đặt
   `status: 'official'` và nhảy thẳng vào danh sách thi đấu chính thức. Hai
   endpoint dưới đây chỉ nhận đúng field được phép và luôn ghi status 'pending'
   — việc đưa vào danh sách chính thức là của vận hành Liên đoàn (mục 2.2). */

const auth = require('../../../utils/public-auth');
const entryLogic = require('../../../utils/tournament-entry');
const { text } = require('../../../utils/public-forms');

const TOURNAMENT_UID = 'api::tournament.tournament';
const ENTRY_UID = 'api::tournament-entry.tournament-entry';
const TEAM_REG_UID = 'api::team-registration.team-registration';
const SQUAD_UID = 'api::team-athlete.team-athlete';
const ORG_UID = 'api::member-org.member-org';
const MEMBER_UID = 'api::member.member';

async function loadTournament(documentId) {
  if (!documentId) return null;
  return strapi.documents(TOURNAMENT_UID).findOne({ documentId, populate: ['events'] });
}

/** Chủ thể gửi đơn, suy từ token của site public (không phải JWT của CMS). */
async function readActor(ctx) {
  const payload = auth.readToken(ctx);
  if (!payload || !payload.documentId) return { kind: null };
  if (payload.kind === 'org') {
    const org = await strapi.documents(ORG_UID).findOne({ documentId: payload.documentId });
    return org ? { kind: 'org', org } : { kind: null };
  }
  if (payload.kind === 'member') {
    const member = await strapi.documents(MEMBER_UID).findOne({ documentId: payload.documentId });
    return member ? { kind: 'member', member } : { kind: null };
  }
  return { kind: null };
}

/* Gắn mã hội viên + tình trạng hiệu lực theo CCCD ngay lúc nhận đơn, để vận
   hành mở ra là thấy ai đủ điều kiện mà không phải tra tay từng người. Đây là
   ảnh chụp tại thời điểm nộp; bước duyệt sẽ soi lại lần nữa. */
async function withMemberMatch(rows) {
  const codes = rows.map((r) => r.cccd).filter(Boolean);
  if (!codes.length) return rows.map((r) => ({ ...r, memberCode: '', memberValid: false }));
  const members = await strapi.documents(MEMBER_UID).findMany({
    filters: { cccd: { $in: codes } },
    fields: ['code', 'cccd', 'status', 'expiry'],
    limit: 500,
  });
  return rows.map((r) => ({ ...r, ...entryLogic.matchMember(members, r.cccd) }));
}

/* ---------------- Đơn hiện có của chính đội, cho một giải ----------------
   Trang đăng ký cần biết ai trong danh sách đội ĐÃ được gửi đi rồi, nếu không
   đội chỉ thấy một rổ checkbox trống và dễ gửi lại người đã nộp, hoặc tệ hơn:
   gửi lại thiếu người — vì gửi lại là THAY danh sách chưa duyệt, không cộng dồn
   (xem submitTeam), nên ai không được tick lần này sẽ biến mất khỏi đơn.

   Collection tournament-entry cố ý không cho đọc công khai (chứa CCCD, điện
   thoại), nên đây là endpoint riêng: danh tính lấy từ token đội và kết quả luôn
   kẹp theo teamDocId của chính người gửi. */
async function mineTeam(ctx) {
  const actor = await readActor(ctx);
  if (actor.kind !== 'org') {
    return ctx.badRequest('Vui lòng đăng nhập bằng tài khoản hội viên tổ chức.');
  }
  const tournamentDocId = text((ctx.request.body || {}).tournamentDocId, 60);
  if (!tournamentDocId) return ctx.badRequest('Chưa chọn giải đấu.');

  const rows = await strapi.documents(ENTRY_UID).findMany({
    filters: { tournamentDocId, teamDocId: actor.org.documentId },
    fields: ['cccd', 'fullName', 'status', 'paid', 'events'],
    limit: 500,
  });

  /* Chỉ trả đúng thứ trang đăng ký cần để đánh dấu lại danh sách — không trả
     nguyên bản ghi (điện thoại, địa chỉ... không việc gì phải đi ra ngoài). */
  ctx.body = {
    entries: rows.map((r) => ({
      cccd: r.cccd || '',
      fullName: r.fullName || '',
      status: r.status || 'pending',
      paid: Boolean(r.paid),
      events: Array.isArray(r.events) ? r.events : [],
    })),
  };
}

/* ---------------- Đội tỉnh/thành gửi đơn cho giải thành tích cao ---------------- */
async function submitTeam(ctx) {
  const body = ctx.request.body || {};
  const actor = await readActor(ctx);
  const tournament = await loadTournament(text(body.tournamentDocId, 60));

  const allowed = entryLogic.canSubmit(tournament, actor);
  if (!allowed.ok) return ctx.badRequest(allowed.error);

  const team = actor.org;
  /* Mục 1.3: đơn của đoàn chỉ gồm VĐV ĐÃ ĐƯỢC XÁC NHẬN thuộc đội. Đội chọn
     người từ danh sách đội của mình; hồ sơ (tên, CCCD, ngày sinh...) lấy từ bản
     ghi đã duyệt chứ không lấy từ body, để đơn không khai khác hồ sơ đã xác nhận. */
  const squad = await strapi.documents(SQUAD_UID).findMany({
    filters: { teamDocId: team.documentId, status: { $ne: 'removed' } },
    limit: 500,
  });
  const built = entryLogic.pickSquadAthletes(squad, body.athletes, tournament);
  if (built.error) return ctx.badRequest(built.error);
  /* Gửi lại đơn cho cùng một giải = thay danh sách cũ, không cộng dồn. Đội sửa
     sót một dòng mà hoá ra giải có hai bản danh sách thì vận hành không biết
     bản nào đúng. Chỉ xoá những dòng CHƯA duyệt — người đã vào danh sách chính
     thức thì giữ, tránh đơn gửi lại xoá mất kết quả duyệt. */
  const existing = await strapi.documents(ENTRY_UID).findMany({
    filters: {
      tournamentDocId: tournament.documentId,
      teamDocId: team.documentId,
      status: { $ne: 'official' },
    },
    fields: ['documentId'],
    limit: 500,
  });
  for (const row of existing) {
    await strapi.documents(ENTRY_UID).delete({ documentId: row.documentId });
  }

  /* Người đã được duyệt vào danh sách chính thức thì bỏ qua: bản ghi của họ
     không bị xoá ở trên, ghi thêm một lượt nữa là danh sách có hai dòng cùng
     một người — một 'official', một 'pending' — và vận hành không biết dòng nào
     mới là thật. */
  const officials = await strapi.documents(ENTRY_UID).findMany({
    filters: {
      tournamentDocId: tournament.documentId,
      teamDocId: team.documentId,
      status: { $eq: 'official' },
    },
    fields: ['cccd'],
    limit: 500,
  });
  const alreadyOfficial = new Set(officials.map((r) => r.cccd).filter(Boolean));

  const rows = (await withMemberMatch(built.data)).filter((r) => !alreadyOfficial.has(r.cccd));
  const kept = built.data.length - rows.length;
  for (const row of rows) {
    await strapi.documents(ENTRY_UID).create({
      data: {
        ...row,
        tournamentDocId: tournament.documentId,
        tournamentName: tournament.name,
        teamDocId: team.documentId,
        teamName: team.name,
        source: 'team',
        paid: false,
        status: 'pending',
      },
      status: 'published',
    });
  }

  await strapi.documents(TEAM_REG_UID).create({
    data: {
      tournamentDocId: tournament.documentId,
      tournamentName: tournament.name,
      teamDocId: team.documentId,
      teamName: team.name,
      leaderName: text(body.leaderName, 120) || undefined,
      leaderTitle: text(body.leaderTitle, 160) || undefined,
      leaderPhone: text(body.leaderPhone, 20) || undefined,
      note: text(body.note, 2000) || undefined,
      status: 'pending',
    },
    status: 'published',
  });

  ctx.body = {
    ok: true,
    count: rows.length,
    keptOfficial: kept,
    message: `Đã gửi danh sách ${rows.length} vận động viên.` +
      (kept ? ` ${kept} người đã được duyệt vào danh sách chính thức nên giữ nguyên.` : '') +
      ' Liên đoàn sẽ duyệt từng người vào danh sách thi đấu chính thức.',
  };
}

/* ---------------- VĐV tự đăng ký giải phong trào ---------------- */
async function submitSelf(ctx) {
  const body = ctx.request.body || {};
  const actor = await readActor(ctx);
  const tournament = await loadTournament(text(body.tournamentDocId, 60));

  const allowed = entryLogic.canSubmit(tournament, actor);
  if (!allowed.ok) return ctx.badRequest(allowed.error);

  /* Hội viên đang đăng nhập thì lấy hồ sơ sẵn có làm gốc, người dùng chỉ bổ
     sung chỗ thiếu — đỡ gõ lại và tránh lệch với hồ sơ hội viên. */
  const me = actor.kind === 'member' ? actor.member : null;
  const built = entryLogic.normalizeAthlete({
    fullName: body.fullName || (me && me.name),
    dob: body.dob || (me && me.dob),
    gender: body.gender,
    cccd: body.cccd || (me && me.cccd),
    phone: body.phone || (me && me.phone),
    address: body.address || (me && me.address),
    events: body.events,
  }, tournament);
  if (built.error) return ctx.badRequest(built.error);

  const [row] = await withMemberMatch([built.data]);
  if (tournament.memberOnly && !row.memberValid) {
    return ctx.badRequest('Giải này chỉ dành cho hội viên còn hiệu lực. Vui lòng gia hạn hội viên trước khi đăng ký.');
  }

  const created = await strapi.documents(ENTRY_UID).create({
    data: {
      ...row,
      tournamentDocId: tournament.documentId,
      tournamentName: tournament.name,
      source: 'self',
      note: text(body.note, 2000) || undefined,
      transferImage: text(body.transferImage, 4_000_000) || undefined,
      paid: false,
      status: 'pending',
    },
    status: 'published',
  });

  ctx.body = {
    ok: true,
    id: created.documentId,
    message: 'Đã gửi đăng ký. Liên đoàn sẽ xác nhận trước khi bốc thăm.',
  };
}

module.exports = { mineTeam, submitTeam, submitSelf };
