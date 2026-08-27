'use strict';
/* Đăng ký / đăng nhập hội viên tổ chức từ site public. */
const auth = require('../../../utils/public-auth');
const passwordReset = require('../../../utils/password-reset');

const UID = 'api::member-org.member-org';

function enumValues(strapi, attribute) {
  const attr = strapi.contentType(UID).attributes[attribute];
  return (attr && attr.enum) || [];
}

module.exports = {
  async register(ctx) {
    const body = ctx.request.body || {};
    const name = String(body.name || '').trim();
    const phone = auth.normalizePhone(body.phone);
    const password = String(body.password || '');
    const repName = String(body.repName || '').trim();
    const address = String(body.address || '').trim();

    if (!name || !phone || !password || !repName || !address) {
      return ctx.badRequest('Vui lòng nhập đủ tên tổ chức, người đại diện, địa chỉ, số điện thoại và mật khẩu.');
    }
    if (!/^0\d{8,10}$/.test(phone)) return ctx.badRequest('Số điện thoại không hợp lệ.');
    if (password.length < 6) return ctx.badRequest('Mật khẩu phải có ít nhất 6 ký tự.');

    const orgType = String(body.orgType || '').trim();
    if (orgType && enumValues(strapi, 'orgType').indexOf(orgType) < 0) {
      return ctx.badRequest('Loại hình tổ chức không hợp lệ.');
    }
    const province = String(body.province || '').trim();
    if (province && enumValues(strapi, 'province').indexOf(province) < 0) {
      return ctx.badRequest('Tỉnh / thành không hợp lệ.');
    }

    const duplicate = await strapi.db.query(UID).findOne({ where: { phone }, select: ['phone'] });
    if (duplicate) return ctx.conflict('Số điện thoại này đã được đăng ký hội viên tổ chức.');

    const year = new Date().getFullYear();
    const code = await auth.nextCode(strapi, UID, `VBSF-TC-${year}-`, 3);

    const created = await strapi.documents(UID).create({
      data: {
        code,
        name,
        orgType: orgType || undefined,
        taxCode: String(body.taxCode || '').trim() || undefined,
        province: province || undefined,
        address,
        repName,
        repTitle: String(body.repTitle || '').trim() || undefined,
        repPhone: auth.normalizePhone(body.repPhone) || phone,
        repEmail: String(body.repEmail || '').trim() || undefined,
        phone,
        password,
        joinDate: new Date().toISOString().slice(0, 10),
        // Hồ sơ tổ chức phải qua bước xét duyệt của Ban Tổ chức VBSF.
        status: 'pending',
      },
    });

    ctx.body = {
      token: auth.signToken({ kind: 'org', documentId: created.documentId }),
      org: auth.selfView(created),
    };
  },

  async login(ctx) {
    const body = ctx.request.body || {};
    const phone = auth.normalizePhone(body.phone);
    const password = String(body.password || '');
    if (!phone || !password) return ctx.badRequest('Vui lòng nhập số điện thoại và mật khẩu.');

    const row = await strapi.db.query(UID).findOne({ where: { phone } });
    const ok = row && (await auth.comparePassword(password, row.password));
    if (!ok) return ctx.unauthorized('Số điện thoại hoặc mật khẩu không đúng.');

    const doc = await strapi.documents(UID).findOne({ documentId: row.documentId });
    ctx.body = {
      token: auth.signToken({ kind: 'org', documentId: row.documentId }),
      org: auth.selfView(doc),
    };
  },

  /* Xem ghi chú ở src/api/member/controllers/member-auth.js — email đặt lại
     mật khẩu của tổ chức gửi tới email người đại diện. */
  async forgotPassword(ctx) {
    const phone = (ctx.request.body || {}).phone;
    await passwordReset.requestReset(strapi, { uid: UID, phone: phone, emailField: 'repEmail' });
    ctx.body = {
      ok: true,
      message: 'Nếu số điện thoại này có tài khoản, chúng tôi đã gửi hướng dẫn đặt lại mật khẩu tới email người đại diện.',
    };
  },

  async resetPassword(ctx) {
    const body = ctx.request.body || {};
    const res = await passwordReset.performReset(strapi, {
      uid: UID,
      token: body.token,
      password: body.password,
    });
    if (res.error) return ctx.badRequest(res.error);
    ctx.body = { ok: true, message: 'Đặt lại mật khẩu thành công. Bạn có thể đăng nhập bằng mật khẩu mới.' };
  },

  async me(ctx) {
    const payload = auth.readToken(ctx);
    if (!payload || payload.kind !== 'org') return ctx.unauthorized('Phiên đăng nhập không hợp lệ.');
    const doc = await strapi.documents(UID).findOne({ documentId: payload.documentId });
    if (!doc) return ctx.unauthorized('Tổ chức không còn tồn tại.');
    ctx.body = { org: auth.selfView(doc) };
  },
};
