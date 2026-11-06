#!/usr/bin/env bash
# Run Planner from this checkout and expose it at a fixed public HTTPS address with Tailscale
# Funnel (https://<machine>.<tailnet>.ts.net), in one command.
#
#   bash tools/dev/funnel.sh [--port 8000] [--realtime-port 8090] [--no-build] [--no-realtime] [--yes]
#
# Unlike tools/dev/tunnel.sh the address does not change between runs, so links in emails keep
# working. One Funnel serves both the site and live collaboration (/realtime on the same name).
# backend/.env is not edited: the public URL is passed to PHP as an environment override.
# Ctrl+C stops the app and turns this Funnel off again.
#
# One-time setup: install Tailscale, run `sudo tailscale up`, enable HTTPS certificates and
# Funnel for the tailnet in the admin console, and `sudo tailscale set --operator=$USER` so this
# script can configure Funnel without sudo. See docs/operations/local-development.md.
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
        -h | --help) sed -n '2,14p' "$0" | sed 's/^# \{0,1\}//'; exit 0 ;;
        *) echo "Unknown option: $1" >&2; exit 1 ;;
    esac
done

# shellcheck source=tools/dev/lib.sh
. "$(dirname "${BASH_SOURCE[0]}")/lib.sh"

# --- Tailscale ----------------------------------------------------------------------------------
command -v tailscale >/dev/null \
    || die "Tailscale is not installed. Install it (curl -fsSL https://tailscale.com/install.sh | sh), then run: sudo tailscale up"
STATE="$(tailscale status --json 2>/dev/null || true)"
# PHP reads the status JSON so no extra tool (jq) is needed.
HOST="$(printf '%s' "${STATE}" | php -r '$s = json_decode(stream_get_contents(STDIN), true);
    if (($s["BackendState"] ?? "") === "Running") echo rtrim((string) ($s["Self"]["DNSName"] ?? ""), ".");')"
[ -n "${HOST}" ] || die "Tailscale is not connected. Run: sudo tailscale up"
case "${HOST}" in
    *.ts.net) ;;
    *) die "This machine has no MagicDNS name (${HOST:-none}); turn on MagicDNS and HTTPS certificates in the Tailscale admin console." ;;
esac

require_runtime
prepare_database
build_frontend

export APP_URL="https://${HOST}"
if [ "${REALTIME}" = true ]; then
    # Same origin: the browser opens wss://<host>/realtime, which Funnel forwards below.
    export REALTIME_ENABLED=true REALTIME_LISTEN="127.0.0.1:${RT_PORT}" REALTIME_PUBLIC_URL="wss://${HOST}/realtime"
else
    export REALTIME_ENABLED=false
fi
start_app

# Turns off only the handlers this script added, so other Serve/Funnel settings stay.
funnel_off() {
    tailscale funnel --https=443 --set-path=/realtime off >/dev/null 2>&1 || true
    tailscale funnel --https=443 off >/dev/null 2>&1 || true
}
CLEANUP_HOOK=funnel_off

say "Opening Tailscale Funnel at https://${HOST} …"
say "If Tailscale prints a link to enable Funnel, open it; this continues once Funnel is on."
funnel_error="${LOG_DIR}/funnel.log"
# Shown as well as logged: on first use Tailscale prints an approval link and waits for it.
if ! tailscale funnel --bg --https=443 "http://127.0.0.1:${APP_PORT}" 2>&1 | tee "${funnel_error}"; then
    die "Tailscale refused to open the Funnel. Check that HTTPS certificates and Funnel are enabled for this tailnet, and run once: sudo tailscale set --operator=\$USER"
fi
if [ "${REALTIME}" = true ]; then
    tailscale funnel --bg --https=443 --set-path=/realtime "http://127.0.0.1:${RT_PORT}" >>"${funnel_error}" 2>&1 \
        || { cat "${funnel_error}" >&2; die "Tailscale could not route /realtime to the live collaboration server."; }
fi

wait_until_up

cat <<EOF

  Planner is public at:  ${APP_URL}   (fixed for this machine)
                         The first time, public DNS can take a few minutes to know this name.
  Live collaboration:    $([ "${REALTIME}" = true ] && echo "on (wss://${HOST}/realtime)" || echo off)
  Local:                 http://127.0.0.1:${APP_PORT} (sign in through the public URL; cookies are HTTPS-only)
  Logs:                  ${LOG_DIR}

  Anyone with the URL can reach this machine's app and database. Press Ctrl+C to stop.

EOF
wait -n "${PIDS[@]}" || true
say "A process exited; see the logs above."
