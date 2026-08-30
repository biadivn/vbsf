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

## Form trên site gửi về đâu

| Form | Endpoint | Xem trong CMS |
|---|---|---|
| Liên hệ | `POST /api/contact-messages/submit` | Đăng ký & Liên hệ → Liên hệ đến |
| Đăng ký thi đấu | `POST /api/tournament-registrations/submit` | Đăng ký & Liên hệ → Đăng ký thi đấu |
| "Tôi đã chuyển khoản" | `POST /api/payment-claims/submit` | Đăng ký & Liên hệ → Báo chuyển khoản |

Ba endpoint này công khai nhưng **không** mở quyền `create` của core controller —
mỗi form đi qua handler riêng chỉ nhận đúng field cho phép và tự đặt trạng thái
(`pending` / `handled: false`), nên client không thể tự đánh dấu "đã xử lý".
Giới hạn 5 lần/phút/IP. Dữ liệu người gửi **không** đọc được công khai, chỉ tài
khoản CMS mới xem được.

## Nội dung do CMS điều khiển

| Thứ | Nguồn |
|---|---|
| Nhãn/tiêu đề/banner từng trang | single type `page-content` — module "Trang website" |
| Ban lãnh đạo (trang Giới thiệu) | collection `leaders` |
| Footer (địa chỉ, email, điện thoại) | single type `contact-info` |

Bộ lọc trên site lọc thật từ dữ liệu: Giải đấu lọc theo nội dung + năm, Xếp hạng
lọc theo tỉnh/thành. Bảng xếp hạng là **danh sách luôn cập nhật**, không chia theo
kỳ. Riêng "lượt xem" của bài viết vẫn là số cố định trong HTML — chưa có cơ chế đếm.

### Cấu hình khối (section) của site

Module "Trang website" trong CMS bật/tắt, đổi tiêu đề, đổi nội dung và chọn dữ
liệu cho từng khối. Toàn bộ lưu trong single type `page-content`; site đọc lại
qua [site-js/page-config.js](site-js/page-config.js).

Ba mảnh phải khớp nhau, lệch một mảnh là admin sửa mà trang không đổi:

| Mảnh | Ở đâu |
|---|---|
| Khai báo khối + các ô nhập | [cms-js/page-sections-registry.js](cms-js/page-sections-registry.js) |
| Chỗ nhận nội dung trên trang | `pages/*.html` — `data-section`, `data-title`, `data-fill`, `data-fill-html`, `data-items`, `data-bg` |
| Đọc cấu hình khi dựng trang | [site-js/page-config.js](site-js/page-config.js) + `RENDER` trong `site-js/strapi-content.js` |

- `data-fill="<key>"` nhận chữ thuần; `data-fill-html="<key>"` dành cho ô soạn
  thảo (`type:'textarea'`), CMS lưu HTML cho những ô đó.
- `data-title` nhận "Tiêu đề hiển thị"; `data-items` là nơi đổ danh sách; `data-bg`
  là ô nhận ảnh nền (mặc định đặt lên chính khối).
- Bộ chọn (`newsPicker` / `partnerPicker` / `tournamentSelect`) lưu id vào
  `newsIds` / `partnerIds` / `tournamentIds`; `pickerMode` `'manual'` dùng đúng
  danh sách đã chọn, `'auto'` lấy `autoCount` bản ghi mới nhất.

> Panel chỉnh sửa chỉ dựng được **một** loại nội dung cho mỗi khối: picker HOẶC
> fields HOẶC itemFields. Cần cả hai thì tách thành hai khối — đó là lý do banner
> trang chủ và cột "Tin nổi bật" cạnh nó là hai khối riêng (`hero-banner`,
> `hero-tin-noi-bat`).

Bật/tắt và thứ tự khối cũng áp lên site: `enabled: false` ẩn khối, còn thứ tự
trong danh sách CMS sắp lại DOM — nhưng chỉ **hoán vị các khối cùng một cha**,
vì khối nằm trong một hàng flex riêng (banner + cột tin) không thể đổi chỗ với
khối ngoài hàng đó mà không vỡ bố cục. `PAGE_SECTION_ORDER_VERSION` trong
registry sắp lại thứ tự đang lưu một lần cho khớp danh mục; tăng số đó nếu cần
sắp lại lần nữa.

Banner trang chủ trỏ vào **một giải đấu thật**: tên, ngày và địa điểm lấy từ bản
ghi giải, bấm vào mở đúng giải đó. Chưa chọn thì tự lấy giải đang diễn ra, không
có nữa thì giải sắp tới gần nhất.

Nguồn dùng chung không đặt trong section: phí và số tài khoản ở "Thông tin tổ
chức" (`setting`), địa chỉ/email/điện thoại ở "Thông tin liên hệ" (`contact-info`).
Đặt thêm bản sao trong section thì hai nơi lệch nhau mà không ai biết bên nào
đang hiển thị.

### Tệp tài liệu (Văn bản & Luật)

Admin đính tệp ngay trong CMS (ô "Tệp đính kèm", tự điền Định dạng + Dung lượng
theo tệp vừa chọn). Tệp lên Strapi qua `POST /api/upload` bằng token của phiên
đăng nhập — endpoint đó **không** mở cho khách ẩn danh.

Tài liệu là nội dung công khai, ai vào site cũng phải tải được; cái cần chặn là
bot quét sạch kho tệp và công cụ tìm kiếm lập chỉ mục thẳng file PDF. Ba lớp:

| Lớp | Ở đâu |
|---|---|
| API công khai **không trả** đường dẫn `/uploads` — chỉ có `downloadUrl` trỏ vào endpoint riêng | [library-doc.js](strapi-backend/src/api/library-doc/controllers/library-doc.js) + [library-doc-file.js](strapi-backend/src/utils/library-doc-file.js) |
| Endpoint tải đặt `X-Robots-Tag: noindex, nofollow, noarchive`, ép `Content-Disposition: attachment`, chốt đường dẫn trong `public/uploads`, chỉ phục vụ đuôi tệp trong danh sách cho phép | [library-doc-download.js](strapi-backend/src/api/library-doc/controllers/library-doc-download.js) |
| 30 lượt tải/phút/IP | `DOWNLOAD_LIMIT` trong [rate-limit.js](strapi-backend/src/utils/rate-limit.js) |

Thêm một lớp phòng khi đường dẫn `/uploads` lọt ra ngoài bằng cách khác (ảnh
trong bài viết vẫn dùng thẳng `/uploads`): middleware
[uploads-noindex](strapi-backend/src/middlewares/uploads-noindex.js) gắn
`X-Robots-Tag` cho mọi phản hồi dưới `/uploads`.

> **robots.txt không dùng được ở đây.** `/robots.txt` của cả `vbsf.biadi.vn` và
> `vbsf-cms.biadi.vn` đang do Cloudflare quản lý (Managed robots.txt) và ghi đè
> file trong repo — kiểm chứng bằng `curl -s https://vbsf-cms.biadi.vn/robots.txt`.
> `strapi-backend/public/robots.txt` đã có `Disallow: /uploads/` để dùng ngay khi
> tắt tính năng đó trong Cloudflare, nhưng ba lớp trên không phụ thuộc vào nó.

`hasFile`/`downloadUrl` suy ra từ quan hệ media nên controller **tự ép populate**
thay vì trông chờ người gọi truyền `?populate=file` — quên một lần là cả trang
Thư viện mất nút tải mà không có lỗi nào báo ra.

### Quản lý giải đấu (CMS)

Engine ở [cms-js/tournament-engine.js](cms-js/tournament-engine.js) lo 4 thể thức
(loại trực tiếp, loại kép, vòng tròn, Swiss tính mạng); [tournament-editor.js](cms-js/tournament-editor.js)
là phần giao diện. Toàn bộ trạng thái sơ đồ được đẩy lên Strapi ở mọi điểm thay
đổi qua `teSyncTournamentToStrapi`.

**Thứ tự `record.players` chính là thứ tự hạt giống.** Người thứ i là hạt giống
#i+1, cặp vòng 1 suy ra theo bảng hạt giống chuẩn. Muốn sắp cặp khác thì đổi chỗ
hai người trong danh sách — card "Bắt cặp vòng 1" cho chọn thẳng ở từng ô, kèm
nút bốc thăm ngẫu nhiên. Suất miễn đấu (BYE) luôn rơi vào các hạt giống cuối
(thông lệ: hạt giống trên được miễn đấu), và vẫn chọn được ai hưởng bằng cách
đưa người đó vào hạt giống ghép với ô BYE. Phần logic thuần nằm ở
[cms-js/tournament-seeding.js](cms-js/tournament-seeding.js) và có unit test.

Nhập kết quả có hai đường, dùng chung `teSubmitElimResult`:

| Đường | Dùng khi |
|---|---|
| Bấm trận trên sơ đồ | Cần đặt điểm xếp hạng riêng, hoặc **sửa** trận đã có kết quả |
| Bảng "Trận cần nhập kết quả" | Nhập nhanh, sơ đồ 32/64 người khỏi phải dò trên cây |

Bảng chỉ liệt kê trận đã đủ hai người chơi thật và chưa có tỷ số, áp điểm xếp
hạng mặc định (thắng +25, thua +5).

> `champion` do engine tự điền khi giải kết thúc; `runnerUp`/`third` ban tổ chức
> nhập tay ở tab Thông tin. Cả ba **phải** nằm trong `teBuildTournamentPayload` —
> Strapi giữ nguyên field không được gửi, nên thiếu là người nhập thấy báo "đã
> lưu" mà dữ liệu không đi đâu cả. Bấm "Tạo lại sơ đồ" xoá cả ba.

### Cache của site public

nginx đặt `Cache-Control: max-age=14400` cho `*.js`, nên `index.html` gắn
`?v=<commit ngắn>` vào 3 thẻ script và `deploy-web.yml` thay giá trị này khi
rsync. Mỗi bản deploy là một URL mới nên cả Cloudflare lẫn trình duyệt đều nạp
lại ngay. `index.html` và `pages/*.html` không bị cache edge (`cf-cache-status:
DYNAMIC`) nên không cần xử lý gì thêm.

> Purge cache Cloudflare **không thay thế được** cơ chế này: purge chỉ xoá bản
> lưu ở edge, còn trình duyệt của người đã truy cập vẫn dùng bản cũ cho tới hết
> 4 giờ. Đổi URL thì cả hai cùng nạp lại.

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
- **Quên mật khẩu đang TẮT** (chưa có máy chủ email) — xem mục bên dưới.

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

### Quên mật khẩu — ĐANG TẮT

> Tính năng này **đang tắt** vì hệ thống chưa có máy chủ email: route
> `forgot-password` / `reset-password` không được đăng ký (gọi vào trả 405) và
> link "Quên mật khẩu?" trên site bị ẩn — thay vì hứa gửi mã rồi không gửi được.
> Mặc định là tắt (fail-closed): thiếu biến môi trường cũng coi như tắt.
>
> **Bật lại khi đã có email server** — đủ 3 bước, thiếu bước nào cũng hỏng:
> 1. Cấu hình provider email cho Strapi (`config/plugins.js`) và gửi thử thật.
> 2. `PASSWORD_RESET_ENABLED=true` trong `.env` của server.
> 3. `passwordReset: true` trong [site-js/config.js](site-js/config.js).
>
> Có unit test canh hai giá trị mặc định ở bước 2 và 3 không lệch nhau.

Mô tả luồng (để tham chiếu khi bật lại):

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
