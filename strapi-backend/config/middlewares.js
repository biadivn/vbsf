module.exports = [
  'strapi::logger',
  'strapi::errors',
  'strapi::security',
  'strapi::cors',
  'strapi::poweredBy',
  'strapi::query',
  // PDF xác nhận của địa phương đi kèm đơn đăng ký dưới dạng base64 (tối đa 5MB).
  { name: 'strapi::body', config: { jsonLimit: '8mb', formLimit: '8mb' } },
  'strapi::session',
  'strapi::favicon',
  'strapi::public',
  // Sau strapi::public để chạy cho cả tệp tĩnh trong /uploads.
  'global::uploads-noindex',
];
