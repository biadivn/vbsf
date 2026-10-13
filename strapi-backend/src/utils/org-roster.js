'use strict';
/* NHẬP DANH SÁCH VĐV CỦA MỘT TỔ CHỨC TỪ TỆP (mục 1.2)

   Một lượt nhập làm hai việc cho từng dòng:
     1. Thêm người đó vào danh sách VĐV của tổ chức (team-athlete, 'pending' —
        Liên đoàn vẫn xác nhận từng người như cũ).
     2. Khớp theo CCCD với HỘI VIÊN CÁ NHÂN đang có. Khớp được thì chỉ gắn mã
        hội viên; không khớp thì TẠO hồ sơ hội viên cá nhân mới, trạng thái
        'pending' (chờ hội phí) và `club` = tên tổ chức.

   Vì sao tạo hội viên ở đây thay vì để tổ chức nhập hai lần: điều kiện vào danh
   sách thi đấu chính thức (mục 2.1) là "hội viên còn hiệu lực", nên danh sách
   đội mà không có hồ sơ hội viên đi kèm thì đến bước duyệt là tắc. Trạng thái
   'pending' giữ nguyên quyền quyết định của Liên đoàn: hồ sơ có sẵn để đối
   chiếu, nhưng chưa có hiệu lực cho tới khi hội phí được ghi nhận.

   Hồ sơ tạo theo lối này KHÔNG có mật khẩu — người đó chưa đăng nhập site được
   cho tới khi Liên đoàn đặt mật khẩu trong CMS (hoặc tới khi bật được luồng
   quên mật khẩu). Cố ý: tổ chức nhập hộ thì không được đặt mật khẩu thay người
   khác.

   Quy tắc dừng: một dòng hỏng định dạng (thiếu họ tên / CCCD) thì HUỶ CẢ LƯỢT và
   báo đúng số dòng — người nhập sửa tệp rồi nhập lại. Còn các tình huống "không
   tạo được hội viên" (thiếu SĐT, SĐT đã thuộc người khác) thì KHÔNG huỷ lượt:
   vẫn thêm vào danh sách đội và báo lại lý do, vì danh sách đội là thứ tổ chức
   cần trước mắt. */

const entryLogic = require('./tournament-entry');
const { text, normalizePhone } = require('./public-forms');

const MEMBER_UID = 'api::member.member';
const TEAM_ATHLETE_UID = 'api::team-athlete.team-athlete';

const MAX_ROWS = 300;
/* Cùng quy tắc với luồng hội viên tự đăng ký (member-auth.register): nhập hộ
   không được phép tạo ra hồ sơ lỏng hơn hồ sơ người ta tự khai. */
const CCCD_RE = /^\d{9,12}$/;
const PHONE_RE = /^0\d{8,10}$/;

/** CCCD dạng so khớp: bỏ hết dấu cách/gạch, giữ chữ và số. */
function cccdKey(value) {
  return String(value == null ? '' : value).replace(/[^\dA-Za-z]/g, '');
}

/**
 * Dãy mã hội viên kế tiếp, tính MỘT LƯỢT cho cả tệp.
 * `nextCode` của public-auth chỉ sinh được một mã mỗi lần gọi và phải quét lại
 * cả bảng; nhập 300 dòng mà gọi 300 lần thì vừa chậm vừa dễ trùng mã.
 */
function memberCodeSeries(existingCodes, prefix, pad, count) {
  let max = 0;
  (Array.isArray(existingCodes) ? existingCodes : []).forEach((code) => {
    if (!code || String(code).indexOf(prefix) !== 0) return;
    const n = parseInt(String(code).slice(prefix.length), 10);
    if (Number.isFinite(n) && n > max) max = n;
  });
  const out = [];
  for (let i = 1; i <= count; i += 1) out.push(prefix + String(max + i).padStart(pad, '0'));
  return out;
}

/**
 * Xếp kế hoạch cho cả tệp — hàm thuần, không chạm CSDL.
 *
 * @param rows    các dòng thô (đã tách cột ở phía giao diện)
 * @param squad   team-athlete hiện có của tổ chức (đã bỏ 'removed')
 * @param members hội viên cá nhân hiện có — cần `code`, `cccd`, `phone`,
 *                `status`, `expiry`
 * @param now     mốc thời gian để tính hiệu lực hội viên (mặc định: hiện tại)
 * @returns `{ error }` nếu huỷ cả lượt, ngược lại `{ data: { items, summary } }`.
 *          Mỗi item: `{ line, athlete, action, reason, memberCode, memberValid }`
 *          với action ∈ 'skip' (không thêm) | 'link' (đã có hội viên) |
 *          'create' (tạo hội viên mới) | 'squad-only' (chỉ vào danh sách đội).
 */
function planRosterImport({ rows, squad, members, now } = {}) {
  const list = Array.isArray(rows) ? rows : [];
  if (!list.length) return { error: 'Danh sách vận động viên đang trống.' };
  if (list.length > MAX_ROWS) {
    return { error: `Mỗi lần chỉ nhập được tối đa ${MAX_ROWS} vận động viên.` };
  }

  const memberList = Array.isArray(members) ? members : [];
  const inSquad = new Set(
    (Array.isArray(squad) ? squad : []).map((r) => cccdKey(r && r.cccd)).filter(Boolean)
  );
  /* SĐT đã thuộc về một hội viên nào đó — field `phone` của member là unique,
     ghi trùng thì Strapi ném lỗi và cả lượt nhập đổ giữa đường. */
  const takenPhones = new Set(memberList.map((m) => normalizePhone(m && m.phone)).filter(Boolean));

  const items = [];
  const seen = new Set();
  for (let i = 0; i < list.length; i += 1) {
    const line = i + 1;
    const built = entryLogic.normalizeSquadAthlete(list[i]);
    if (built.error) return { error: `Dòng ${line}: ${built.error}` };

    const athlete = built.data;
    const key = cccdKey(athlete.cccd);

    if (seen.has(key)) {
      items.push({ line, athlete, action: 'skip', reason: 'trùng với một dòng phía trên trong tệp' });
      continue;
    }
    seen.add(key);

    if (inSquad.has(key)) {
      items.push({ line, athlete, action: 'skip', reason: 'đã có trong danh sách của tổ chức' });
      continue;
    }

    const match = entryLogic.matchMember(memberList, athlete.cccd, now);
    if (match.memberCode) {
      items.push({ line, athlete, action: 'link', ...match });
      continue;
    }

    /* Chưa có hồ sơ hội viên: chỉ tạo được khi dòng đủ dữ liệu định danh và SĐT
       chưa thuộc về ai. Thiếu thì vẫn vào danh sách đội, kèm lý do. */
    const phone = normalizePhone(athlete.phone);
    let reason = '';
    if (!CCCD_RE.test(key)) reason = 'số căn cước không đúng định dạng (9–12 chữ số)';
    else if (!phone) reason = 'thiếu số điện thoại';
    else if (!PHONE_RE.test(phone)) reason = 'số điện thoại không đúng định dạng';
    else if (takenPhones.has(phone)) reason = 'số điện thoại đã thuộc một hội viên khác';

    if (reason) {
      items.push({ line, athlete, action: 'squad-only', reason, memberCode: '', memberValid: false });
      continue;
    }

    takenPhones.add(phone);
    items.push({ line, athlete, action: 'create', memberCode: '', memberValid: false });
  }

  const count = (action) => items.filter((it) => it.action === action).length;
  const summary = {
    total: items.length,
    added: items.filter((it) => it.action !== 'skip').length,
    skipped: count('skip'),
    linked: count('link'),
    created: count('create'),
    squadOnly: count('squad-only'),
  };
  return { data: { items, summary } };
}

/**
 * Hồ sơ hội viên cá nhân dựng từ một dòng nhập.
 * `province` lấy theo tổ chức vì tệp không có cột tỉnh/thành; chỉ nhận giá trị
 * nằm trong enum của content-type, tránh ghi vào một giá trị Strapi sẽ chối.
 */
function buildMemberDraft(athlete, org, code, provinces) {
  const allowed = Array.isArray(provinces) ? provinces : [];
  const province = org && org.province && allowed.indexOf(org.province) >= 0 ? org.province : undefined;
  return {
    code,
    name: athlete.fullName,
    cccd: cccdKey(athlete.cccd),
    phone: normalizePhone(athlete.phone),
    dob: athlete.dob || undefined,
    address: athlete.address || undefined,
    club: text(org && org.name, 120) || undefined,
    province,
    // Hồ sơ mới luôn chờ Liên đoàn ghi nhận hội phí, giống luồng tự đăng ký.
    status: 'pending',
  };
}

/** Câu thông báo gọn cho giao diện — một chỗ duy nhất để site và CMS nói giống nhau. */
function summaryMessage(summary) {
  const s = summary || {};
  if (!s.added) {
    return s.skipped
      ? `Không thêm được ai: ${s.skipped} dòng đã có trong danh sách của tổ chức.`
      : 'Không thêm được vận động viên nào.';
  }
  const parts = [`Đã thêm ${s.added} vận động viên vào danh sách của tổ chức`];
  if (s.created) parts.push(`tạo mới ${s.created} hồ sơ hội viên cá nhân (chờ hội phí)`);
  if (s.linked) parts.push(`${s.linked} người đã là hội viên`);
  if (s.squadOnly) parts.push(`${s.squadOnly} người chưa tạo được hồ sơ hội viên`);
  if (s.skipped) parts.push(`bỏ qua ${s.skipped} dòng đã có sẵn`);
  return parts.join(', ') + '. Liên đoàn sẽ xác nhận từng người.';
}

/**
 * Chạy cả lượt nhập: đọc dữ liệu hiện có, xếp kế hoạch, rồi ghi.
 * Dùng chung cho SITE (tổ chức tự nhập) và CMS (vận hành nhập hộ) để hai bên
 * không bao giờ lệch quy tắc.
 *
 * Ghi lần lượt chứ không Promise.all: thứ tự mã hội viên phải khớp thứ tự dòng,
 * và 300 insert song song vào SQLite/Postgres không nhanh hơn đáng kể.
 */
async function applyRosterImport(strapi, { org, rows, now } = {}) {
  if (!org || !org.documentId) return { error: 'Không tìm thấy tổ chức.' };

  const squad = await strapi.documents(TEAM_ATHLETE_UID).findMany({
    filters: { teamDocId: org.documentId, status: { $ne: 'removed' } },
    fields: ['cccd'],
    limit: 500,
  });
  /* Đọc cả bảng hội viên một lần: vừa để khớp CCCD/SĐT, vừa để tính dãy mã kế
     tiếp — `nextCode` cũng quét cả bảng, nên đây không phải chi phí mới. */
  const members = await strapi.db.query(MEMBER_UID).findMany({
    select: ['code', 'cccd', 'phone', 'status', 'expiry'],
  });

  const planned = planRosterImport({ rows, squad, members, now });
  if (planned.error) return { error: planned.error };
  const { items, summary } = planned.data;

  const year = new Date(now || Date.now()).getFullYear();
  const codes = memberCodeSeries(members.map((m) => m.code), `VBSF-${year}-`, 5, summary.created);
  const provinces = (strapi.contentType(MEMBER_UID).attributes.province || {}).enum || [];

  let codeAt = 0;
  const results = [];
  for (const item of items) {
    if (item.action === 'skip') {
      results.push({ line: item.line, fullName: item.athlete.fullName, action: item.action, reason: item.reason });
      continue;
    }

    let memberCode = item.memberCode || '';
    let memberValid = Boolean(item.memberValid);
    let reason = item.reason || '';

    if (item.action === 'create') {
      const draft = buildMemberDraft(item.athlete, org, codes[codeAt], provinces);
      codeAt += 1;
      try {
        const created = await strapi.documents(MEMBER_UID).create({ data: draft });
        memberCode = created.code || draft.code;
        // 'pending' = chưa có hiệu lực; mục 2.1 vẫn chặn ở bước duyệt.
        memberValid = false;
      } catch (err) {
        /* Hồ sơ hội viên không tạo được (trùng unique, dữ liệu bị chối...) thì
           vẫn giữ người đó trong danh sách đội — mất danh sách vì một dòng lỗi
           là thiệt hại lớn hơn. */
        strapi.log.warn(`[org-roster] không tạo được hội viên dòng ${item.line}: ${err.message}`);
        memberCode = '';
        reason = 'không tạo được hồ sơ hội viên, vui lòng kiểm tra lại dòng này';
      }
    }

    await strapi.documents(TEAM_ATHLETE_UID).create({
      data: {
        ...item.athlete,
        memberCode,
        memberValid,
        teamDocId: org.documentId,
        teamName: org.name,
        status: 'pending',
        note: reason ? `Nhập từ tệp: ${reason}` : undefined,
      },
      status: 'published',
    });

    results.push({
      line: item.line,
      fullName: item.athlete.fullName,
      /* Dòng định tạo hội viên mà ghi trượt thì báo đúng thực tế là
         'squad-only' — giao diện không phải đoán nghĩa của một 'create' không
         có mã hội viên. */
      action: item.action === 'create' ? (memberCode ? 'created' : 'squad-only') : item.action,
      memberCode,
      reason,
    });
  }

  /* Đếm lại theo kết quả THỰC TẾ: một hồ sơ hội viên trượt lúc ghi thì không
     được tính là đã tạo, nếu không thông báo sẽ nói quá. */
  const createdOk = results.filter((r) => r.action === 'created').length;
  const finalSummary = {
    ...summary,
    created: createdOk,
    squadOnly: summary.squadOnly + (summary.created - createdOk),
  };
  return { data: { summary: finalSummary, rows: results, message: summaryMessage(finalSummary) } };
}

/**
 * Soi lại mã hội viên + hiệu lực cho một danh sách VĐV, theo hồ sơ hội viên
 * HIỆN TẠI. Chỉ để hiển thị — không ghi lại vào CSDL.
 *
 * Giá trị `memberValid` lưu trên bản ghi VĐV là ảnh chụp lúc thêm vào danh
 * sách; hồ sơ hội viên hết hạn hay vừa được duyệt hội phí sau đó thì ảnh chụp
 * sai. Đọc hội viên MỘT lần cho cả danh sách thay vì mỗi dòng một truy vấn.
 */
async function withLiveMemberMatch(strapi, rows, now) {
  const list = Array.isArray(rows) ? rows : [];
  if (!list.length) return [];

  const keys = [...new Set(list.map((r) => cccdKey(r && r.cccd)).filter(Boolean))];
  const members = keys.length
    ? await strapi.db.query(MEMBER_UID).findMany({
      where: { $or: keys.map((cccd) => ({ cccd })) },
      select: ['code', 'cccd', 'status', 'expiry'],
    })
    : [];

  return list.map((row) => {
    const match = entryLogic.matchMember(members, row && row.cccd, now);
    const member = match.memberCode
      ? members.find((m) => (m.code || '') === match.memberCode)
      : null;
    return { ...row, ...match, memberStatusLabel: memberStatusLabel(member, match.memberValid) };
  });
}

/* Câu trạng thái hội viên cho giao diện. "Hết hạn" và "chờ hội phí" là hai
   tình huống khác hẳn nhau — gộp thành "không còn hiệu lực" làm người dùng đi
   tìm nhầm chỗ (gia hạn thay vì nộp hội phí lần đầu). Chữ phải khớp với
   taMemberMatch bên CMS (cms-js/utils.js). */
function memberStatusLabel(member, valid) {
  if (!member) return '';
  const expiry = member.expiry ? formatDay(member.expiry) : '';
  if (valid) return expiry ? `Đang hiệu lực đến ${expiry}` : 'Đang hiệu lực';
  if (member.status === 'pending') return 'Chờ thanh toán hội phí';
  return expiry ? `Hết hạn ${expiry}` : 'Hết hạn';
}

/** yyyy-mm-dd (hoặc Date) -> dd/mm/yyyy. */
function formatDay(value) {
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return String(value);
  const p = (x) => String(x).padStart(2, '0');
  return `${p(d.getUTCDate())}/${p(d.getUTCMonth() + 1)}/${d.getUTCFullYear()}`;
}

module.exports = {
  MAX_ROWS,
  withLiveMemberMatch,
  memberStatusLabel,
  MEMBER_UID,
  TEAM_ATHLETE_UID,
  cccdKey,
  memberCodeSeries,
  planRosterImport,
  buildMemberDraft,
  summaryMessage,
  applyRosterImport,
};
