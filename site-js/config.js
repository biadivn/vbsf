/* =========================================================
   VBSF PUBLIC SITE — ĐỊA CHỈ STRAPI

   Site public và Strapi nằm ở HAI domain khác nhau trên production:
     vbsf.biadi.vn      → site tĩnh, nginx KHÔNG proxy /api
     vbsf-cms.biadi.vn  → CMS + Strapi (nginx proxy /api, /uploads, /admin…)

   Vì vậy site public không thể dùng đường dẫn tương đối như CMS được — phải trỏ
   thẳng sang domain của Strapi. Strapi đã trả đúng header CORS cho origin
   vbsf.biadi.vn nên gọi chéo domain hoạt động bình thường.

   Thêm domain mới thì khai báo ở đây, một chỗ duy nhất. Muốn ghi đè tạm (bản
   staging, ngrok…) thì đặt window.VBSF_STRAPI_URL trước khi nạp file này.
   ========================================================= */
(function () {
  'use strict';

  // Giá trị '' nghĩa là cùng domain (đường dẫn tương đối).
  var STRAPI_BY_HOST = {
    'vbsf.biadi.vn': 'https://vbsf-cms.biadi.vn',
    'vbsf-cms.biadi.vn': '',
  };

  function resolve() {
    // Đã đặt sẵn từ bên ngoài thì tôn trọng.
    if (typeof window.VBSF_STRAPI_URL === 'string') return window.VBSF_STRAPI_URL;

    // Chạy local: mở file trực tiếp hoặc qua server tĩnh, Strapi ở cổng 1337.
    if (location.protocol === 'file:' || location.hostname === 'localhost' || location.hostname === '127.0.0.1') {
      return 'http://localhost:1337';
    }

    var mapped = STRAPI_BY_HOST[location.hostname];
    if (typeof mapped === 'string') return mapped;

    /* Domain lạ (preview, bản sao staging…): đoán theo quy ước đặt tên hiện tại
       — thêm tiền tố "vbsf-cms." vào domain gốc. Sai thì khai báo tường minh ở
       STRAPI_BY_HOST bên trên. */
    var parts = location.hostname.split('.');
    if (parts.length >= 2) {
      return location.protocol + '//vbsf-cms.' + parts.slice(-2).join('.');
    }
    return '';
  }

  window.VBSF_STRAPI_URL = resolve();

  /* Trình duyệt chỉ cần window.VBSF_STRAPI_URL ở trên. Nhánh này để unit test
     gọi lại resolve() với từng hostname giả (xem tests/site-config.test.js). */
  if (typeof module !== 'undefined' && module.exports) {
    module.exports = { resolve: resolve, STRAPI_BY_HOST: STRAPI_BY_HOST };
  }
})();
