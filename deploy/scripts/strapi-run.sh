#!/usr/bin/env bash
# Điểm vào của systemd unit vbsf-strapi. Nằm trong release: /opt/vbsf/current/bin/.
#
# Node cài qua nvm (chỉ có trong shell tương tác) còn systemd chạy với PATH tối
# thiểu nên không tự thấy node. Script nạp nvm, chọn đúng phiên bản ghi trong
# .nvmrc của release, rồi exec thẳng binary strapi — exec để systemd theo dõi
# chính tiến trình node, tín hiệu stop/restart đi thẳng tới nơi cần.
set -euo pipefail

APP_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"

export NVM_DIR="${NVM_DIR:-$HOME/.nvm}"
if [[ ! -s "$NVM_DIR/nvm.sh" ]]; then
  echo "Không tìm thấy nvm ở $NVM_DIR — xem deploy/README.md phần cài Node." >&2
  exit 1
fi
# nvm.sh tham chiếu biến chưa khai báo, tắt -u quanh đoạn nạp.
set +u
# shellcheck disable=SC1091
. "$NVM_DIR/nvm.sh"
set -u

cd "$APP_DIR"
# .nvmrc được chép vào gốc release, nvm use đọc đúng phiên bản CI đã build.
nvm use --silent >/dev/null

exec node_modules/.bin/strapi start
