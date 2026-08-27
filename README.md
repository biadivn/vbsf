##Bản demo cho VBSF##

Cách chạy
1. Chạy trực tiếp từ file HTML
   * Mở file [VBSF Web.html](VBSF%20Web.html) để mở trang demo của web
   * Mở file [VBSF-CMS.html](VBSF-CMS.html) để mở trang demo của cms

2. Chạy qua local server (khuyến nghị — cần cho site public tách trang)
   ```bash
   ./serve.sh          # http://localhost:8080/index.html
   ```
   * [index.html](index.html) — site public, các trang nằm ở [pages/](pages/)
   * [cms.html](cms.html) — CMS quản trị nội dung

## Nguồn dữ liệu

Cả site public lẫn CMS đều đọc nội dung từ Strapi (xem
[strapi-backend/](strapi-backend/) — chạy `npm run develop`, mặc định
`http://localhost:1337`).

- **CMS** ([cms-js/](cms-js/)) đọc/ghi qua tài khoản đăng nhập.
- **Site public** ([site-js/strapi-content.js](site-js/strapi-content.js)) chỉ đọc
  qua API công khai, render đè lên các khối đã đánh dấu sẵn trong HTML
  (`[data-section]`, `[data-items]`, `[data-fill]`).

Site public hoạt động theo kiểu *progressive enhancement*: nếu không gọi được
Strapi thì giữ nguyên nội dung tĩnh có sẵn trong HTML, không báo lỗi ra giao diện.

Nạp nội dung mẫu (trích từ prototype tĩnh `VBSF Web.html`) vào Strapi:

```bash
cd strapi-backend && npm run migrate:website
```

> Đăng nhập hội viên/tổ chức trên site public hiện vẫn là **demo**: Strapi không
> trả field `password` qua API công khai nên site tĩnh không xác thực thật được.
> Cần một endpoint đăng nhập riêng ở backend trước khi lên production.
