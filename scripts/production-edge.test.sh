#!/usr/bin/env bash
set -euo pipefail

REPO_ROOT=$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)
TEST_ROOT=$(mktemp -d)
CONTAINER=""
cleanup() {
  if [[ -n "$CONTAINER" ]]; then docker rm -f "$CONTAINER" >/dev/null; fi
  rm -rf "$TEST_ROOT"
}
trap cleanup EXIT
fail() { echo "FAIL: $*" >&2; exit 1; }

mkdir -p "$TEST_ROOT/html/assets"
printf '<html><body>Planner fixture</body></html>' > "$TEST_ROOT/html/index.html"
printf 'console.log("asset")' > "$TEST_ROOT/html/assets/fixture.js"
printf '/* service worker */' > "$TEST_ROOT/html/sw.js"
cp "$REPO_ROOT/app/public/robots.txt" "$TEST_ROOT/html/robots.txt"
sed -e 's/listen 80;/listen 8081;/' -e 's|http://api:4000|http://127.0.0.1:8082|g' \
  "$REPO_ROOT/.docker/app/nginx.conf" > "$TEST_ROOT/app.conf"
cp "$REPO_ROOT/deploy/10-router.conf" "$TEST_ROOT/router.conf"
cat > "$TEST_ROOT/nginx.conf" <<'CONFIG'
events {}
http {
  include /etc/nginx/mime.types;
  upstream app_active { server 127.0.0.1:8081; }
  upstream api_active { server 127.0.0.1:8082; }
  map $host $planner_active_color { default blue; }
  server {
    listen 8082;
    add_header X-Content-Type-Options nosniff always;
    add_header X-Frame-Options SAMEORIGIN always;
    add_header Content-Security-Policy "default-src 'self'; frame-ancestors 'none'" always;
    location / { return 401 '{"error":"unauthorized"}'; }
  }
  include /test/app.conf;
  include /test/router.conf;
}
CONFIG
CONTAINER=$(docker run -d --rm -p 127.0.0.1::80 -p 127.0.0.1::8081 \
  -v "$TEST_ROOT:/test:ro" -v "$TEST_ROOT/html:/usr/share/nginx/html:ro" \
  "${NGINX_TEST_IMAGE:-nginx:alpine}" nginx -c /test/nginx.conf -g 'daemon off;')
ROUTER_PORT=$(docker port "$CONTAINER" 80/tcp | cut -d: -f2)
APP_PORT=$(docker port "$CONTAINER" 8081/tcp | cut -d: -f2)
for _attempt in {1..30}; do
  if curl -fsS "http://127.0.0.1:$ROUTER_PORT/" >/dev/null 2>&1; then break; fi
  sleep 0.1
done
fetch() {
  local port=$1 path=$2 expected=$3
  local status
  status=$(curl -sS -D "$TEST_ROOT/headers" -o "$TEST_ROOT/body" \
    -w '%{http_code}' "http://127.0.0.1:$port$path")
  [[ "$status" == "$expected" ]] || fail "$path returned $status, expected $expected"
}
header() {
  local name=$1 value=$2
  local count
  count=$(grep -ic "^$name:" "$TEST_ROOT/headers" || true)
  [[ "$count" == 1 ]] || fail "$name appears $count times"
  grep -i "^$name:" "$TEST_ROOT/headers" | grep -Fq "$value" || fail "$name missing $value"
}
for path in /daily/list /assets/fixture.js /sw.js /robots.txt /llms.txt /ai-catalog.json /api/v1/auth/me /.well-known/oauth-authorization-server /socket.io/; do
  expected=200
  case "$path" in /llms.txt|/ai-catalog.json) expected=404;; /api/*|/.well-known/*|/socket.io/*) expected=401;; esac
  fetch "$ROUTER_PORT" "$path" "$expected"
  header X-Content-Type-Options nosniff
  header X-Frame-Options DENY
  header Strict-Transport-Security max-age=31536000
  header Cross-Origin-Opener-Policy same-origin
  header Content-Security-Policy-Report-Only "default-src 'self'"
  header Content-Security-Policy-Report-Only "connect-src 'self' wss:"
  header Content-Security-Policy "frame-ancestors 'none'"
  if [[ "$expected" == 401 ]]; then
    header Content-Security-Policy "default-src 'self'"
  fi
done
fetch "$ROUTER_PORT" /robots.txt 200
header Content-Type text/plain
grep -q '^User-agent: \*$' "$TEST_ROOT/body" || fail 'robots.txt has no wildcard user agent'
grep -q '^Disallow: /$' "$TEST_ROOT/body" || fail 'private app must disallow crawling'
for port in "$APP_PORT" "$ROUTER_PORT"; do
  for path in /llms.txt /ai-catalog.json; do
    fetch "$port" "$path" 404
    ! grep -q 'Planner fixture' "$TEST_ROOT/body" || fail "$path returned SPA shell"
  done
done
echo 'PASS: router headers, single header values, private robots and crawler 404s (real nginx)'
