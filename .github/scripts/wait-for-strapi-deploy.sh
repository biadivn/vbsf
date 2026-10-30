#!/usr/bin/env bash
# Chặn deploy frontend (site + CMS) cho tới khi Strapi của CÙNG commit lên xong.
#
# Vì sao cần: ba workflow deploy chạy song song, mà CMS/site chỉ là rsync file
# tĩnh (~20 giây) còn Strapi phải build admin panel, đẩy release và restart
# service (~4-5 phút). Nên có lúc trình duyệt chạy CMS MỚI nhưng gọi vào Strapi
# CŨ: thêm một field trong CMS là Strapi chối ngay với 400 "Invalid key <field>",
# nhìn y như lỗi code. Cứ thay đổi nào cần field mới là dính.
#
# Commit không đụng tới Strapi thì không chờ gì cả — giữ nguyên tốc độ deploy
# của những lần chỉ sửa giao diện.
set -euo pipefail

REPO="${GITHUB_REPOSITORY:?}"
SHA="${GITHUB_SHA:?}"

# Hai đường deploy dùng chung script này, chỉ khác tên workflow và danh sách
# đường dẫn kích hoạt nó:
#   main    → deploy-strapi.yml        (server mới vbsf.vn, systemd + release)
#   develop → legacy-deploy-strapi.yml (server cũ biadi.vn, Docker + GHCR)
# Workflow gọi script truyền hai biến dưới đây; không truyền thì mặc định là
# đường của server mới.
WORKFLOW="${STRAPI_WORKFLOW:-deploy-strapi.yml}"

# Đúng các đường dẫn kích hoạt workflow Strapi tương ứng. Sửa `paths` bên đó
# thì sửa luôn ở chỗ truyền biến này. Mặc định để trong NHÁY ĐƠN: `$` ở đây là
# neo cuối chuỗi của regex, nháy kép thì shell nuốt mất.
STRAPI_PATHS_DEFAULT='^(strapi-backend/|deploy/scripts/|deploy/systemd/|\.nvmrc$|\.github/workflows/deploy-strapi\.yml$)'
STRAPI_PATHS_RE="${STRAPI_PATHS_RE:-$STRAPI_PATHS_DEFAULT}"

# Lúc nào cũng CHỜ chứ không bao giờ bỏ qua vì "chưa thấy run": nếu không đọc
# được danh sách file thì coi như có đụng Strapi, thà chậm còn hơn deploy lệch.
changed="$(gh api "repos/$REPO/commits/$SHA" --jq '.files[].filename' 2>/dev/null || echo '__UNKNOWN__')"
if [[ "$changed" != '__UNKNOWN__' ]] && ! grep -qE "$STRAPI_PATHS_RE" <<<"$changed"; then
  echo "Commit này không đụng tới Strapi — deploy thẳng, không chờ."
  exit 0
fi

run_json() {
  gh api "repos/$REPO/actions/workflows/$WORKFLOW/runs?head_sha=$SHA&per_page=1" 2>/dev/null || echo '{}'
}

# Run của Strapi có thể chưa kịp sinh ra khi job này bắt đầu (cùng một push).
echo "Chờ run deploy-strapi của commit $SHA xuất hiện..."
run_id=""
for _ in $(seq 1 30); do   # tối đa 5 phút
  run_id="$(run_json | jq -r '.workflow_runs[0].id // empty')"
  [[ -n "$run_id" ]] && break
  sleep 10
done

if [[ -z "$run_id" ]]; then
  # Không có run nào: workflow Strapi bị tắt, hoặc paths bên đó đã đổi mà file
  # này chưa cập nhật. Không chặn deploy vì lý do đó — chỉ cảnh báo.
  echo "::warning::Không thấy run deploy-strapi cho commit này sau 5 phút — deploy tiếp."
  exit 0
fi

echo "Đang theo dõi run $run_id (https://github.com/$REPO/actions/runs/$run_id)"
for _ in $(seq 1 120); do   # tối đa 60 phút
  read -r status conclusion <<<"$(run_json | jq -r '.workflow_runs[0] | "\(.status) \(.conclusion // "-")"')"
  if [[ "$status" == "completed" ]]; then
    if [[ "$conclusion" == "success" ]]; then
      echo "Strapi đã lên xong — deploy tiếp."
      exit 0
    fi
    echo "::error::deploy-strapi kết thúc với trạng thái '$conclusion'. Dừng deploy frontend để site không gọi vào backend lệch phiên bản."
    exit 1
  fi
  echo "  deploy-strapi: $status ..."
  sleep 30
done

echo "::error::deploy-strapi chạy quá 60 phút. Dừng deploy frontend."
exit 1
