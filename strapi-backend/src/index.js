'use strict';

/* Chỉ dùng cho môi trường local/test: tự động cấp quyền đọc công khai (find/findOne)
   cho các collection VBSF để có thể curl thẳng /api/... mà không cần vào Admin
   bật quyền tay mỗi lần reset DB. Không dùng cấu hình này cho production. */
const PUBLIC_READ_UIDS = [
  'api::news-article.news-article',
  'api::tournament.tournament',
  'api::member.member',
  'api::member-org.member-org',
  'api::partner.partner',
  'api::library-doc.library-doc',
  'api::media-item.media-item',
];
const PUBLIC_READ_SINGLE_TYPE_UIDS = ['api::setting.setting', 'api::contact-info.contact-info'];

// CMS đăng nhập bằng tài khoản plugin::users-permissions.user (Authenticated role) —
// role này cần các quyền CRUD trên chính content-type user để module "Tài khoản CMS"
// trong CMS quản lý được danh sách tài khoản.
const AUTHENTICATED_USER_ACTIONS = [
  'plugin::users-permissions.user.find',
  'plugin::users-permissions.user.findOne',
  'plugin::users-permissions.user.create',
  'plugin::users-permissions.user.update',
  'plugin::users-permissions.user.destroy',
  'plugin::users-permissions.user.count',
];

async function grantPermissions(strapi, roleId, actions) {
  for (const action of actions) {
    const existing = await strapi.query('plugin::users-permissions.permission').findOne({
      where: { action, role: roleId },
    });
    if (!existing) {
      await strapi.query('plugin::users-permissions.permission').create({
        data: { action, role: roleId },
      });
    }
  }
}

module.exports = {
  register(/*{ strapi }*/) {},

  async bootstrap({ strapi }) {
    const publicRole = await strapi
      .query('plugin::users-permissions.role')
      .findOne({ where: { type: 'public' } });
    if (publicRole) {
      const actions = [];
      PUBLIC_READ_UIDS.forEach((uid) => actions.push(`${uid}.find`, `${uid}.findOne`));
      PUBLIC_READ_SINGLE_TYPE_UIDS.forEach((uid) => actions.push(`${uid}.find`));
      await grantPermissions(strapi, publicRole.id, actions);

      // Tài khoản CMS được quản lý thủ công (qua module Tài khoản trong CMS / Strapi Admin),
      // không cho phép người ngoài tự đăng ký qua API công khai.
      const registerPermission = await strapi.query('plugin::users-permissions.permission').findOne({
        where: { action: 'plugin::users-permissions.auth.register', role: publicRole.id },
      });
      if (registerPermission) {
        await strapi.query('plugin::users-permissions.permission').delete({ where: { id: registerPermission.id } });
      }
    }

    const authenticatedRole = await strapi
      .query('plugin::users-permissions.role')
      .findOne({ where: { type: 'authenticated' } });
    if (authenticatedRole) {
      await grantPermissions(strapi, authenticatedRole.id, AUTHENTICATED_USER_ACTIONS);
    }
  },
};
