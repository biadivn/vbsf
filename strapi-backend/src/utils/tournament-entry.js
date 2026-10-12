'use strict';
/* Logic thuần của luồng đăng ký thi đấu — tách khỏi controller để test được.
   Hai luồng, quyết định bởi `tournament.nature`:

   - national  (Giải thành tích cao Quốc gia): CHỈ tài khoản đội tỉnh/thành gửi
     được, kèm danh sách VĐV. VĐV không tự đăng ký.
   - grassroots (Giải phong trào): VĐV tự đăng ký. Giải có `memberOnly` thì phải
     là hội viên còn hiệu lực mới đăng ký được.

   Tiền để ở dạng chuỗi ("200.000đ") vì admin nhập tay và site hiển thị nguyên
   văn; cộng lệ phí nhiều nội dung thì phải bóc số ra rồi format lại. */

const { text, normalizePhone } = require('./public-forms');

/** "200.000đ" / "200,000 VND" / 200000 -> 200000. Không đọc được -> null. */
function parseFee(value) {
  if (value == null || value === '') return null;
  if (typeof value === 'number') return Number.isFinite(value) ? value : null;
  const digits = String(value).replace(/[^\d]/g, '');
  if (!digits) return null;
  return Number(digits);
}

/** 200000 -> "200.000đ" (dấu chấm ngăn nghìn, đúng cách viết đang dùng trên site). */
function formatFee(amount) {
  if (!Number.isFinite(amount)) return '';
  return String(Math.round(amount)).replace(/\B(?=(\d{3})+(?!\d))/g, '.') + 'đ';
}

/**
 * Tổng lệ phí của các nội dung đã chọn.
 * Nội dung nào không đọc được số tiền thì bỏ qua khi cộng — thà ra tổng thiếu
 * còn hơn chặn cả đơn đăng ký vì admin gõ "liên hệ" vào ô phí.
 */
function sumEventFees(events, selectedNames) {
  const list = Array.isArray(events) ? events : [];
  const picked = Array.isArray(selectedNames) ? selectedNames : [];
  let total = 0;
  let counted = 0;
  picked.forEach((name) => {
    const ev = list.find((e) => e && e.name === name);
    const fee = ev ? parseFee(ev.fee) : null;
    if (fee != null) { total += fee; counted += 1; }
  });
  return counted ? formatFee(total) : '';
}

/** Tên các nội dung hợp lệ của giải. Giải chưa khai nội dung nào -> mảng rỗng. */
function eventNames(tournament) {
  return (Array.isArray(tournament && tournament.events) ? tournament.events : [])
    .map((e) => e && e.name).filter(Boolean);
}

function toDay(value) {
  if (!value) return null;
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return null;
  // So sánh theo NGÀY: hạn đăng ký 31/12 thì hết 31/12 vẫn còn nộp được.
  return Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate());
}

/**
 * Cửa sổ đăng ký. Không khai ngày nào thì coi như luôn mở — giải cũ tạo trước
 * khi có hai field này vẫn đăng ký được bình thường.
 */
function registrationOpen(tournament, now) {
  const today = toDay(now || new Date());
  const open = toDay(tournament && tournament.regOpenDate);
  const close = toDay(tournament && (tournament.regCloseDate || tournament.regDeadline));
  if (open != null && today < open) return { ok: false, error: 'Giải chưa mở đăng ký.' };
  if (close != null && today > close) return { ok: false, error: 'Giải đã hết hạn đăng ký.' };
  return { ok: true };
}

/**
 * Ai được gửi đơn cho giải này.
 * @param tournament bản ghi giải
 * @param actor      { kind: 'org' | 'member' | null }
 */
function canSubmit(tournament, actor) {
  if (!tournament) return { ok: false, error: 'Không tìm thấy giải đấu.' };
  const kind = (actor && actor.kind) || null;
  const nature = tournament.nature || 'national';

  if (nature === 'national') {
    if (kind !== 'org') {
      return { ok: false, error: 'Giải thành tích cao chỉ nhận đăng ký qua tài khoản đội tỉnh/thành.' };
    }
  } else if (kind === 'org') {
    return { ok: false, error: 'Giải phong trào do vận động viên tự đăng ký, không đăng ký theo đoàn.' };
  } else if (tournament.memberOnly && kind !== 'member') {
    return { ok: false, error: 'Giải này chỉ dành cho hội viên — vui lòng đăng nhập bằng tài khoản hội viên.' };
  }

  return registrationOpen(tournament);
}

/**
 * Làm sạch một dòng VĐV do đội nhập/upload.
 * Chỉ Họ tên là bắt buộc ở bước gửi đơn: đội thường nhập nhanh rồi bổ sung sau,
 * còn điều kiện vào danh sách thi đấu chính thức thì vận hành kiểm ở bước duyệt.
 */
function normalizeAthlete(raw, tournament) {
  const row = raw || {};
  const fullName = text(row.fullName || row.name, 120);
  if (!fullName) return { error: 'Thiếu họ tên vận động viên.' };

  const allowed = eventNames(tournament);
  const picked = (Array.isArray(row.events) ? row.events : [])
    .map((e) => text(e, 120))
    .filter((e) => (allowed.length ? allowed.includes(e) : Boolean(e)));

  const gender = text(row.gender, 10);
  return {
    data: {
      fullName,
      dob: row.dob || undefined,
      gender: gender === 'Nam' || gender === 'Nữ' ? gender : undefined,
      cccd: text(row.cccd, 20).replace(/[^\dA-Za-z]/g, '') || undefined,
      phone: normalizePhone(row.phone) || undefined,
      address: text(row.address, 300) || undefined,
      events: picked,
      feeTotal: sumEventFees(tournament && tournament.events, picked) || undefined,
    },
  };
}

/** Làm sạch cả danh sách; một dòng hỏng thì báo đúng số thứ tự dòng đó. */
function normalizeAthletes(rows, tournament) {
  const list = Array.isArray(rows) ? rows : [];
  if (!list.length) return { error: 'Danh sách vận động viên đang trống.' };
  if (list.length > 300) return { error: 'Mỗi đơn chỉ nhận tối đa 300 vận động viên.' };
  const out = [];
  for (let i = 0; i < list.length; i += 1) {
    const built = normalizeAthlete(list[i], tournament);
    if (built.error) return { error: `Dòng ${i + 1}: ${built.error}` };
    out.push(built.data);
  }
  return { data: out };
}

/**
 * Hội viên khớp theo CCCD + còn hiệu lực hay không.
 * Hạn hội viên tính đến HẾT ngày `expiry` (quy ước của Liên đoàn: đến hết 31/12).
 */
function matchMember(members, cccd, now) {
  const key = String(cccd || '').replace(/[^\dA-Za-z]/g, '');
  if (!key) return { memberCode: '', memberValid: false };
  const found = (Array.isArray(members) ? members : [])
    .find((m) => String((m && m.cccd) || '').replace(/[^\dA-Za-z]/g, '') === key);
  if (!found) return { memberCode: '', memberValid: false };
  const today = toDay(now || new Date());
  const expiry = toDay(found.expiry);
  const valid = found.status === 'active' && (expiry == null || today <= expiry);
  return { memberCode: found.code || '', memberValid: valid };
}

/**
 * Đủ điều kiện vào danh sách thi đấu chính thức chưa (mục 2.1):
 * hội viên còn hiệu lực VÀ đã nộp lệ phí.
 */
function officialEligibility(entry) {
  const reasons = [];
  if (!entry || !entry.memberValid) reasons.push('chưa phải hội viên còn hiệu lực');
  if (!entry || !entry.paid) reasons.push('chưa ghi nhận nộp lệ phí');
  return { ok: reasons.length === 0, reasons };
}

/**
 * Vận hành bấm "xác nhận chính thức" (mục 2.2). Kiểm lại điều kiện 2.1 NGAY LÚC
 * duyệt thay vì tin vào ảnh chụp lúc nộp đơn: hội viên có thể đã hết hạn trong
 * khoảng thời gian giữa hai mốc đó.
 * @param entry    bản ghi hiện có
 * @param incoming field vận hành đang sửa trong cùng request (vd. bật `paid`)
 * @param members  các hội viên khớp CCCD để soi lại hiệu lực
 */
function confirmOfficial(entry, incoming, members, now) {
  const current = entry || {};
  const patch = incoming || {};
  const cccd = patch.cccd !== undefined ? patch.cccd : current.cccd;
  const match = matchMember(members, cccd, now);
  const paid = patch.paid !== undefined ? Boolean(patch.paid) : Boolean(current.paid);
  const check = officialEligibility({ memberValid: match.memberValid, paid });
  if (!check.ok) {
    return {
      ok: false,
      error: `Chưa đưa vào danh sách thi đấu chính thức được: ${check.reasons.join(' và ')}.`,
    };
  }
  return { ok: true, data: { ...match, paid, status: 'official' } };
}

module.exports = {
  parseFee,
  formatFee,
  sumEventFees,
  eventNames,
  registrationOpen,
  canSubmit,
  normalizeAthlete,
  normalizeAthletes,
  matchMember,
  officialEligibility,
  confirmOfficial,
};
