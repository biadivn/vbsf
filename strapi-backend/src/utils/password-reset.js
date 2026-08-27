'use strict';
/* Quên / đặt lại mật khẩu cho hội viên cá nhân và hội viên tổ chức.

   Luồng:
   1. POST .../forgot-password {phone} — luôn trả 200 "đã gửi nếu tài khoản tồn
      tại", KHÔNG cho biết số điện thoại nào có tài khoản.
   2. Sinh token 32 byte ngẫu nhiên, lưu bản BĂM + hạn 30 phút vào hồ sơ, gửi
      bản gốc qua email.
   3. POST .../reset-password {token, password} — token hợp lệ & chưa hết hạn thì
      đổi mật khẩu và xoá token (dùng một lần).
*/
const auth = require('./public-auth');

function siteUrl() {
  return (process.env.PUBLIC_SITE_URL || 'http://localhost:8080').replace(/\/$/, '');
}

function resetLink(token) {
  return siteUrl() + '/?reset=' + encodeURIComponent(token) + '#hoi-vien';
}

/** Gửi email đặt lại; chưa cấu hình provider thì ghi log để dev vẫn thử được. */
async function deliver(strapi, { email, name, token }) {
  const link = resetLink(token);
  const text =
    `Xin chào ${name || 'bạn'},\n\n` +
    `Chúng tôi nhận được yêu cầu đặt lại mật khẩu tài khoản hội viên VBSF của bạn.\n` +
    `Mở liên kết sau trong vòng 30 phút để đặt mật khẩu mới:\n\n${link}\n\n` +
    `Mã đặt lại (nếu cần nhập tay): ${token}\n\n` +
    `Nếu bạn không yêu cầu, hãy bỏ qua email này — mật khẩu hiện tại vẫn giữ nguyên.\n\n` +
    `Liên đoàn Billiards & Snooker Việt Nam`;

  if (email) {
    try {
      await strapi.plugin('email').service('email').send({
        to: email,
        subject: 'Đặt lại mật khẩu hội viên VBSF',
        text,
      });
      return 'email';
    } catch (err) {
      strapi.log.warn('[public-auth] Không gửi được email đặt lại mật khẩu: ' + err.message);
    }
  }

  /* Chưa cấu hình email provider (mặc định của Strapi là sendmail, thường không
     chạy được ở local/container) — in ra log để còn thử được luồng. Ở production
     phải cấu hình provider thật, xem strapi-backend/README.md. */
  strapi.log.info('[public-auth] Link đặt lại mật khẩu cho ' + (email || name || '?') + ': ' + link);
  return 'log';
}

/** Bước 1 — nhận yêu cầu. Luôn trả về cùng một kết quả dù có tài khoản hay không. */
async function requestReset(strapi, { uid, phone, emailField }) {
  const normalized = auth.normalizePhone(phone);
  if (!normalized) return { ok: true };

  const row = await strapi.db.query(uid).findOne({
    where: { phone: normalized },
    select: ['documentId', 'name', emailField],
  });
  if (!row) return { ok: true };

  const reset = auth.createResetToken();
  await strapi.documents(uid).update({
    documentId: row.documentId,
    data: { resetTokenHash: reset.hash, resetTokenExpiry: reset.expiry },
  });
  const via = await deliver(strapi, { email: row[emailField], name: row.name, token: reset.token });
  return { ok: true, via };
}

/** Bước 2 — đổi mật khẩu bằng token. */
async function performReset(strapi, { uid, token, password }) {
  if (!token) return { error: 'Thiếu mã đặt lại mật khẩu.' };
  if (String(password || '').length < 6) return { error: 'Mật khẩu phải có ít nhất 6 ký tự.' };

  const row = await strapi.db.query(uid).findOne({
    where: { resetTokenHash: auth.hashResetToken(token) },
    select: ['documentId', 'resetTokenExpiry'],
  });
  if (!row) return { error: 'Mã đặt lại không hợp lệ hoặc đã được sử dụng.' };
  if (!row.resetTokenExpiry || new Date(row.resetTokenExpiry).getTime() < Date.now()) {
    return { error: 'Mã đặt lại đã hết hạn. Vui lòng yêu cầu lại.' };
  }

  // Strapi tự hash field kiểu `password`; xoá token để dùng đúng một lần.
  await strapi.documents(uid).update({
    documentId: row.documentId,
    data: { password: String(password), resetTokenHash: null, resetTokenExpiry: null },
  });
  return { ok: true };
}

module.exports = { requestReset, performReset, resetLink };
