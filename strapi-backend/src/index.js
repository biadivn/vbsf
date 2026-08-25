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
  // "me" là action riêng (không nằm trong find/findOne) — thiếu quyền này khiến
  // GET /api/users/me trả 403, làm phiên đăng nhập không khôi phục được sau khi
  // reload trang CMS (luôn bị đẩy về màn hình đăng nhập).
  'plugin::users-permissions.user.me',
];

// Các collection CMS quản lý trực tiếp (module "Tin tức", "Đối tác",
// "Văn bản & Luật", "Thư viện Media", "Hội viên & Xếp hạng", "Hội viên tổ chức") —
// tài khoản CMS (role Authenticated) cần đủ quyền CRUD trên các content-type này.
const CONTENT_MANAGE_UIDS = [
  'api::news-article.news-article',
  'api::partner.partner',
  'api::library-doc.library-doc',
  'api::media-item.media-item',
  'api::member.member',
  'api::member-org.member-org',
  'api::tournament.tournament',
];
const CONTENT_MANAGE_SINGLE_TYPE_UIDS = ['api::setting.setting', 'api::contact-info.contact-info'];

// Cho phép tài khoản CMS upload ảnh (news.image, partner.image) qua /api/upload.
const UPLOAD_ACTIONS = ['plugin::upload.content-api.upload'];

// Tạo tài khoản quản trị lần đầu — CHỈ chạy khi các biến môi trường tương ứng
// được set trên server (trong strapi-backend/.env, không nằm trong git), và
// bỏ qua nếu email đã tồn tại. Không hardcode mật khẩu trong mã nguồn.
// Sau khi xác nhận đăng nhập được, nên xoá các biến này khỏi .env trên server
// (bootstrap sẽ không làm gì thêm vì tài khoản đã tồn tại) hoặc xoá hẳn 2 hàm
// này + lệnh gọi trong bootstrap().
async function ensureAdminUser(strapi) {
  const email = process.env.BOOTSTRAP_ADMIN_EMAIL;
  const password = process.env.BOOTSTRAP_ADMIN_PASSWORD;
  if (!email || !password) return;
  const existing = await strapi.query('admin::user').findOne({ where: { email } });
  if (existing) return;
  const superAdminRole = await strapi.query('admin::role').findOne({ where: { code: 'strapi-super-admin' } });
  if (!superAdminRole) return;
  await strapi.service('admin::user').create({
    email,
    firstname: 'VBSF',
    lastname: 'Admin',
    password,
    isActive: true,
    roles: [superAdminRole.id],
  });
}

async function ensureCmsAccount(strapi) {
  const email = process.env.BOOTSTRAP_CMS_EMAIL;
  const password = process.env.BOOTSTRAP_CMS_PASSWORD;
  if (!email || !password) return;
  const existing = await strapi.db.query('plugin::users-permissions.user').findOne({ where: { email } });
  if (existing) return;
  const authenticatedRole = await strapi
    .query('plugin::users-permissions.role')
    .findOne({ where: { type: 'authenticated' } });
  if (!authenticatedRole) return;
  await strapi.plugin('users-permissions').service('user').add({
    username: email,
    email,
    password,
    displayName: 'Quản trị viên CMS',
    provider: 'local',
    confirmed: true,
    role: authenticatedRole.id,
  });
}

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
      const contentActions = [];
      CONTENT_MANAGE_UIDS.forEach((uid) =>
        contentActions.push(`${uid}.find`, `${uid}.findOne`, `${uid}.create`, `${uid}.update`, `${uid}.delete`)
      );
      CONTENT_MANAGE_SINGLE_TYPE_UIDS.forEach((uid) => contentActions.push(`${uid}.find`, `${uid}.update`));
      await grantPermissions(strapi, authenticatedRole.id, [...AUTHENTICATED_USER_ACTIONS, ...contentActions, ...UPLOAD_ACTIONS]);
    }

    await ensureAdminUser(strapi);
    await ensureCmsAccount(strapi);
  },
};
