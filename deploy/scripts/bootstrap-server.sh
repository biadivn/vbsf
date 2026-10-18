#!/usr/bin/env bash
# Dựng server production VBSF từ một máy Ubuntu/Debian sạch (chỉ có sẵn nvm).
#
# Chạy MỘT LẦN, bằng user sẽ dùng để deploy (không chạy bằng root):
#   git clone https://github.com/biadivn/vbsf.git ~/vbsf-setup
#   ~/vbsf-setup/deploy/scripts/bootstrap-server.sh
#
# ~/vbsf-setup chỉ phục vụ cài đặt lần đầu; deploy về sau KHÔNG dùng checkout
# này — GitHub Actions build rồi rsync thẳng release sang /opt/vbsf.
#
# Script idempotent: chạy lại nhiều lần không hỏng gì, chỉ bổ sung phần thiếu.
set -euo pipefail

REPO_SRC="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"
ROOT="${VBSF_ROOT:-/opt/vbsf}"
WEB_ROOT="${WEB_ROOT:-/var/www/vbsf-web}"
CMS_ROOT="${CMS_ROOT:-/var/www/vbsf-cms}"
DEPLOY_USER="${DEPLOY_USER:-$USER}"
SERVICE=vbsf-strapi

log()  { printf '\n\033[1m==> %s\033[0m\n' "$*"; }
warn() { printf '\033[33m!! %s\033[0m\n' "$*" >&2; }
die()  { printf '\033[31m!! %s\033[0m\n' "$*" >&2; exit 1; }

[[ $EUID -ne 0 ]] || die "Đừng chạy bằng root — chạy bằng chính user deploy (script tự gọi sudo khi cần)."
command -v sudo >/dev/null || die "Cần sudo."
command -v apt-get >/dev/null || die "Script viết cho Ubuntu/Debian (apt). Server khác thì làm tay theo deploy/README.md."

# ---------------------------------------------------------------- 1. Gói hệ thống
log "Cài gói hệ thống"
sudo apt-get update -qq
# build-essential/python3: dự phòng cho native module (better-sqlite3, sharp)
# phải tự biên dịch khi npm không có bản prebuilt cho Node/arch của máy.
sudo apt-get install -y -qq \
  nginx postgresql postgresql-contrib \
  certbot python3-certbot-nginx \
  rsync curl git ca-certificates openssl \
  build-essential python3

# ---------------------------------------------------------------- 2. Node qua nvm
log "Node (nvm)"
export NVM_DIR="${NVM_DIR:-$HOME/.nvm}"
[[ -s "$NVM_DIR/nvm.sh" ]] || die "Không thấy nvm ở $NVM_DIR. Cài nvm trước rồi chạy lại."
set +u
# shellcheck disable=SC1091
. "$NVM_DIR/nvm.sh"
set -u
NODE_VERSION="$(tr -d '[:space:]' < "$REPO_SRC/.nvmrc")"
nvm install "$NODE_VERSION"
nvm alias default "$NODE_VERSION"
nvm use "$NODE_VERSION" >/dev/null
echo "Node $(node -v), npm $(npm -v)"

# ---------------------------------------------------------------- 3. Thư mục
log "Thư mục triển khai"
sudo mkdir -p "$ROOT/releases" "$ROOT/shared/uploads" "$ROOT/shared/.tmp" "$WEB_ROOT" "$CMS_ROOT"
sudo chown -R "$DEPLOY_USER:$DEPLOY_USER" "$ROOT" "$WEB_ROOT" "$CMS_ROOT"

# ---------------------------------------------------------------- 4. .env + bí mật
ENV_FILE="$ROOT/shared/.env"
set_env() {  # set_env KEY VALUE — thay dòng KEY=... (thêm mới nếu chưa có)
  local key="$1" value="$2"
  if grep -q "^$key=" "$ENV_FILE"; then
    python3 - "$ENV_FILE" "$key" "$value" <<'PY'
import sys
path, key, value = sys.argv[1], sys.argv[2], sys.argv[3]
lines = open(path, encoding='utf-8').read().splitlines(keepends=True)
out = [f'{key}={value}\n' if l.startswith(f'{key}=') else l for l in lines]
open(path, 'w', encoding='utf-8').writelines(out)
PY
  else
    printf '%s=%s\n' "$key" "$value" >> "$ENV_FILE"
  fi
}
secret() { openssl rand -base64 16; }

if [[ -f "$ENV_FILE" ]]; then
  log ".env đã có, giữ nguyên ($ENV_FILE)"
else
  log "Tạo $ENV_FILE và sinh bí mật thật"
  cp "$REPO_SRC/strapi-backend/.env.example" "$ENV_FILE"
  chmod 600 "$ENV_FILE"
  set_env APP_KEYS "$(secret),$(secret),$(secret),$(secret)"
  for key in API_TOKEN_SALT ADMIN_JWT_SECRET PUBLIC_AUTH_JWT_SECRET JWT_SECRET \
             TRANSFER_TOKEN_SALT ENCRYPTION_KEY; do
    set_env "$key" "$(secret)"
  done
  # Postgres chạy trên chính host này, không còn trong Docker network.
  set_env DATABASE_CLIENT postgres
  set_env DATABASE_HOST 127.0.0.1
  set_env DATABASE_PASSWORD "$(openssl rand -hex 24)"
  warn "Nhớ sửa PUBLIC_URL / PUBLIC_SITE_URL trong $ENV_FILE cho khớp domain thật."
fi

get_env() { sed -n "s/^$1=//p" "$ENV_FILE" | tail -n1 | tr -d "\"'"; }
DB_NAME="$(get_env DATABASE_NAME)";     DB_NAME="${DB_NAME:-vbsf_strapi}"
DB_USER="$(get_env DATABASE_USERNAME)"; DB_USER="${DB_USER:-vbsf_strapi}"
DB_PASS="$(get_env DATABASE_PASSWORD)"
[[ -n "$DB_PASS" && "$DB_PASS" != "changeme" ]] || die "DATABASE_PASSWORD trong $ENV_FILE chưa được đặt."

# ---------------------------------------------------------------- 5. Postgres
log "Postgres: role + database"
sudo systemctl enable --now postgresql
DB_PASS_SQL="${DB_PASS//\'/\'\'}"   # escape dấu nháy đơn cho chuỗi SQL
if sudo -u postgres psql -tAc "SELECT 1 FROM pg_roles WHERE rolname='$DB_USER'" | grep -q 1; then
  echo "Role $DB_USER đã có — đồng bộ lại mật khẩu theo .env"
  sudo -u postgres psql -qc "ALTER ROLE \"$DB_USER\" WITH LOGIN PASSWORD '$DB_PASS_SQL'"
else
  sudo -u postgres psql -qc "CREATE ROLE \"$DB_USER\" WITH LOGIN PASSWORD '$DB_PASS_SQL'"
fi
if sudo -u postgres psql -tAc "SELECT 1 FROM pg_database WHERE datname='$DB_NAME'" | grep -q 1; then
  echo "Database $DB_NAME đã có"
else
  sudo -u postgres createdb -O "$DB_USER" "$DB_NAME"
fi
# Từ Postgres 15, quyền CREATE trên schema public không còn mặc định cho mọi
# role — Strapi cần tự tạo bảng nên cấp tường minh.
sudo -u postgres psql -q -d "$DB_NAME" -c "GRANT ALL ON SCHEMA public TO \"$DB_USER\""

# ---------------------------------------------------------------- 6. systemd + sudo
log "systemd service $SERVICE"
sed "s/__DEPLOY_USER__/$DEPLOY_USER/g" "$REPO_SRC/deploy/systemd/vbsf-strapi.service" \
  | sudo tee "/etc/systemd/system/$SERVICE.service" >/dev/null
sudo systemctl daemon-reload
sudo systemctl enable "$SERVICE" >/dev/null
# Chưa start: /opt/vbsf/current chỉ tồn tại sau lần deploy đầu tiên từ CI.

log "Quyền restart không mật khẩu cho CI"
sudoers_tmp="$(mktemp)"
sed "s/__DEPLOY_USER__/$DEPLOY_USER/g" "$REPO_SRC/deploy/sudoers.d/vbsf-deploy" > "$sudoers_tmp"
sudo visudo -c -q -f "$sudoers_tmp" || die "File sudoers sinh ra không hợp lệ, không cài."
sudo install -m 440 -o root -g root "$sudoers_tmp" /etc/sudoers.d/vbsf-deploy
rm -f "$sudoers_tmp"
# Đọc log service không cần sudo.
sudo usermod -aG systemd-journal "$DEPLOY_USER"

# ---------------------------------------------------------------- 7. nginx
log "nginx"
for conf in vbsf.vn cms.vbsf.vn; do
  sudo cp "$REPO_SRC/deploy/nginx/$conf.conf" "/etc/nginx/sites-available/$conf"
  sudo ln -sfn "/etc/nginx/sites-available/$conf" "/etc/nginx/sites-enabled/$conf"
done
sudo rm -f /etc/nginx/sites-enabled/default
sudo nginx -t
sudo systemctl reload nginx

log "Xong phần tự động. Còn lại làm tay:"
cat <<NEXT

  1. Trỏ DNS vbsf.vn (và www.vbsf.vn) + cms.vbsf.vn về IP server này.
  2. Cấp HTTPS (chỉ chạy được sau khi DNS đã trỏ đúng):
       sudo certbot --nginx -d vbsf.vn -d www.vbsf.vn -d cms.vbsf.vn
  3. Thêm public key của CI vào ~/.ssh/authorized_keys, rồi đặt GitHub Secrets
     DEPLOY_HOST / DEPLOY_USER / DEPLOY_SSH_KEY (xem deploy/README.md).
  4. Đẩy commit lên nhánh develop (hoặc chạy workflow tay) để deploy lần đầu.
  5. Sau khi Strapi chạy, tạo admin đầu tiên: thêm BOOTSTRAP_ADMIN_EMAIL /
     BOOTSTRAP_ADMIN_PASSWORD vào $ENV_FILE rồi
       sudo systemctl restart $SERVICE
     đăng nhập xong thì xoá 2 dòng đó đi và restart lại.

NEXT
