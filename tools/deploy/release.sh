#!/usr/bin/env bash
set -euo pipefail

# Production release helper following docs/operations/deployment.md.
# Usage:
#   bash tools/deploy/release.sh [--build-frontend] [--skip-backup]
# A verified database + private-storage backup is taken before migrations. --skip-backup
# exists only for hosts without the planner-backup helper and must not be used in production.

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"
BACKEND_DIR="${ROOT_DIR}/backend"
ENV_FILE="${BACKEND_DIR}/.env"
BACKUP_HELPER="/usr/local/sbin/planner-backup"
WEB_GROUP="www-data"
PHP_FPM_SERVICE="php8.5-fpm"
BUILD_FRONTEND=false
SKIP_BACKUP=false

usage() {
    echo "Usage: bash tools/deploy/release.sh [--build-frontend] [--skip-backup]" >&2
}

die() {
    echo "Error: $*" >&2
    exit 1
}

for arg in "$@"; do
    case "$arg" in
        --build-frontend)
            BUILD_FRONTEND=true
            ;;
        --skip-backup)
            SKIP_BACKUP=true
            ;;
        *)
            echo "Unknown option: $arg" >&2
            usage
            exit 1
            ;;
    esac
done

[ -f "${ENV_FILE}" ] || die "${ENV_FILE} is missing. Configure production environment variables before releasing."

# Last assignment of KEY in backend/.env, without surrounding quotes.
env_value() {
    sed -n "s/^$1=//p" "${ENV_FILE}" | tail -n 1 | sed -e 's/^"\(.*\)"$/\1/' -e "s/^'\(.*\)'$/\1/"
}

# Resolve a configured path the same way ConfigLoader does (relative to backend/).
backend_path() {
    case "$1" in
        /*) printf '%s\n' "$1" ;;
        *) printf '%s\n' "${BACKEND_DIR}/$1" ;;
    esac
}

can_use_web_group() {
    getent group "${WEB_GROUP}" >/dev/null 2>&1 && id -nG | tr ' ' '\n' | grep -qx "${WEB_GROUP}"
}

# PHP-FPM (www-data) and the deploy user both write here: setgid group plus default ACLs keep
# new files group-writable whichever of them creates them. Source files stay deploy-owned.
prepare_writable_dir() {
    local dir="$1" me
    mkdir -p "${dir}"
    can_use_web_group || return 0
    me="$(id -un)"
    find "${dir}" -user "${me}" -exec chgrp "${WEB_GROUP}" {} +
    find "${dir}" -type d -user "${me}" -exec chmod 2770 {} +
    find "${dir}" -type f -user "${me}" -exec chmod g+rw {} +
    if command -v setfacl >/dev/null 2>&1; then
        find "${dir}" -type d -user "${me}" -exec setfacl \
            -m "u:${me}:rwX,g:${WEB_GROUP}:rwX,d:u:${me}:rwX,d:g:${WEB_GROUP}:rwX" {} +
        find "${dir}" -type f -user "${me}" -exec setfacl -m "u:${me}:rw,g:${WEB_GROUP}:rw" {} +
    fi
}

echo "==> Releasing revision $(git -C "${ROOT_DIR}" rev-parse --short HEAD 2>/dev/null || echo unknown)"

# Secrets must be readable by PHP-FPM and the scheduler, never by other users.
if can_use_web_group; then
    chgrp "${WEB_GROUP}" "${ENV_FILE}"
fi
chmod 640 "${ENV_FILE}"

if [ "${BUILD_FRONTEND}" = true ]; then
    echo "==> Building frontend assets..."
    (
        cd "${ROOT_DIR}/frontend"
        npm ci
        npm run build
    )
fi

if [ ! -f "${BACKEND_DIR}/public/build/manifest.json" ]; then
    die "${BACKEND_DIR}/public/build/manifest.json is missing. Run with --build-frontend or sync prebuilt assets first."
fi

echo "==> Installing backend production dependencies..."
(
    cd "${BACKEND_DIR}"
    composer install --no-dev --prefer-dist --optimize-autoloader --no-interaction
    composer check-platform-reqs
)

echo "==> Preparing writable private storage and log directories..."
PRIVATE_ROOT="$(env_value PRIVATE_STORAGE_ROOT)"
LOG_PATH="$(env_value LOG_PATH)"
prepare_writable_dir "$(backend_path "${PRIVATE_ROOT:-storage/app/private}")"
prepare_writable_dir "$(dirname "$(backend_path "${LOG_PATH:-storage/logs/planner.log}")")"

if [ "${SKIP_BACKUP}" = true ]; then
    echo "==> WARNING: skipping the pre-migration backup (--skip-backup)." >&2
elif [ -x "${BACKUP_HELPER}" ]; then
    echo "==> Backing up database and private storage before migrations..."
    sudo -n "${BACKUP_HELPER}" pre-release
else
    die "${BACKUP_HELPER} is not installed, so no backup can be taken before migrating. Run tools/deploy/oracle-ubuntu-setup.sh, or pass --skip-backup only on a non-production host."
fi

echo "==> Applying and verifying forward database migrations..."
(
    cd "${BACKEND_DIR}"
    php bin/console migrate
    php bin/console migrate:status
    php bin/console migrate:check
)

if command -v systemctl >/dev/null 2>&1 && systemctl cat "${PHP_FPM_SERVICE}.service" >/dev/null 2>&1; then
    echo "==> Reloading ${PHP_FPM_SERVICE}..."
    sudo -n /usr/bin/systemctl reload "${PHP_FPM_SERVICE}"
fi

echo "==> Release completed successfully."
