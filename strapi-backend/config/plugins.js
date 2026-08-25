const allowedMediaTypes = [
  'image/*',
  'video/*',
  'audio/*',
  'application/pdf',
  'application/msword',
  'application/vnd.openxmlformats-officedocument.*',
  'text/plain',
  'text/csv',
];

const deniedExecutableTypes = [
  'application/vnd.microsoft.portable-executable',
  'application/x-msdownload',
  'application/x-msdos-program',
  'application/x-executable',
  'application/x-dosexec',
  'application/x-sh',
  'text/x-shellscript',
  'application/x-mach-binary',
];

module.exports = () => ({
  'users-permissions': {
    config: {
      jwtManagement: 'refresh',
      sessions: {
        // CMS chạy trên origin khác Strapi (vd. mở qua file:// hoặc localhost:8080),
        // nên dùng refreshToken trả về trong JSON (localStorage) thay vì cookie
        // httpOnly liên-origin để tránh vướng CORS/SameSite khi chạy local.
        httpOnly: false,
        accessTokenLifespan: 60 * 60,
      },
    },
  },
  upload: {
    config: {
      security: {
        allowedTypes: allowedMediaTypes,
        deniedTypes: deniedExecutableTypes,
      },
    },
  },
});
