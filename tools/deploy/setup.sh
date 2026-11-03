#!/usr/bin/env bash
# shellcheck disable=SC2034,SC2154  # globals are shared with the sourced lib/ and ingress/ files
set -euo pipefail

# Host provisioning for Ubuntu 24.04 LTS (amd64 or arm64: Oracle Cloud, another VM or a home
# server). Run it from the cloned repository; that clone becomes the deploy path (e.g. /srv/planner):
#   sudo bash tools/deploy/setup.sh [--ingress quick-tunnel|cloudflare-tunnel|direct] [options]
# Options:
#   --domain <host>             public hostname (cloudflare-tunnel and direct)
#   --email <address>           Let's Encrypt account (direct)
#   --skip-tls                  direct only: serve HTTP until DNS is ready
#   --tunnel-token-file <path>  cloudflare-tunnel: file holding the tunnel token (first run)
#   --user <name>               deploy user (default: the sudo caller)
#   --repo <owner/name>         GitHub repository polled for green commits (default: origin)
#   --branch <name>             deployed branch (default: main)
#   --no-auto-deploy            do not install the pull deployer timer
# The core (packages, MySQL 8.4, .env, permissions, backups, scheduler, releases, pull-based CD)
# is shared; only the ingress differs. Re-run with another --ingress to switch: MySQL data,
# generated credentials, backend/.env and backup.conf are kept.

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
DEPLOY_PATH="$(cd "${SCRIPT_DIR}/../.." && pwd)"
# shellcheck source=lib/common.sh
. "${SCRIPT_DIR}/lib/common.sh"
# shellcheck source=lib/host.sh
. "${SCRIPT_DIR}/lib/host.sh"
# shellcheck source=lib/cloudflared.sh
. "${SCRIPT_DIR}/lib/cloudflared.sh"

INGRESS="quick-tunnel"
DOMAIN=""
EMAIL=""
SKIP_TLS=false
TUNNEL_TOKEN_FILE=""
DEPLOY_USER="${SUDO_USER:-ubuntu}"
GITHUB_REPO=""
DEPLOY_BRANCH="main"
AUTO_DEPLOY=true

PHP_VERSION="8.5"
WEB_GROUP="www-data"
CONFIG_DIR="/etc/planner"
HOSTING_CONF="${CONFIG_DIR}/hosting.conf"
BACKUP_DIR="/var/backups/planner"
MYSQL_IMAGE="mysql:8.4"
MYSQL_CONTAINER="planner-mysql"
MYSQL_DATA="/var/lib/planner-mysql"
DB_NAME="planner"
DB_USER="planner"
ENV_FILE="${DEPLOY_PATH}/backend/.env"
LOCAL_APP_PORT="8080"
TUNNEL_METRICS="127.0.0.1:20241"
CI_WORKFLOW="ci-cd.yml"
DEPLOY_INTERVAL="2min"
PUBLIC_URL=""

usage() {
    sed -n '5,16p' "${BASH_SOURCE[0]}" | sed 's/^# \{0,1\}//' >&2
}

while [ $# -gt 0 ]; do
    case "$1" in
        --ingress) INGRESS="${2:-}"; shift 2 ;;
        --domain) DOMAIN="${2:-}"; shift 2 ;;
        --email) EMAIL="${2:-}"; shift 2 ;;
        --skip-tls) SKIP_TLS=true; shift ;;
        --tunnel-token-file) TUNNEL_TOKEN_FILE="${2:-}"; shift 2 ;;
        --user) DEPLOY_USER="${2:-}"; shift 2 ;;
        --repo) GITHUB_REPO="${2:-}"; shift 2 ;;
        --branch) DEPLOY_BRANCH="${2:-}"; shift 2 ;;
        --no-auto-deploy) AUTO_DEPLOY=false; shift ;;
        -h | --help) usage; exit 0 ;;
        *) echo "Unknown option: $1" >&2; usage; exit 1 ;;
    esac
done

require_root
case "${INGRESS}" in
    quick-tunnel | cloudflare-tunnel | direct) ;;
    *) usage; die "--ingress must be quick-tunnel, cloudflare-tunnel or direct." ;;
esac
# shellcheck source=ingress/quick-tunnel.sh
. "${SCRIPT_DIR}/ingress/${INGRESS}.sh"
ingress_validate

if [ "${DEPLOY_USER}" = "root" ] || ! id "${DEPLOY_USER}" >/dev/null 2>&1; then
    die "Deploy user '${DEPLOY_USER}' must be an existing non-root user."
fi
[ -f "${DEPLOY_PATH}/backend/composer.json" ] || die "Run this script from a clone of the repository."
is_safe_path "${DEPLOY_PATH}" || die "Deploy path ${DEPLOY_PATH} must contain only letters, digits, '.', '_', '-' and '/'."
[[ "${DEPLOY_BRANCH}" =~ ^[A-Za-z0-9._/-]+$ ]] || die "--branch contains unsupported characters."
if [ -z "${GITHUB_REPO}" ]; then
    GITHUB_REPO="$(git -c safe.directory="${DEPLOY_PATH}" -C "${DEPLOY_PATH}" remote get-url origin 2>/dev/null \
        | sed -nE 's#^(https://github\.com/|git@github\.com:|ssh://git@github\.com/)##p' | sed -E 's#/$##; s#\.git$##')"
fi
if [ "${AUTO_DEPLOY}" = true ]; then
    [[ "${GITHUB_REPO}" =~ ^[A-Za-z0-9_.-]+/[A-Za-z0-9_.-]+$ ]] \
        || die "Cannot tell the GitHub repository from origin; pass --repo owner/name or --no-auto-deploy."
fi

# shellcheck source=/dev/null
. /etc/os-release
[ "${VERSION_ID:-}" = "24.04" ] || warn "tested on Ubuntu 24.04 LTS; this host reports ${PRETTY_NAME:-unknown}."

export DEBIAN_FRONTEND=noninteractive
TOTAL_MEM_MB="$(awk '/MemTotal/ {print int($2/1024)}' /proc/meminfo)"

install_runtime_packages
ensure_swap
install_docker
prepare_deploy_tree
start_mysql
ensure_app_env
APP_URL_VALUE="$(ingress_app_url)"
if [ -n "${APP_URL_VALUE}" ]; then
    env_set "${ENV_FILE}" APP_URL "${APP_URL_VALUE}"
fi
write_backup_conf
write_hosting_conf
install_root_helpers

log "Running the release as ${DEPLOY_USER}..."
sudo -u "${DEPLOY_USER}" -H bash "${DEPLOY_PATH}/tools/deploy/release.sh" --build-frontend

case "${INGRESS}" in
    quick-tunnel | cloudflare-tunnel) ;;
    *) disable_tunnel ;;
esac
write_nginx_site "$(ingress_public_server)" "${INGRESS_TRUSTS_CLOUDFLARE}"
curl -fsS --retry 5 --retry-delay 2 --retry-all-errors "http://127.0.0.1:${LOCAL_APP_PORT}/up" >/dev/null \
    || die "The local app server does not answer /up; inspect /var/log/nginx/error.log and ${DEPLOY_PATH}/backend/storage/logs."
ingress_install
install_pull_deployer

log "Host provisioning completed (ingress: ${INGRESS})."
echo
echo "Site:          ${PUBLIC_URL} (health check: ${PUBLIC_URL}/up)"
echo "Database:      MySQL ${MYSQL_VERSION} in container ${MYSQL_CONTAINER}, data in ${MYSQL_DATA}"
echo "Backups:       ${BACKUP_DIR} (nightly and before every release; set RCLONE_REMOTE in ${CONFIG_DIR}/backup.conf for off-site copies)"
if [ "${AUTO_DEPLOY}" = true ]; then
    echo "Deployments:   green ${DEPLOY_BRANCH} commits of ${GITHUB_REPO} every ${DEPLOY_INTERVAL}; logs: journalctl -u planner-deploy"
fi
echo
echo "Next steps:"
ingress_summary
echo "  - Configure MAIL_* (and optional AI_*) in ${ENV_FILE}; there is no local mail transport."
