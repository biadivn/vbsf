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

- Mặc định dùng SQLite, dữ liệu lưu ở Docker volume `strapi_data` (khớp
  `DATABASE_FILENAME=.tmp/data.db`) và file upload ở `strapi_uploads`.
- Container có healthcheck (`/_health`) — theo dõi bằng `docker compose ps`.
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

**Postgres thay vì SQLite (tuỳ chọn, chưa được kiểm thử trong môi trường này vì
máy dùng để build không cài Docker):**
```bash
docker compose --profile postgres up -d
```
rồi sửa `strapi.environment` trong `docker-compose.yml` (hoặc `.env`) thành
`DATABASE_CLIENT=postgres`, `DATABASE_HOST=postgres`, cùng
`DATABASE_NAME/USERNAME/PASSWORD` khớp với service `postgres`, và `docker compose up -d --build strapi` lại.

> **Đã kiểm thử thật:** `docker compose build && docker compose up -d` chạy được (qua
> Colima trên máy Apple Silicon), container `vbsf-strapi` đạt trạng thái `healthy`,
> `docker compose exec strapi npm run seed` nạp đủ 9 collection, và toàn bộ endpoint
> API công khai trả về đúng số bản ghi/đúng cấu trúc (kể cả components lồng nhau như
> `disciplines`). Lưu ý một fix đã áp dụng: healthcheck dùng `127.0.0.1` thay vì
> `localhost` vì `localhost` trong container phân giải ra `::1` (IPv6) trong khi Strapi
> chỉ lắng nghe IPv4.

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
- `node scripts/sync-cms-seed-source.js` — đồng bộ lại `scripts/cms-seed-source/`
  từ `../cms-js/seed-data.js` + `../cms-js/database-queries.js` gốc. Chạy lệnh này
  rồi build lại image mỗi khi seed data phía CMS thay đổi.
- `node scripts/smoke-test.js` (hoặc `npm run smoke-test`) — tạo + đọc lại + xoá 1
  member và 1 tournament mẫu để kiểm tra nhanh components/JSON fields hoạt động
  đúng, không để lại dữ liệu thừa.

## Đã kiểm tra

- Toàn bộ 7 collection types + 2 single types load không lỗi/không cảnh báo.
- Round-trip tạo → đọc (có populate components) → xoá qua Document Service — đúng dữ
  liệu, đúng cấu trúc.
- Toàn bộ 9 collection đã seed dữ liệu demo và trả về đúng số bản ghi qua API công khai
  (`GET /api/...`).
