#!/usr/bin/env bash
# Kích hoạt một release Strapi đã được CI build sẵn và rsync lên server.
#
# Chạy bởi .github/workflows/deploy-strapi.yml qua SSH:
#   /opt/vbsf/releases/<sha>/bin/activate-release.sh
# Chạy tay để quay về một bản cũ:
#   /opt/vbsf/releases/<sha-cũ>/bin/activate-release.sh
#
# Script KHÔNG build gì cả — mọi thứ (npm ci, strapi build) đã xong trên runner.
# Việc ở đây chỉ là: nối thư mục shared, đổi symlink `current`, restart service,
# kiểm tra health, và tự quay lại release trước nếu bản mới không lên được.
set -euo pipefail

RELEASE_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
ROOT="${VBSF_ROOT:-$(cd "$RELEASE_DIR/../.." && pwd)}"
SHARED="$ROOT/shared"
SERVICE="${SERVICE:-vbsf-strapi}"
HEALTH_TIMEOUT="${HEALTH_TIMEOUT:-120}"
RELEASES_KEEP="${RELEASES_KEEP:-5}"

log() { printf '\n==> %s\n' "$*"; }

# Chỉ một deploy chạy tại một thời điểm.
exec 200>"$ROOT/.deploy.lock"
flock 200

if [[ ! -f "$SHARED/.env" ]]; then
  echo "Thiếu $SHARED/.env — xem deploy/README.md bước thiết lập lần đầu." >&2
  exit 1
fi

PORT="$(sed -n 's/^PORT=//p' "$SHARED/.env" | tail -n1 | tr -d "\"'" | tr -d '[:space:]')"
HEALTH_URL="http://127.0.0.1:${PORT:-1337}/_health"

# Dữ liệu phải sống lâu hơn release: .env (bí mật), uploads (file người dùng
# tải lên), .tmp (cache runtime). Release chỉ mượn qua symlink, nên xoá release
# cũ không bao giờ đụng tới chúng.
link_shared() {
  local release="$1"
  mkdir -p "$SHARED/uploads" "$SHARED/.tmp" "$release/public"
  ln -sfn "$SHARED/.env" "$release/.env"
  rm -rf "$release/public/uploads" "$release/.tmp"
  ln -sfn "$SHARED/uploads" "$release/public/uploads"
  ln -sfn "$SHARED/.tmp" "$release/.tmp"
}

# ln -sfn vào symlink đang trỏ tới thư mục sẽ tạo link LỒNG BÊN TRONG thư mục đó
# chứ không thay thế nó. Tạo link tạm rồi mv -T mới là phép đổi nguyên tử đúng.
point_current_at() {
  local target="$1"
  ln -sfn "$target" "$ROOT/.current.new"
  mv -T "$ROOT/.current.new" "$ROOT/current"
}

wait_healthy() {
  local deadline=$((SECONDS + HEALTH_TIMEOUT))
  while (( SECONDS < deadline )); do
    if curl -fsS -o /dev/null --max-time 5 "$HEALTH_URL"; then
      return 0
    fi
    sleep 2
  done
  return 1
}

PREV_RELEASE=""
if [[ -L "$ROOT/current" ]]; then
  PREV_RELEASE="$(readlink -f "$ROOT/current")"
fi

log "Kích hoạt $(basename "$RELEASE_DIR") (trước đó: ${PREV_RELEASE:-chưa có})"
link_shared "$RELEASE_DIR"
point_current_at "$RELEASE_DIR"

log "Restart $SERVICE"
sudo systemctl restart "$SERVICE"

log "Chờ health $HEALTH_URL (tối đa ${HEALTH_TIMEOUT}s)"
if wait_healthy; then
  log "Đang chạy $(basename "$RELEASE_DIR")."

  # Dọn release cũ, luôn giữ lại bản đang chạy và bản liền trước để rollback
  # nhanh. Xoá bằng rm -rf an toàn: file dùng chung với release khác là hardlink
  # do rsync --link-dest tạo, xoá một bản không ảnh hưởng bản còn lại.
  if [[ -d "$ROOT/releases" ]]; then
    mapfile -t stale < <(
      find "$ROOT/releases" -mindepth 1 -maxdepth 1 -type d -printf '%T@ %p\n' \
        | sort -rn | tail -n +$((RELEASES_KEEP + 1)) | cut -d' ' -f2-
    )
    for dir in "${stale[@]:-}"; do
      [[ -n "$dir" && "$dir" != "$RELEASE_DIR" && "$dir" != "$PREV_RELEASE" ]] || continue
      echo "Xoá release cũ: $(basename "$dir")"
      rm -rf "$dir"
    done
  fi
  exit 0
fi

echo "!! Health check thất bại sau ${HEALTH_TIMEOUT}s. Log gần nhất:" >&2
journalctl -u "$SERVICE" -n 60 --no-pager >&2 || true

if [[ -z "$PREV_RELEASE" || ! -d "$PREV_RELEASE" || "$PREV_RELEASE" == "$RELEASE_DIR" ]]; then
  echo "!! Không có release trước để quay lại — service đang chết, cần xử lý tay." >&2
  exit 1
fi

log "Quay lại $(basename "$PREV_RELEASE")"
point_current_at "$PREV_RELEASE"
sudo systemctl restart "$SERVICE"
if wait_healthy; then
  echo "!! Đã rollback về $(basename "$PREV_RELEASE"). Bản $(basename "$RELEASE_DIR") KHÔNG được kích hoạt." >&2
else
  echo "!! Rollback cũng không lên được — service đang chết, cần xử lý tay trên server." >&2
fi
exit 1
