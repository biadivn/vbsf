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

module.exports = {
  register(/*{ strapi }*/) {},

  async bootstrap({ strapi }) {
    const publicRole = await strapi
      .query('plugin::users-permissions.role')
      .findOne({ where: { type: 'public' } });
    if (!publicRole) return;

    const actions = [];
    PUBLIC_READ_UIDS.forEach((uid) => actions.push(`${uid}.find`, `${uid}.findOne`));
    PUBLIC_READ_SINGLE_TYPE_UIDS.forEach((uid) => actions.push(`${uid}.find`));

    for (const action of actions) {
      const existing = await strapi.query('plugin::users-permissions.permission').findOne({
        where: { action, role: publicRole.id },
      });
      if (!existing) {
        await strapi.query('plugin::users-permissions.permission').create({
          data: { action, role: publicRole.id },
        });
      }
    }
  },
};
