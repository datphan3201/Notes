#!/usr/bin/env bash
set -euo pipefail

# Database + private-storage backup for hosts provisioned by oracle-ubuntu-setup.sh.
# Installed as root-owned /usr/local/sbin/planner-backup so the deploy user can run it
# through sudo without being able to edit it. Settings come from /etc/planner/backup.conf.
# Usage:
#   sudo planner-backup [label]     # label: lowercase letters, digits and dashes (default: manual)

CONFIG_FILE="/etc/planner/backup.conf"

die() {
    echo "Error: $*" >&2
    exit 1
}

[ "$(id -u)" -eq 0 ] || die "planner-backup must run as root (use sudo)."
[ -f "${CONFIG_FILE}" ] || die "${CONFIG_FILE} is missing. Run tools/deploy/oracle-ubuntu-setup.sh first."

# shellcheck source=/dev/null
. "${CONFIG_FILE}"

: "${DEPLOY_PATH:?DEPLOY_PATH is not set in ${CONFIG_FILE}}"
: "${DB_NAME:?DB_NAME is not set in ${CONFIG_FILE}}"
: "${PRIVATE_STORAGE_ROOT:?PRIVATE_STORAGE_ROOT is not set in ${CONFIG_FILE}}"
: "${MYSQL_CONTAINER:?MYSQL_CONTAINER is not set in ${CONFIG_FILE}}"
BACKUP_DIR="${BACKUP_DIR:-/var/backups/planner}"
KEEP_DAYS="${KEEP_DAYS:-14}"
RCLONE_REMOTE="${RCLONE_REMOTE:-}"

LABEL="${1:-manual}"
[[ "${LABEL}" =~ ^[a-z0-9-]{1,32}$ ]] || die "Backup label must match [a-z0-9-]{1,32}."
[[ "${DB_NAME}" =~ ^[A-Za-z0-9_]+$ ]] || die "DB_NAME contains unsupported characters."
[[ "${KEEP_DAYS}" =~ ^[0-9]+$ ]] || die "KEEP_DAYS must be a whole number."

umask 077
install -d -m 700 "${BACKUP_DIR}"

NAME="$(date -u +%Y%m%dT%H%M%SZ)-${LABEL}"
PARTIAL="${BACKUP_DIR}/.${NAME}.partial"
TARGET="${BACKUP_DIR}/${NAME}"
trap 'rm -rf "${PARTIAL}"' EXIT
mkdir "${PARTIAL}"

echo "==> Dumping database ${DB_NAME}..."
# The option file is mounted read-only into the container; credentials never reach the command line.
docker exec "${MYSQL_CONTAINER}" mysqldump \
    --defaults-extra-file=/etc/planner/client.cnf \
    --single-transaction --routines --triggers --events --no-tablespaces --set-gtid-purged=OFF \
    --databases "${DB_NAME}" | gzip -9 >"${PARTIAL}/database.sql.gz"
gzip -t "${PARTIAL}/database.sql.gz"

echo "==> Archiving private storage ${PRIVATE_STORAGE_ROOT}..."
if [ -d "${PRIVATE_STORAGE_ROOT}" ]; then
    tar -czf "${PARTIAL}/private-storage.tar.gz" -C "${PRIVATE_STORAGE_ROOT}" .
else
    echo "Warning: ${PRIVATE_STORAGE_ROOT} does not exist yet; storing an empty archive." >&2
    tar -czf "${PARTIAL}/private-storage.tar.gz" --files-from /dev/null
fi

{
    echo "created_at=$(date -u +%Y-%m-%dT%H:%M:%SZ)"
    echo "label=${LABEL}"
    echo "database=${DB_NAME}"
    echo "revision=$(git -c safe.directory="${DEPLOY_PATH}" -C "${DEPLOY_PATH}" rev-parse HEAD 2>/dev/null || echo unknown)"
} >"${PARTIAL}/MANIFEST"
(cd "${PARTIAL}" && sha256sum database.sql.gz private-storage.tar.gz MANIFEST >SHA256SUMS)

mv "${PARTIAL}" "${TARGET}"
trap - EXIT
echo "==> Backup stored in ${TARGET}"

if [ -n "${RCLONE_REMOTE}" ]; then
    command -v rclone >/dev/null 2>&1 || die "RCLONE_REMOTE is set but rclone is not installed; local backup kept in ${TARGET}."
    echo "==> Copying backup off-site to ${RCLONE_REMOTE}/${NAME}..."
    rclone copy "${TARGET}" "${RCLONE_REMOTE%/}/${NAME}"
fi

# Prune old local backups, always keeping the one just written.
find "${BACKUP_DIR}" -mindepth 1 -maxdepth 1 -type d -name '[0-9]*Z-*' -mtime +"${KEEP_DAYS}" \
    ! -path "${TARGET}" -exec rm -rf {} +
