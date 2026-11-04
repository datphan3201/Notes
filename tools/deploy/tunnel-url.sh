#!/usr/bin/env bash
# shellcheck disable=SC2154  # settings come from the sourced /etc/planner/*.conf
set -euo pipefail

# Quick-tunnel URL sync. Installed by setup.sh as root-owned /usr/local/sbin/planner-tunnel-url and
# run by planner-tunnel.service (ExecStartPost) each time the tunnel starts. Reads the hostname
# Cloudflare assigned from cloudflared's metrics server and writes it to APP_URL, which the CSRF
# origin check and mail links depend on, plus /etc/planner/public-url for humans.

# shellcheck source=lib/common.sh
. /usr/local/lib/planner/common.sh
# shellcheck source=/dev/null
. /etc/planner/hosting.conf

require_root

host=""
for _ in $(seq 1 60); do
    host="$(curl -fsS --max-time 2 "http://${TUNNEL_METRICS}/quicktunnel" 2>/dev/null | jq -r '.hostname // empty' 2>/dev/null || true)"
    if [ -n "${host}" ]; then
        break
    fi
    sleep 1
done
is_hostname "${host}" || die "cloudflared did not report a quick tunnel hostname on ${TUNNEL_METRICS}."

url="https://${host}"
env_set "${DEPLOY_PATH}/backend/.env" APP_URL "${url}"
printf '%s\n' "${url}" >/etc/planner/public-url
chmod 644 /etc/planner/public-url
logger -t planner-tunnel "Quick tunnel URL: ${url}"
echo "Quick tunnel URL: ${url}"
