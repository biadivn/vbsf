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

Trên production site public và Strapi nằm ở **hai domain khác nhau**
(`vbsf.biadi.vn` ↔ `vbsf-cms.biadi.vn`), nên địa chỉ Strapi được khai báo tập
trung ở [site-js/config.js](site-js/config.js). Thêm domain mới thì sửa đúng một
chỗ đó; đặt `window.VBSF_STRAPI_URL` trước khi nạp file này để ghi đè tạm.

Site public hoạt động theo kiểu *progressive enhancement*: nếu không gọi được
Strapi thì giữ nguyên nội dung tĩnh có sẵn trong HTML, không báo lỗi ra giao diện.

Nạp nội dung mẫu (trích từ prototype tĩnh `VBSF Web.html`) vào Strapi:

```bash
cd strapi-backend && npm run migrate:website
```

## Kiểm thử & security gate

`cd strapi-backend && npm run verify` — unit test (ngưỡng coverage 80%) + security
scan (chặn nếu có lỗ hổng high/critical, secret bị commit, hoặc route công khai
thiếu rate limit). Gate này chạy tự động trước `npm run build` và trong CI trước
khi build image / deploy web. Chi tiết ở
[strapi-backend/README.md](strapi-backend/README.md).

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

### Giới hạn tần suất

Đếm theo IP, cửa sổ trượt (`strapi-backend/src/utils/rate-limit.js`):

| Nhóm endpoint | Hạn mức |
|---|---|
| `register` · `login` · `me` · `cccd-status` · `avatar` | **10 request/giây** |
| `forgot-password` · `reset-password` | **5 request/phút** |

Quá hạn trả `429` kèm header `Retry-After`. Bộ đếm nằm trong bộ nhớ tiến trình —
chạy nhiều instance sau load balancer thì mỗi instance có bộ đếm riêng; muốn
chính xác tuyệt đối cần chuyển sang Redis.

### Quên mật khẩu

`POST .../forgot-password {phone}` luôn trả cùng một thông báo dù số có tài khoản
hay không. Nếu có, hệ thống sinh token 32 byte ngẫu nhiên, lưu **bản băm SHA-256**
+ hạn 30 phút vào hồ sơ, rồi gửi link `PUBLIC_SITE_URL/?reset=<token>#hoi-vien`
qua email (`email` của hội viên, `repEmail` của tổ chức). `POST .../reset-password
{token, password}` đổi mật khẩu và xoá token — mỗi mã dùng được đúng một lần.

> Chưa cấu hình email provider thì link được ghi vào log server để dev thử được;
> **production bắt buộc phải cấu hình provider thật** cho plugin email của Strapi.

### Ảnh đại diện

Content-type `member` có field `avatar` (media, ảnh). Hội viên tự đổi ảnh qua
`POST /api/member-auth/avatar` (multipart, cần Bearer token, tối đa 3 MB, chỉ nhận
`image/*`) — `/api/upload` **không** mở cho người dùng ẩn danh. Ảnh hiển thị ở hồ
sơ hội viên, danh sách hội viên, bục xếp hạng và ô Top players; chưa có ảnh thì
giữ nguyên ô placeholder.
