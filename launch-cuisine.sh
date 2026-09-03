#!/usr/bin/env bash
set -u

DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PORT="${CUISINE_PORT:-8080}"
URL="http://127.0.0.1:${PORT}/?v=3"
PIDFILE="$DIR/.cuisine-server.pid"
LOGFILE="$DIR/.cuisine-server.log"

cd "$DIR"

is_up() {
  if command -v curl >/dev/null 2>&1; then
    curl -fsS --max-time 1 "http://127.0.0.1:${PORT}/" >/dev/null 2>&1
  else
    python3 - "$PORT" <<'PY' >/dev/null 2>&1
import socket, sys
s=socket.socket(); s.settimeout(.5)
try:
    s.connect(('127.0.0.1', int(sys.argv[1])))
except Exception:
    raise SystemExit(1)
finally:
    s.close()
PY
  fi
}

if ! command -v python3 >/dev/null 2>&1; then
  echo "Python 3 est nécessaire pour lancer Cuisine."
  exit 1
fi

if ! is_up; then
  # Clean an obsolete PID file.
  if [[ -f "$PIDFILE" ]]; then
    oldpid="$(cat "$PIDFILE" 2>/dev/null || true)"
    if [[ -n "$oldpid" ]] && ! kill -0 "$oldpid" 2>/dev/null; then rm -f "$PIDFILE"; fi
  fi

  nohup python3 -m http.server "$PORT" --bind 127.0.0.1 >"$LOGFILE" 2>&1 &
  pid=$!
  echo "$pid" > "$PIDFILE"

  for _ in {1..30}; do
    is_up && break
    sleep .1
  done
fi

# Open directly in the default browser.
if command -v xdg-open >/dev/null 2>&1; then
  xdg-open "$URL" >/dev/null 2>&1 &
elif command -v gio >/dev/null 2>&1; then
  gio open "$URL" >/dev/null 2>&1 &
elif command -v firefox >/dev/null 2>&1; then
  firefox "$URL" >/dev/null 2>&1 &
elif command -v chromium >/dev/null 2>&1; then
  chromium "$URL" >/dev/null 2>&1 &
else
  echo "Cuisine est lancée : $URL"
fi

exit 0
