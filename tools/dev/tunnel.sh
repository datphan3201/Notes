#!/usr/bin/env bash
# Run Planner from this checkout and expose it through Cloudflare quick tunnels, in one command.
#
#   bash tools/dev/tunnel.sh [--port 8000] [--realtime-port 8090] [--no-build] [--no-realtime] [--yes]
#
# For a development machine that already runs the app (backend/.env and its database). It installs
# nothing and does not edit backend/.env: the public URLs are passed to PHP as environment
# overrides. Two quick tunnels are opened, one for the site and one for live collaboration,
# because PHP's built-in server cannot upgrade WebSocket requests. Ctrl+C stops everything.
#
# Quick tunnels get a new random https://*.trycloudflare.com URL on every start and have no uptime
# guarantee; use tools/deploy/setup.sh on a server for real hosting.
set -euo pipefail

APP_PORT=8000
RT_PORT=8090
BUILD=true
REALTIME=true
ASSUME_YES=false
while [ $# -gt 0 ]; do
    case "$1" in
        --port) APP_PORT="$2"; shift 2 ;;
        --realtime-port) RT_PORT="$2"; shift 2 ;;
        --no-build) BUILD=false; shift ;;
        --no-realtime) REALTIME=false; shift ;;
        --yes | -y) ASSUME_YES=true; shift ;;
        -h | --help) sed -n '2,12p' "$0" | sed 's/^# \{0,1\}//'; exit 0 ;;
        *) echo "Unknown option: $1" >&2; exit 1 ;;
    esac
done

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"
BACKEND="${ROOT}/backend"
RUN_DIR="$(mktemp -d "${TMPDIR:-/tmp}/planner-tunnel.XXXXXX")"
LOG_DIR="${BACKEND}/storage/logs/tunnel"
mkdir -p "${LOG_DIR}"
PIDS=()

say() { printf '\033[1;36m==>\033[0m %s\n' "$*"; }
die() { printf '\033[1;31mError:\033[0m %s\n' "$*" >&2; exit 1; }

cleanup() {
    trap - EXIT INT TERM
    if [ "${#PIDS[@]}" -gt 0 ]; then
        say "Stopping…"
        kill "${PIDS[@]}" 2>/dev/null || true
        wait "${PIDS[@]}" 2>/dev/null || true
    fi
    rm -rf "${RUN_DIR}"
}
trap cleanup EXIT INT TERM

port_free() { ! (exec 3<>"/dev/tcp/127.0.0.1/$1") 2>/dev/null; }

free_port() {
    local port="$1"
    while ! port_free "${port}"; do port=$((port + 1)); done
    echo "${port}"
}

# --- Prerequisites ------------------------------------------------------------------------------
CLOUDFLARED="$(command -v cloudflared || true)"
[ -n "${CLOUDFLARED}" ] || [ ! -x "${HOME}/.local/bin/cloudflared" ] || CLOUDFLARED="${HOME}/.local/bin/cloudflared"
[ -n "${CLOUDFLARED}" ] || die "cloudflared is not installed (https://developers.cloudflare.com/cloudflare-one/connections/connect-networks/downloads/)."
command -v php >/dev/null || die "php is not on PATH."
command -v curl >/dev/null || die "curl is not on PATH."
[ -f "${BACKEND}/.env" ] || die "backend/.env is missing; see docs/operations/installation.md."
[ -d "${BACKEND}/vendor" ] || die "backend/vendor is missing; run composer install in backend first."
port_free "${APP_PORT}" || die "Port ${APP_PORT} is in use (another PHP server?). Stop it or pass --port."
if [ "${REALTIME}" = true ]; then
    RT_PORT="$(free_port "${RT_PORT}")"
fi

# --- Database: refuse to serve an outdated schema -------------------------------------------------
cd "${BACKEND}"
# Checked on its own: inside a pipeline a failure would end the script without a word.
if ! STATUS="$(php bin/console migrate:status 2>/dev/null)"; then
    DB_TARGET="$(php -r 'require "vendor/autoload.php"; $c=(new Planner\Config\ConfigLoader)->load(getcwd()); echo $c->string("database.host"), ":", $c->int("database.port");' 2>/dev/null || echo "the configured host")"
    die "Cannot reach the database at ${DB_TARGET}. Start it first (for example Docker Desktop, or: sudo service mysql start), then run this again."
fi
PENDING="$(printf '%s\n' "${STATUS}" | awk '$1 == "pending" {print $2}')"
if [ -n "${PENDING}" ]; then
    DB_NAME="$(php -r 'require "vendor/autoload.php"; echo (new Planner\Config\ConfigLoader)->load(getcwd())->string("database.name");')"
    say "Database ${DB_NAME} has pending migrations:"
    printf '      %s\n' ${PENDING}
    if [ "${ASSUME_YES}" != true ]; then
        read -r -p "Back up ${DB_NAME} and apply them now? [y/N] " answer
        [[ "${answer}" =~ ^[Yy]$ ]] || die "The app needs these migrations; nothing was changed."
    fi
    BACKUP_DIR="${BACKEND}/storage/app/private/backups"
    mkdir -p "${BACKUP_DIR}"
    BACKUP="${BACKUP_DIR}/${DB_NAME}-$(date -u +%Y%m%dT%H%M%SZ).sql.gz"
    if command -v mysqldump >/dev/null; then
        # Credentials go through a private option file, never the command line.
        php -r 'require "vendor/autoload.php"; $c=(new Planner\Config\ConfigLoader)->load(getcwd());
            printf("[client]\nhost=%s\nport=%d\nuser=%s\npassword=\"%s\"\n", $c->string("database.host"), $c->int("database.port"),
            $c->string("database.user"), addcslashes($c->string("database.password"), "\\\""));' >"${RUN_DIR}/my.cnf"
        chmod 600 "${RUN_DIR}/my.cnf"
        mysqldump --defaults-extra-file="${RUN_DIR}/my.cnf" --single-transaction --no-tablespaces "${DB_NAME}" | gzip >"${BACKUP}"
        say "Backup written to ${BACKUP}"
    else
        [ "${ASSUME_YES}" = true ] || read -r -p "mysqldump is not installed, so no backup can be made. Continue anyway? [y/N] " answer
        [ "${ASSUME_YES}" = true ] || [[ "${answer}" =~ ^[Yy]$ ]] || die "Install the MySQL client tools (mysqldump) and run again."
    fi
    php bin/console migrate
fi
php bin/console migrate:check

# --- Frontend -----------------------------------------------------------------------------------
if [ "${BUILD}" = true ]; then
    command -v npm >/dev/null || die "npm is not on PATH (or pass --no-build)."
    say "Building the frontend…"
    (cd "${ROOT}/frontend" && { [ -d node_modules ] || npm ci --silent; } && npm run --silent build >/dev/null)
fi
[ -f "${BACKEND}/public/build/manifest.json" ] || die "No built assets; run without --no-build."

# --- Tunnels ------------------------------------------------------------------------------------
# Starts a quick tunnel to a local port and sets TUNNEL_HOST. Not a subshell, so PIDS keeps
# the cloudflared process and Ctrl+C stops it.
start_tunnel() {
    local name="$1" port="$2" metrics
    metrics="127.0.0.1:$(free_port $((20241 + RANDOM % 500)))"
    "${CLOUDFLARED}" tunnel --no-autoupdate --metrics "${metrics}" --url "http://127.0.0.1:${port}" \
        >"${LOG_DIR}/${name}-tunnel.log" 2>&1 &
    PIDS+=("$!")
    TUNNEL_HOST=""
    for _ in $(seq 1 60); do
        TUNNEL_HOST="$(curl -fsS --max-time 2 "http://${metrics}/quicktunnel" 2>/dev/null \
            | sed -n 's/.*"hostname":"\([^"]*\)".*/\1/p' || true)"
        [ -n "${TUNNEL_HOST}" ] && return 0
        sleep 1
    done
    die "cloudflared did not get a quick tunnel for ${name}; see ${LOG_DIR}/${name}-tunnel.log."
}

say "Opening Cloudflare quick tunnels…"
start_tunnel app "${APP_PORT}"
APP_HOST="${TUNNEL_HOST}"
export APP_URL="https://${APP_HOST}"
export VITE_DEV_URL=""
export SESSION_SECURE_COOKIE=true
if [ "${REALTIME}" = true ]; then
    start_tunnel realtime "${RT_PORT}"
    RT_HOST="${TUNNEL_HOST}"
    export REALTIME_ENABLED=true REALTIME_LISTEN="127.0.0.1:${RT_PORT}" REALTIME_PUBLIC_URL="wss://${RT_HOST}"
else
    export REALTIME_ENABLED=false
fi

# --- Application processes ----------------------------------------------------------------------
if [ "${REALTIME}" = true ]; then
    php bin/realtime.php >"${LOG_DIR}/realtime.log" 2>&1 &
    PIDS+=("$!")
fi
PHP_CLI_SERVER_WORKERS=4 php -d opcache.enable=0 -S "127.0.0.1:${APP_PORT}" -t public dev-router.php \
    >"${LOG_DIR}/php.log" 2>&1 &
PIDS+=("$!")

say "Waiting for the public URL to answer…"
for _ in $(seq 1 60); do
    curl -fsS --max-time 5 "${APP_URL}/up" >/dev/null 2>&1 && break
    sleep 2
done
curl -fsS --max-time 5 "${APP_URL}/up" >/dev/null 2>&1 || say "The tunnel is slow to answer; it usually works within a minute."

cat <<EOF

  Planner is public at:  ${APP_URL}
  Live collaboration:    $([ "${REALTIME}" = true ] && echo "on (wss://${RT_HOST})" || echo off)
  Local:                 http://127.0.0.1:${APP_PORT} (sign in through the public URL; cookies are HTTPS-only)
  Logs:                  ${LOG_DIR}

  Anyone with the URL can reach this machine's app and database. Press Ctrl+C to stop.

EOF
wait -n "${PIDS[@]}" || true
say "A process exited; see the logs above."
