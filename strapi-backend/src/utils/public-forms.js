'use strict';
/* Nhận dữ liệu từ 3 form công khai trên site: Liên hệ, Đăng ký thi đấu, và
   "Tôi đã chuyển khoản".

   KHÔNG mở quyền `create` của core controller cho khách ẩn danh — làm vậy là cho
   phép ghi bất kỳ field nào, kể cả `status: 'confirmed'` hay `handled: true`.
   Mỗi form đi qua một endpoint riêng: chỉ nhận đúng field được liệt kê, tự đặt
   trạng thái mặc định, và có giới hạn tần suất theo IP. */

/** Cắt chuỗi để một request rác không nhét được megabyte vào CSDL. */
function text(value, max) {
  return String(value == null ? '' : value).trim().slice(0, max || 500);
}

function isEmail(value) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value);
}

function normalizePhone(phone) {
  return String(phone == null ? '' : phone).replace(/[^\d]/g, '');
}

/**
 * Tạo handler cho một form.
 * @param uid      content-type nhận dữ liệu
 * @param build    (body) => { data } hoặc { error }
 * @param message  thông báo trả về khi thành công
 */
function formHandler({ uid, build, message }) {
  return async function submit(ctx) {
    const built = build(ctx.request.body || {});
    if (built.error) return ctx.badRequest(built.error);
    const created = await strapi.documents(uid).create({ data: built.data });
    ctx.body = { ok: true, id: created.documentId, message };
  };
}

/* ---------------- Liên hệ ---------------- */
const contactMessage = formHandler({
  uid: 'api::contact-message.contact-message',
  message: 'Đã gửi liên hệ. Chúng tôi sẽ phản hồi sớm nhất.',
  build(body) {
    const name = text(body.name, 120);
    const email = text(body.email, 160);
    const messageText = text(body.message, 4000);
    if (!name || !email || !messageText) return { error: 'Vui lòng nhập họ tên, email và nội dung.' };
    if (!isEmail(email)) return { error: 'Email không hợp lệ.' };
    return {
      data: {
        name,
        email,
        phone: normalizePhone(body.phone) || undefined,
        subject: text(body.subject, 160) || undefined,
        message: messageText,
        handled: false,
      },
    };
  },
});

/* ---------------- Đăng ký thi đấu ---------------- */
const tournamentRegistration = formHandler({
  uid: 'api::tournament-registration.tournament-registration',
  message: 'Đã gửi đăng ký. Ban tổ chức sẽ liên hệ xác nhận qua điện thoại.',
  build(body) {
    const tournamentName = text(body.tournamentName, 200);
    const playerName = text(body.playerName, 120);
    const phone = normalizePhone(body.phone);
    if (!tournamentName || !playerName || !phone) {
      return { error: 'Vui lòng nhập đủ tên cơ thủ và số điện thoại.' };
    }
    if (!/^0\d{8,10}$/.test(phone)) return { error: 'Số điện thoại không hợp lệ.' };
    return {
      data: {
        tournamentName,
        playerName,
        memberCode: text(body.memberCode, 40) || undefined,
        phone,
        club: text(body.club, 160) || undefined,
        note: text(body.note, 2000) || undefined,
        status: 'pending',
      },
    };
  },
});

/* ---------------- Báo đã chuyển khoản ---------------- */
const paymentClaim = formHandler({
  uid: 'api::payment-claim.payment-claim',
  message: 'Đã ghi nhận. VBSF sẽ đối soát và xác nhận trong thời gian sớm nhất.',
  build(body) {
    const kind = body.kind === 'gia-han' ? 'gia-han' : 'dang-ky';
    const transferNote = text(body.transferNote, 160);
    if (!transferNote) return { error: 'Thiếu nội dung chuyển khoản.' };
    return {
      data: {
        kind,
        memberCode: text(body.memberCode, 40) || undefined,
        payerName: text(body.payerName, 120) || undefined,
        phone: normalizePhone(body.phone) || undefined,
        amount: text(body.amount, 40) || undefined,
        transferNote,
        status: 'pending',
      },
    };
  },
});

module.exports = { contactMessage, tournamentRegistration, paymentClaim, text, isEmail, normalizePhone };
