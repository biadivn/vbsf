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

## Tài khoản hội viên trên site public

Hội viên cá nhân và hội viên tổ chức đăng nhập/đăng ký bằng **tài khoản thật**:

- Mật khẩu được Strapi hash bằng bcrypt (field kiểu `password`), so khớp ở phía
  máy chủ — site không bao giờ nhận được mật khẩu hay bản hash.
- Endpoint riêng, không dùng chung với tài khoản CMS:
  `POST /api/member-auth/{register,login}` · `GET /api/member-auth/me`
  và `POST /api/org-auth/{register,login}` · `GET /api/org-auth/me`
  (xem `strapi-backend/src/api/*/routes/*-auth.js`).
- Phiên là JWT riêng ký bằng `PUBLIC_AUTH_JWT_SECRET`, lưu ở localStorage.
- Hồ sơ đăng ký mới vào trạng thái `pending` — chờ VBSF xác nhận hội phí / xét duyệt.

API công khai `GET /api/members` và `/api/member-orgs` **đã lược bỏ dữ liệu định
danh** (CCCD, số điện thoại, email, ngày sinh, địa chỉ, mã số thuế) cho request
ẩn danh; request đã đăng nhập (CMS) vẫn nhận đủ — xem
`strapi-backend/src/api/member/controllers/member.js`.

> Cần bổ sung trước khi lên production: giới hạn tần suất (rate limit) cho các
> endpoint đăng ký/đăng nhập, và luồng quên mật khẩu.
