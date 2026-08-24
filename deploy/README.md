# Triển khai VBSF (CI/CD)

Project có 3 nguồn triển khai độc lập, mỗi nguồn có workflow GitHub Actions riêng
(chỉ chạy khi đúng thư mục của nó thay đổi trên nhánh `main`):

| Nguồn | Thư mục | Domain | Workflow |
|---|---|---|---|
| VBSF Web (tĩnh) | `index.html`, `pages/` | `vbsf.biadi.vn` | `.github/workflows/deploy-web.yml` |
| VBSF CMS (tĩnh) | `cms.html`, `cms-js/` | `vbsf-cms.biadi.vn` (root) | `.github/workflows/deploy-cms.yml` |
| Strapi backend | `strapi-backend/` | `vbsf-cms.biadi.vn` (`/admin`, `/api`, `/uploads`, ...) | `.github/workflows/deploy-strapi.yml` |

Strapi không có domain riêng — được nginx reverse-proxy dưới cùng domain với CMS
(xem `deploy/nginx/vbsf-cms.biadi.vn.conf`), vì hiện chỉ có 2 domain được cấp và
CMS là nơi gọi tới API/admin của Strapi.

## Kiến trúc

```
                 ┌────────────────────┐        ┌─────────────────────────┐
 Internet ──────▶│  nginx (80/443)    │───────▶│ /var/www/vbsf-web        │  vbsf.biadi.vn
                 │                    │        │ (file tĩnh)              │
                 │                    │───────▶│ /var/www/vbsf-cms        │  vbsf-cms.biadi.vn  (/)
                 │                    │        │ (file tĩnh)              │
                 │                    │───────▶│ 127.0.0.1:1337 (Docker)  │  vbsf-cms.biadi.vn  (/admin,/api,...)
                 └────────────────────┘        │ ┌─────────┐ ┌──────────┐│
                                                │ │ strapi  │▶│ postgres ││
                                                │ └─────────┘ └──────────┘│
                                                │   (cùng docker-compose) │
                                                └─────────────────────────┘
```

- 2 site tĩnh (Web, CMS) do **nginx serve trực tiếp** — không cần pm2/Node cho phần
  này.
- Strapi **và** Postgres cùng chạy trong **Docker** qua `docker-compose.yml` có sẵn
  trong repo (service `strapi` + service `postgres`) — không cần cài database gì
  trên host, Strapi gọi Postgres qua tên service nội bộ `postgres:5432`. Dữ liệu
  Postgres lưu ở named volume `postgres_data`, persistent qua restart/rebuild
  container.
- `pm2` có sẵn trên server nhưng **không dùng cho project này** — không có tiến
  trình Node nào cần pm2 quản lý (frontend là file tĩnh, backend + DB chạy qua Docker).

## Thiết lập server lần đầu (làm thủ công 1 lần)

### 1. Checkout Git dùng chung cho mọi workflow

```bash
sudo mkdir -p /opt/vbsf
sudo chown $USER:$USER /opt/vbsf
git clone git@github.com:biadivn/vbsf.git /opt/vbsf
```

Mỗi lần deploy, workflow SSH vào server và chạy `git fetch && git reset --hard
origin/main` trong `/opt/vbsf`, sau đó rsync/deploy phần tương ứng ra vị trí thật.
`strapi-backend/.env` không nằm trong git (đã `.gitignore`) nên **không bị mất**
khi `git reset --hard`.

### 2. File `.env` cho Strapi (Postgres tự khởi tạo từ các biến này)

```bash
cd /opt/vbsf/strapi-backend
cp .env.example .env
```

Sửa `.env`: điền `APP_KEYS`/`*_SECRET`/`ENCRYPTION_KEY` thật (xem hướng dẫn generate
trong file), và đổi `DATABASE_PASSWORD` sang mật khẩu thật. Không cần tạo database
thủ công — container `postgres` tự tạo database/user từ `DATABASE_NAME`/
`DATABASE_USERNAME`/`DATABASE_PASSWORD` trong `.env` (map sang
`POSTGRES_DB`/`POSTGRES_USER`/`POSTGRES_PASSWORD`) **trong lần khởi tạo volume đầu
tiên** — nếu đổi các giá trị này sau khi đã `up` lần đầu, phải xoá volume
`postgres_data` cũ (`docker compose down -v`, sẽ mất dữ liệu) thì Postgres mới áp
dụng lại. Giữ nguyên `DATABASE_HOST=postgres` (tên service trong Docker network).

### 3. Đăng nhập GHCR trên server (nếu package Strapi image ở chế độ private)

Workflow build & push image lên `ghcr.io/biadivn/vbsf-strapi`. Nếu repo (và do đó
package) ở chế độ private, server cần đăng nhập 1 lần để `docker compose pull` hoạt
động:

```bash
echo '<PAT có quyền read:packages>' | docker login ghcr.io -u <github-username> --password-stdin
```

Đơn giản hơn: đổi visibility của package `vbsf-strapi` trên GitHub sang **Public**
(Settings → Packages) — khi đó server không cần đăng nhập gì cả.

### 4. Khởi động Strapi lần đầu

```bash
cd /opt/vbsf/strapi-backend
docker compose build
docker compose up -d
docker compose exec strapi npx strapi admin:create-user \
  -e admin@vbsf.local -p 'MẬT_KHẨU_THẬT' -f VBSF -l Admin
```

Các lần deploy sau, CI tự chạy `docker compose -f docker-compose.yml -f
docker-compose.prod.yml pull && up -d` bằng image build sẵn từ GitHub Actions —
không build lại trên server nữa.

### 5. Nginx + HTTPS

```bash
sudo cp deploy/nginx/vbsf.biadi.vn.conf /etc/nginx/sites-available/
sudo cp deploy/nginx/vbsf-cms.biadi.vn.conf /etc/nginx/sites-available/
sudo ln -s /etc/nginx/sites-available/vbsf.biadi.vn /etc/nginx/sites-enabled/
sudo ln -s /etc/nginx/sites-available/vbsf-cms.biadi.vn /etc/nginx/sites-enabled/
sudo mkdir -p /var/www/vbsf-web /var/www/vbsf-cms
sudo nginx -t && sudo systemctl reload nginx
sudo certbot --nginx -d vbsf.biadi.vn -d vbsf-cms.biadi.vn
```

`certbot --nginx` tự thêm block HTTPS + redirect vào 2 file cấu hình trên.

### 6. SSH deploy key

Tạo cặp khoá riêng cho CI (đừng dùng khoá cá nhân):

```bash
ssh-keygen -t ed25519 -f vbsf-deploy-key -N "" -C "github-actions-deploy"
```

- Public key (`vbsf-deploy-key.pub`) → thêm vào `~/.ssh/authorized_keys` của user
  deploy trên server.
- Private key (`vbsf-deploy-key`) → lưu vào GitHub Secret `DEPLOY_SSH_KEY`.

Quyền của user deploy trên server cần: quyền ghi vào `/opt/vbsf`, `/var/www/vbsf-web`,
`/var/www/vbsf-cms`, và chạy được lệnh `docker`/`docker compose` (nằm trong group
`docker`).

## GitHub Secrets / Variables cần thiết lập

Vào repo Settings → Secrets and variables → Actions:

**Secrets** (bắt buộc):
- `DEPLOY_HOST` — IP hoặc hostname của server
- `DEPLOY_USER` — user SSH dùng để deploy
- `DEPLOY_SSH_KEY` — private key tạo ở bước 7
- `DEPLOY_PORT` — port SSH (bỏ qua nếu dùng cổng mặc định 22)

**Variables** (tuỳ chọn, có giá trị mặc định trong workflow):
- `DEPLOY_REPO_PATH` (mặc định `/opt/vbsf`)
- `WEB_ROOT` (mặc định `/var/www/vbsf-web`)
- `CMS_ROOT` (mặc định `/var/www/vbsf-cms`)

Ngoài ra tạo GitHub **Environment** tên `production` (Settings → Environments) —
3 workflow đều deploy qua environment này, có thể bật "required reviewers" ở đây
nếu muốn duyệt thủ công trước khi deploy lên production.

## Kiểm tra Strapi persistent chưa mất dữ liệu

`strapi-backend/docker-compose.yml` mount 3 named volume:
- `postgres_data` → `/var/lib/postgresql/data` (toàn bộ dữ liệu nghiệp vụ — content,
  user, permission... — **bắt buộc** persistent)
- `strapi_uploads` → `/opt/app/public/uploads` (file upload thật — **bắt buộc** persistent)
- `strapi_data` → `/opt/app/.tmp` (cache/runtime)

Cả database lẫn file upload giờ đều nằm trong Docker named volume, nằm ngoài vòng
đời container hoàn toàn — `docker compose down`, rebuild image, hay xoá container
không đụng tới. Chỉ `docker compose down -v` mới xoá volume Docker; lệnh deploy
của CI không bao giờ dùng `-v`.

Đã kiểm thử thật trên máy build (2026-08-24): seed dữ liệu demo → `docker compose
down` (không `-v`, xoá cả container lẫn network) → `docker compose up -d` lại →
dữ liệu qua API vẫn nguyên vẹn (12/12 members), xác nhận `postgres_data` persistent
đúng như thiết kế.
