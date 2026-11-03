#!/usr/bin/env bash
set -euo pipefail

# Production release helper following docs/operations/deployment.md.
# Usage:
#   bash tools/deploy/release.sh [--build-frontend]

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"
BUILD_FRONTEND=false

for arg in "$@"; do
    case "$arg" in
        --build-frontend)
            BUILD_FRONTEND=true
            ;;
        *)
            echo "Unknown option: $arg" >&2
            echo "Usage: bash tools/deploy/release.sh [--build-frontend]" >&2
            exit 1
            ;;
    esac
done

if [ ! -f "${ROOT_DIR}/backend/.env" ]; then
    echo "Error: ${ROOT_DIR}/backend/.env is missing. Configure production environment variables before releasing." >&2
    exit 1
fi

if [ "${BUILD_FRONTEND}" = true ]; then
    echo "==> Building frontend assets..."
    (
        cd "${ROOT_DIR}/frontend"
        npm ci
        npm run build
    )
fi

if [ ! -f "${ROOT_DIR}/backend/public/build/manifest.json" ]; then
    echo "Error: ${ROOT_DIR}/backend/public/build/manifest.json is missing. Run with --build-frontend or sync prebuilt assets first." >&2
    exit 1
fi

echo "==> Installing backend production dependencies..."
(
    cd "${ROOT_DIR}/backend"
    composer install --no-dev --prefer-dist --optimize-autoloader --no-interaction
    composer check-platform-reqs
)

mkdir -p "${ROOT_DIR}/backend/storage/app/private" "${ROOT_DIR}/backend/storage/logs"

echo "==> Applying and verifying forward database migrations..."
(
    cd "${ROOT_DIR}/backend"
    php bin/console migrate
    php bin/console migrate:status
    php bin/console migrate:check
)

if command -v systemctl >/dev/null 2>&1 && systemctl list-unit-files php8.5-fpm.service >/dev/null 2>&1; then
    echo "==> Reloading php8.5-fpm..."
    sudo -n systemctl reload php8.5-fpm || systemctl reload php8.5-fpm
fi

echo "==> Release completed successfully."

