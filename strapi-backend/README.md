# VBSF Strapi Backend (local test only)

Backend collections mirroring the VBSF CMS prototype (`cms.html` + `cms-js/`), built to
be run and tested locally — not configured for deployment.

## Chạy — cách 1: npm trực tiếp

```bash
cd strapi-backend
npm run develop
```

- Admin panel: http://localhost:1337/admin
- Đăng nhập admin có sẵn: `admin@vbsf.local` / `Vbsf@Local2026`
- API công khai đã được bật quyền đọc (`find`/`findOne`) cho mọi collection bên dưới —
  xem `src/index.js` (`bootstrap`). Chỉ dùng cấu hình mở quyền này cho local/test.

## Chạy — cách 2: Docker / Docker Compose

```bash
cd strapi-backend
cp .env.example .env   # rồi điền APP_KEYS/JWT_SECRET/... thật, hoặc dùng .env đã có sẵn nếu đang có
docker compose build
docker compose up -d
```

- Mặc định trong `.env.example` dùng **Postgres chạy trong cùng docker-compose**
  (service `postgres`, image `postgres:16-alpine`) — không cần cài Postgres/MySQL
  gì trên host. Strapi kết nối qua tên service `postgres` trong mạng Docker nội bộ.
  Đổi `DATABASE_CLIENT=sqlite` trong `.env` nếu chỉ muốn chạy demo/local nhanh
  không cần Postgres.
- Dữ liệu Postgres lưu ở Docker volume `postgres_data`, file upload thật lưu ở
  `strapi_uploads` — cả hai đều persistent, sống ngoài vòng đời container (chỉ mất
  khi chủ động chạy `docker compose down -v`). Xem `deploy/README.md` ở thư mục gốc
  repo để biết toàn bộ quy trình CI/CD + thiết lập server production (nginx, GHCR,
  SSH deploy key).
- `strapi` service dùng `depends_on: postgres: condition: service_healthy` nên
  luôn chờ Postgres sẵn sàng trước khi khởi động — không cần chạy `docker compose up`
  nhiều lần vì lỗi kết nối DB lúc container postgres chưa kịp init.
- Container có healthcheck (`/_health`) — theo dõi bằng `docker compose ps`.
- **Đã kiểm thử thật với cấu hình Postgres hiện tại** (2026-08-24): `docker compose
  build && docker compose up -d` chạy được, `vbsf-strapi-db` đạt `healthy` trước,
  `vbsf-strapi` chờ đúng rồi mới start và đạt `healthy`; `npm run seed` nạp đủ dữ
  liệu vào Postgres (kiểm tra bằng `\dt` thấy đúng bảng, API trả đúng số bản ghi);
  `docker compose down` (không `-v`) rồi `up -d` lại — dữ liệu vẫn còn nguyên, xác
  nhận `postgres_data` persistent đúng như kỳ vọng.
- Nạp dữ liệu demo vào container đang chạy (volume mới sẽ trống, khác biệt với
  `.tmp/data.db` chạy ngoài host):
  ```bash
  docker compose exec strapi npm run seed
  ```
- Tạo admin đầu tiên trong container (nếu chưa tạo qua giao diện `/admin`):
  ```bash
  docker compose exec strapi npx strapi admin:create-user \
    -e admin@vbsf.local -p 'Vbsf@Local2026' -f VBSF -l Admin
  ```
- Xem log: `docker compose logs -f strapi`
- Dừng: `docker compose down` (thêm `-v` để xoá luôn volume dữ liệu)

> Lưu ý: healthcheck của service `strapi` dùng `127.0.0.1` thay vì `localhost` vì
> `localhost` trong container phân giải ra `::1` (IPv6) trong khi Strapi chỉ lắng
> nghe IPv4.

## Collections

| API endpoint | Tương ứng CMS | Ghi chú |
|---|---|---|
| `/api/tournaments` | Giải đấu | `format` (SE/DE/RR/SW), `mode`, `players`/`prizes` (components), `bracket`/`rr`/`sw` (JSON — trạng thái engine bốc thăm) |
| `/api/members` | Hội viên & Xếp hạng | `disciplines` (điểm/hạng/số trận riêng theo từng bộ môn), `freeMatches` (đấu tự do) |
| `/api/member-orgs` | Hội viên tổ chức | |
| `/api/news-articles` | Tin tức | draft & publish |
| `/api/partners` | Đối tác & Tài trợ | |
| `/api/library-docs` | Văn bản & Luật | có field `file` để upload tài liệu thật |
| `/api/media-items` | Thư viện Media | có field `assets` để upload ảnh/video thật |
| `/api/setting` (single type) | Thông tin tổ chức | |
| `/api/contact-info` (single type) | Liên hệ | |

Components dùng chung: `shared.prize`, `tournament.player` (có quan hệ tuỳ chọn tới
`member`), `member.discipline`, `member.free-match`.

## Scripts

- `node scripts/seed.js` (hoặc `npm run seed`) — nạp dữ liệu demo vào Strapi từ
  `scripts/cms-seed-source/` (idempotent — bỏ qua collection nào đã có dữ liệu).
  Chạy được cả ngoài host lẫn trong container vì không phụ thuộc thư mục `cms-js/`
  bên ngoài build context.
- `node scripts/migrate-website-content.js` (hoặc `npm run migrate:website`) — nạp
  **toàn bộ nội dung của website prototype tĩnh `VBSF Web.html`** vào Strapi:
  thông tin tổ chức, liên hệ, 10 tin tức, 6 văn bản/luật, 4 mục media, 15 đối tác,
  5 hội viên tổ chức, 23 hội viên cá nhân (kèm điểm/hạng theo từng bộ môn) và 7
  giải đấu (kèm bảng giải thưởng, thể lệ, và bracket 16 cơ thủ đang đá dở của giải
  đang diễn ra). Upsert theo khoá tự nhiên (`code` / `title` / `name`) nên chạy lại
  không tạo bản trùng.
  - `--dry-run` — chỉ in kế hoạch, không ghi.
  - `--update` — ghi đè cả bản ghi đã tồn tại theo prototype (mặc định chỉ tạo bản còn thiếu).
  - `--only=news,tournaments` — chạy một phần; nhóm hợp lệ: `settings`, `contact`,
    `news`, `library-docs`, `media-items`, `partners`, `member-orgs`, `members`,
    `tournaments`.

  Dữ liệu nguồn nằm ở `scripts/website-content.js` (module thuần dữ liệu). Chỗ nào
  prototype chỉ có placeholder — mã hội viên/SĐT/CCCD của cơ thủ chỉ xuất hiện
  trong bảng xếp hạng, tên nhà tài trợ chỉ là ô logo trống, ngày đăng của 2 tin
  trong block "Tin xem nhiều" — được sinh deterministic và đánh dấu `GENERATED`
  trong file đó.
- `node scripts/sync-cms-seed-source.js` — đồng bộ lại `scripts/cms-seed-source/`
  từ `../cms-js/seed-data.js` + `../cms-js/database-queries.js` gốc. Chạy lệnh này
  rồi build lại image mỗi khi seed data phía CMS thay đổi.
- `node scripts/smoke-test.js` (hoặc `npm run smoke-test`) — tạo + đọc lại + xoá 1
  member và 1 tournament mẫu để kiểm tra nhanh components/JSON fields hoạt động
  đúng, không để lại dữ liệu thừa.

## Kiểm thử & security gate (chặn trước khi build)

`npm run build` gọi `prebuild` → `npm run verify` = **unit test + security scan**.
Không có cờ bỏ qua: cả hai phải xanh thì `strapi build` mới chạy. CI cũng có job
`verify` riêng chạy trước job build image (xem `.github/workflows/deploy-strapi.yml`
và `deploy-web.yml`).

```bash
npm test            # unit test + ngưỡng coverage 80%
npm run security:scan
npm run verify      # cả hai
```

### Unit test — ngưỡng coverage 80%

Dùng test runner có sẵn của Node (`node:test`), **không thêm phụ thuộc nào**.
`scripts/run-tests.js` ép ngưỡng 80% cho cả line, branch và function; thêm
`--test-coverage-include-all` nên xoá bớt test sẽ làm coverage tụt xuống 0 chứ
không "đạt ngưỡng" bằng cách lặng lẽ bỏ test đi.

Phạm vi đo coverage được liệt kê tường minh trong `scripts/run-tests.js` — các
module logic thuần chạy được ngoài trình duyệt:

| Module | Vì sao đo |
|---|---|
| `src/utils/public-auth.js` | ký/đọc JWT, lọc field riêng tư, băm token |
| `src/utils/rate-limit.js` | cửa sổ trượt, hạn mức 10 RPS / 5 RPM |
| `src/utils/password-reset.js` | token dùng một lần, hết hạn, không lộ tài khoản |
| `src/api/*/controllers/*-auth.js` | kiểm tra đầu vào, trùng hồ sơ, upload ảnh |
| `src/api/*/controllers/{member,member-org}.js` | hàng rào lọc CCCD/SĐT với người đọc ẩn danh |
| `src/api/*/routes/*-auth.js` | bất biến: route công khai phải có rate limit |
| `scripts/website-content.js` | sơ đồ nhánh đấu + ràng buộc enum của schema |
| `../site-js/member-auth.js` | luồng đăng nhập/đăng ký phía site |

**Không** nằm trong phạm vi: mã cần DOM thật (`site-js/strapi-content.js`,
`cms-js/`, JS nội tuyến trong `index.html`) và phần khung do Strapi sinh — những
phần đó kiểm bằng chạy thật trên trình duyệt, không phải unit test. Muốn đưa vào
thì phải viết test DOM trước, không hạ ngưỡng.

> `site-js/` nằm ngoài build context của Docker; khi thiếu thì test tự bỏ qua và
> file bị loại khỏi phạm vi coverage (CI vẫn chạy đủ vì checkout cả repo).

### Security scan

`scripts/security-scan.js` fail build khi:

1. **Phụ thuộc** có lỗ hổng `high`/`critical` (npm audit) chưa được rà soát.
2. **Allowlist quá hạn** — mỗi ngoại lệ trong `scripts/security-allowlist.json`
   bắt buộc có `reason` + `reviewBy`; quá hạn là fail, không im lặng bỏ qua mãi.
3. **Secret bị commit** — khoá riêng tư PEM, AWS/GitHub/Slack/Google token, chuỗi
   kết nối có mật khẩu, hoặc file `.env` thật lọt vào git / vào image.
4. **Route công khai thiếu rate limit** — `auth: false` mà không có middleware.

Ngoại lệ đang mở: `GHSA-fx2h-pf6j-xcff` (vite, high) — `@strapi/strapi@5.52.1`
ghim vite@5.4.21, bản vá chỉ có ở vite >6.4.2. Lỗ hổng nằm ở dev server của vite
và chỉ khai thác được trên Windows; production là container Linux phục vụ admin
panel đã build sẵn. Hạn rà soát lại: **2026-11-30**.

## Đã kiểm tra

- Toàn bộ 7 collection types + 2 single types load không lỗi/không cảnh báo.
- Round-trip tạo → đọc (có populate components) → xoá qua Document Service — đúng dữ
  liệu, đúng cấu trúc.
- Toàn bộ 9 collection đã seed dữ liệu demo và trả về đúng số bản ghi qua API công khai
  (`GET /api/...`).
