#!/bin/bash
# Chạy local server cho VBSF prototype và tự mở index.html trong trình duyệt
cd "$(dirname "$0")"
PORT="${PORT:-8080}"
URL="http://localhost:$PORT/index.html"

python3 -m http.server "$PORT" &
SERVER_PID=$!

sleep 1
open "$URL"

trap "kill $SERVER_PID" EXIT
wait $SERVER_PID
