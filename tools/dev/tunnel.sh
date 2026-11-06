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
# guarantee; tools/dev/funnel.sh gives a fixed URL, tools/deploy/setup.sh real hosting.
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

# shellcheck source=tools/dev/lib.sh
. "$(dirname "${BASH_SOURCE[0]}")/lib.sh"

CLOUDFLARED="$(command -v cloudflared || true)"
[ -n "${CLOUDFLARED}" ] || [ ! -x "${HOME}/.local/bin/cloudflared" ] || CLOUDFLARED="${HOME}/.local/bin/cloudflared"
[ -n "${CLOUDFLARED}" ] || die "cloudflared is not installed (https://developers.cloudflare.com/cloudflare-one/connections/connect-networks/downloads/)."
require_runtime
prepare_database
build_frontend

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
export APP_URL="https://${TUNNEL_HOST}"
if [ "${REALTIME}" = true ]; then
    start_tunnel realtime "${RT_PORT}"
    RT_HOST="${TUNNEL_HOST}"
    export REALTIME_ENABLED=true REALTIME_LISTEN="127.0.0.1:${RT_PORT}" REALTIME_PUBLIC_URL="wss://${RT_HOST}"
else
    export REALTIME_ENABLED=false
fi

start_app
wait_until_up

cat <<EOF

  Planner is public at:  ${APP_URL}
  Live collaboration:    $([ "${REALTIME}" = true ] && echo "on (wss://${RT_HOST})" || echo off)
  Local:                 http://127.0.0.1:${APP_PORT} (sign in through the public URL; cookies are HTTPS-only)
  Logs:                  ${LOG_DIR}

  Anyone with the URL can reach this machine's app and database. Press Ctrl+C to stop.

EOF
wait -n "${PIDS[@]}" || true
say "A process exited; see the logs above."
