# Triển khai VBSF (CI/CD)

**Build chạy trên GitHub Actions, không build trên server.** Runner cài phụ
thuộc + build admin panel Strapi, đóng gói thành một *release* hoàn chỉnh rồi
rsync sang server; server chỉ đổi symlink và restart systemd. Server production
vì thế chỉ cần một môi trường sạch: **nvm + Node, Postgres, nginx** — không
Docker, không git checkout, không toolchain build.

Nhánh trigger là **`develop`**. Push lên `main` không deploy gì cả.

| Nguồn | Thư mục | Domain | Workflow |
|---|---|---|---|
| VBSF Web (tĩnh) | `index.html`, `pages/`, `site-js/` | `vbsf.vn` | `.github/workflows/deploy-web.yml` |
| VBSF CMS (tĩnh) | `cms.html`, `cms-js/` | `cms.vbsf.vn` (root) | `.github/workflows/deploy-cms.yml` |
| Strapi backend | `strapi-backend/` | `cms.vbsf.vn` (`/admin`, `/api`, `/uploads`, …) | `.github/workflows/deploy-strapi.yml` |

Strapi không có domain riêng — nginx reverse-proxy dưới cùng domain với CMS (xem
`deploy/nginx/cms.vbsf.vn.conf`), vì hiện chỉ có 2 domain được cấp.

## Kiến trúc

```
GitHub (nhánh develop)
   │  push
   ▼
GitHub Actions runner ── npm ci + strapi build ── rsync ──┐
   │  (verify: test + security scan trước khi build)       │
   ▼                                                       ▼
                                   ┌──────────────────────────────────────┐
 Internet ──▶ nginx (80/443) ──────┤ /var/www/vbsf-web      file tĩnh      │ vbsf.vn
                                   │ /var/www/vbsf-cms      file tĩnh      │ cms.vbsf.vn (/)
                                   │ 127.0.0.1:1337         systemd        │ cms.vbsf.vn (/admin,/api,…)
                                   │   └─ vbsf-strapi.service (Node/nvm)   │
                                   │        └─▶ Postgres 127.0.0.1:5432    │
                                   └──────────────────────────────────────┘
```

Bố cục trên server:

```
/opt/vbsf/
├── releases/
│   ├── 20261018093012-a1b2c3d/   ← release cũ (giữ 5 bản gần nhất)
│   └── 20261018140233-e4f5g6h/   ← release mới, đã build sẵn + node_modules
├── current -> releases/20261018140233-e4f5g6h   ← symlink, đổi khi deploy
└── shared/                       ← sống lâu hơn mọi release
    ├── .env                      bí mật + cấu hình (không bao giờ nằm trong git)
    ├── uploads/                  file người dùng tải lên
    └── .tmp/                     cache runtime
```

Mỗi release là một thư mục độc lập. `rsync --link-dest` hardlink những file
không đổi so với release đang chạy, nên dù `node_modules` nặng vài trăm MB thì
mỗi lần deploy thực tế chỉ truyền phần thay đổi. Deploy = đổi symlink + restart
(vài giây), rollback cũng chỉ là đổi symlink ngược lại.

`shared/` được symlink vào từng release (`.env`, `public/uploads`, `.tmp`) nên
xoá release cũ không bao giờ đụng tới dữ liệu.

## Thiết lập server lần đầu

Yêu cầu: Ubuntu/Debian x86-64, có `sudo`, đã cài sẵn `nvm` cho user deploy.
(Runner build trên `ubuntu-latest` x86-64; server ARM thì phải đổi runner sang
`ubuntu-24.04-arm` để native module khớp kiến trúc.)

### 1. Lấy mã nguồn để chạy script cài đặt

```bash
git clone https://github.com/biadivn/vbsf.git ~/vbsf-setup
```

Checkout này **chỉ dùng cho lần cài đặt này**. Deploy về sau không đọc tới nó —
mã chạy thật đến từ release do CI đẩy sang.

### 2. Chạy bootstrap

```bash
~/vbsf-setup/deploy/scripts/bootstrap-server.sh
```

Script (idempotent, chạy lại được) làm toàn bộ phần lặp đi lặp lại:

- `apt install` nginx, postgresql, certbot, rsync, build-essential;
- `nvm install` đúng phiên bản Node trong `.nvmrc`, đặt làm default;
- tạo `/opt/vbsf/{releases,shared}`, `/var/www/vbsf-web`, `/var/www/vbsf-cms`
  và chown cho user deploy;
- tạo `/opt/vbsf/shared/.env` từ `.env.example`, **tự sinh** `APP_KEYS` và các
  `*_SECRET`/`ENCRYPTION_KEY`/`DATABASE_PASSWORD` bằng `openssl rand`;
- tạo role + database Postgres khớp với `.env` (kể cả `GRANT` trên schema
  `public` mà Postgres 15+ không còn cấp mặc định);
- cài `vbsf-strapi.service` + `/etc/sudoers.d/vbsf-deploy` (chỉ cho phép CI
  `systemctl restart vbsf-strapi`, không phải sudo toàn phần) và thêm user vào
  group `systemd-journal` để đọc log không cần sudo;
- cài 2 file nginx, `nginx -t` rồi reload.

Sau đó mở `/opt/vbsf/shared/.env` sửa cho khớp thật:

```bash
nano /opt/vbsf/shared/.env    # PUBLIC_URL, PUBLIC_SITE_URL, PASSWORD_RESET_ENABLED…
```

> `.env` được **systemd đọc trực tiếp** qua `EnvironmentFile`, không qua shell:
> mỗi dòng phải là `KEY=VALUE` thuần — không `export`, không `$BIEN`, không nối
> dòng. Giá trị có khoảng trắng thì bọc trong `"`.

### 3. DNS + HTTPS

Trỏ `vbsf.vn` (và `www.vbsf.vn` nếu dùng) cùng `cms.vbsf.vn` về IP server, rồi:

```bash
sudo certbot --nginx -d vbsf.vn -d www.vbsf.vn -d cms.vbsf.vn
```

`certbot --nginx` tự thêm block HTTPS + redirect vào 2 file cấu hình.

### 4. Khoá SSH cho CI

Tạo cặp khoá **riêng cho CI** (đừng dùng khoá cá nhân), trên máy của bạn:

```bash
ssh-keygen -t ed25519 -f vbsf-deploy-key -N "" -C "github-actions-deploy"
```

- Public key (`vbsf-deploy-key.pub`) → `~/.ssh/authorized_keys` của user deploy
  trên server.
- Private key (`vbsf-deploy-key`) → GitHub Secret `DEPLOY_SSH_KEY`.

Server **không** cần deploy key của GitHub nữa: nó không còn `git clone`/`pull`
gì cả, mã nguồn đi một chiều từ runner sang qua rsync.

### 5. GitHub Secrets / Variables

Repo → Settings → Secrets and variables → Actions.

**Secrets:**

| Tên | Nội dung |
|---|---|
| `DEPLOY_HOST` | IP hoặc hostname server |
| `DEPLOY_USER` | user SSH dùng để deploy |
| `DEPLOY_SSH_KEY` | private key tạo ở bước 4 |
| `DEPLOY_PORT` | port SSH (bỏ trống nếu là 22) |

**Variables** (đều có mặc định trong workflow):

| Tên | Mặc định |
|---|---|
| `DEPLOY_ROOT` | `/opt/vbsf` |
| `WEB_ROOT` | `/var/www/vbsf-web` |
| `CMS_ROOT` | `/var/www/vbsf-cms` |

Tạo thêm **Environment** tên `production-vbsf-vn` (Settings → Environments) —
cả 3 workflow deploy qua environment này; bật "required reviewers" ở đây nếu
muốn duyệt tay trước mỗi lần lên production.

> Tên khác `production` là có chủ đích: environment cũ đó trỏ về server
> biadi.vn. **Đặt 4 secret ở cấp environment này**, không phải cấp repo —
> secret của environment ghi đè secret repo trùng tên, nhờ vậy `DEPLOY_HOST`
> của server cũ không kéo nhầm bản deploy mới về máy cũ.

### 6. Deploy lần đầu + tài khoản admin

Push lên `develop` (hoặc Actions → chọn workflow → *Run workflow*). Khi Strapi đã
chạy, tạo admin đầu tiên bằng cách thêm vào `/opt/vbsf/shared/.env`:

```
BOOTSTRAP_ADMIN_EMAIL=admin@vbsf.vn
BOOTSTRAP_ADMIN_PASSWORD=<mật khẩu thật>
```

rồi `sudo systemctl restart vbsf-strapi`. Đăng nhập xong thì **xoá 2 dòng đó**
và restart lại.

## Luồng deploy hằng ngày

```
push lên develop
      │
      ├─ verify      npm ci → npm run verify (coverage ≥ 80%, không có CVE high/critical)
      ├─ build       npm ci → strapi build          (trên runner)
      ├─ ship        rsync --link-dest → /opt/vbsf/releases/<timestamp>-<sha>/
      └─ activate    bin/activate-release.sh trên server:
                       symlink shared → đổi `current` → systemctl restart
                       → poll http://127.0.0.1:1337/_health (tối đa 120s)
                       → health fail: tự trỏ `current` về release trước, restart lại
                       → dọn release cũ, giữ 5 bản gần nhất
```

Mỗi workflow chỉ chạy khi đúng thư mục của nó đổi (`paths:`), nên sửa một file
trong `cms-js/` không kéo theo restart Strapi.

Job `activate` fail = bản mới không lên được **và** production đã tự quay về
bản cũ. Đọc log ngay trong output của job (script in sẵn 60 dòng journal cuối).

## Vận hành

```bash
# Trạng thái + log
systemctl status vbsf-strapi
journalctl -u vbsf-strapi -f            # không cần sudo (group systemd-journal)

# Đổi .env rồi áp dụng
nano /opt/vbsf/shared/.env && sudo systemctl restart vbsf-strapi

# Rollback tay về một release bất kỳ
ls -lt /opt/vbsf/releases
/opt/vbsf/releases/<tên-release>/bin/activate-release.sh

# Backup database (nên cho vào cron hằng ngày)
pg_dump -h 127.0.0.1 -U vbsf_strapi vbsf_strapi | gzip > ~/backup/vbsf-$(date +%F).sql.gz

# Backup file upload
tar czf ~/backup/uploads-$(date +%F).tar.gz -C /opt/vbsf/shared uploads
```

Dữ liệu cần backup chỉ gồm **database Postgres** và **`/opt/vbsf/shared/uploads`**
(cộng với `shared/.env` để dựng lại nhanh). Release là sản phẩm build, mất thì
chạy lại workflow là có.

## Chạy local

Không đổi: `strapi-backend/docker-compose.yml` vẫn dùng cho máy dev (Strapi +
Postgres trong container), `./serve.sh` cho site tĩnh. Docker **chỉ còn cho local
và test** — production không dùng tới `Dockerfile`/`docker-compose*.yml` nữa, và
cũng không còn build/push image lên GHCR.

Nhớ: chạy local qua Docker thì `.env` phải là `HOST=0.0.0.0` và
`DATABASE_HOST=postgres`; trên server là `HOST=127.0.0.1` và
`DATABASE_HOST=127.0.0.1`.

## Sự cố thường gặp

| Triệu chứng | Nguyên nhân hay gặp |
|---|---|
| Job `activate` báo health fail, đã rollback | Sai `.env` (DB sai mật khẩu, thiếu `APP_KEYS`) hoặc migration lỗi — xem journal in trong log job |
| `Thiếu /opt/vbsf/shared/.env` | Chưa chạy `bootstrap-server.sh`, hoặc chạy bằng user khác |
| `sudo: a password is required` trong job activate | `/etc/sudoers.d/vbsf-deploy` chưa cài hoặc sai tên user |
| Strapi chạy nhưng `/admin` trả 502 | Service nghe sai cổng/sai `HOST` — phải là `127.0.0.1:1337` khớp `upstream` trong nginx |
| Deploy xong nhưng trình duyệt vẫn dùng JS cũ | Cloudflare cache — kiểm tra `?v=<sha>` đã đổi trong HTML chưa (bước stamp build id) |
| Sửa `deploy/scripts/*.sh` nhưng server vẫn chạy bản cũ | Script đi theo release: bản mới có hiệu lực từ chính lần deploy mang nó sang |
