'use strict';
/* Đăng ký / đăng nhập hội viên cá nhân từ site public. */
const auth = require('../../../utils/public-auth');

const UID = 'api::member.member';

/* Tỉnh/thành và bộ môn là enumeration trong schema — giá trị gửi lên phải nằm
   trong danh sách, nếu không Strapi sẽ trả lỗi 500 khó hiểu. */
function enumValues(strapi, attribute) {
  const attr = strapi.contentType(UID).attributes[attribute];
  return (attr && attr.enum) || [];
}

module.exports = {
  async register(ctx) {
    const body = ctx.request.body || {};
    const name = String(body.name || '').trim();
    const cccd = String(body.cccd || '').trim();
    const phone = auth.normalizePhone(body.phone);
    const password = String(body.password || '');

    if (!name || !cccd || !phone || !password) {
      return ctx.badRequest('Vui lòng nhập đủ họ tên, số CCCD, số điện thoại và mật khẩu.');
    }
    if (!/^\d{9,12}$/.test(cccd)) return ctx.badRequest('Số CCCD không hợp lệ.');
    if (!/^0\d{8,10}$/.test(phone)) return ctx.badRequest('Số điện thoại không hợp lệ.');
    if (password.length < 6) return ctx.badRequest('Mật khẩu phải có ít nhất 6 ký tự.');

    const provinces = enumValues(strapi, 'province');
    const province = String(body.province || '').trim();
    if (province && provinces.indexOf(province) < 0) return ctx.badRequest('Tỉnh / thành không hợp lệ.');

    const duplicate = await strapi.db.query(UID).findOne({
      where: { $or: [{ phone }, { cccd }] },
      select: ['phone', 'cccd'],
    });
    if (duplicate) {
      return ctx.conflict(
        duplicate.phone === phone
          ? 'Số điện thoại này đã được đăng ký hội viên.'
          : 'Số CCCD này đã được đăng ký hội viên.'
      );
    }

    const year = new Date().getFullYear();
    const code = await auth.nextCode(strapi, UID, `VBSF-${year}-`, 5);

    // Strapi tự hash field kiểu `password` khi ghi qua Document Service.
    const created = await strapi.documents(UID).create({
      data: {
        code,
        name,
        cccd,
        phone,
        password,
        email: String(body.email || '').trim() || undefined,
        dob: body.dob || undefined,
        address: String(body.address || '').trim() || undefined,
        club: String(body.club || '').trim() || undefined,
        province: province || undefined,
        // Hồ sơ mới luôn chờ VBSF xác nhận hội phí trước khi có hiệu lực.
        status: 'pending',
      },
    });

    ctx.body = {
      token: auth.signToken({ kind: 'member', documentId: created.documentId }),
      member: auth.selfView(created),
    };
  },

  async login(ctx) {
    const body = ctx.request.body || {};
    const phone = auth.normalizePhone(body.phone);
    const password = String(body.password || '');
    if (!phone || !password) return ctx.badRequest('Vui lòng nhập số điện thoại và mật khẩu.');

    const row = await strapi.db.query(UID).findOne({ where: { phone } });
    // Thông báo giống nhau cho "không có tài khoản" và "sai mật khẩu" để không
    // biến endpoint này thành công cụ dò số điện thoại nào đã đăng ký.
    const ok = row && (await auth.comparePassword(password, row.password));
    if (!ok) return ctx.unauthorized('Số điện thoại hoặc mật khẩu không đúng.');

    const doc = await strapi.documents(UID).findOne({
      documentId: row.documentId,
      populate: ['disciplines', 'freeMatches'],
    });
    ctx.body = {
      token: auth.signToken({ kind: 'member', documentId: row.documentId }),
      member: auth.selfView(doc),
    };
  },

  /* Form đăng ký cần biết CCCD đã có hồ sơ hay chưa để tính đúng mức hội phí
     (đăng ký mới / gia hạn). Chỉ trả về có-hay-không và trạng thái hồ sơ —
     KHÔNG trả tên hay mã hội viên, để endpoint này không dùng dò được danh tính
     từ một số CCCD bất kỳ. */
  async cccdStatus(ctx) {
    const cccd = String((ctx.request.body || {}).cccd || '').trim();
    if (!/^\d{9,12}$/.test(cccd)) return ctx.badRequest('Số CCCD không hợp lệ.');
    const row = await strapi.db.query(UID).findOne({ where: { cccd }, select: ['status'] });
    ctx.body = { found: !!row, status: row ? row.status : null };
  },

  async me(ctx) {
    const payload = auth.readToken(ctx);
    if (!payload || payload.kind !== 'member') return ctx.unauthorized('Phiên đăng nhập không hợp lệ.');
    const doc = await strapi.documents(UID).findOne({
      documentId: payload.documentId,
      populate: ['disciplines', 'freeMatches'],
    });
    if (!doc) return ctx.unauthorized('Hội viên không còn tồn tại.');
    ctx.body = { member: auth.selfView(doc) };
  },
};
