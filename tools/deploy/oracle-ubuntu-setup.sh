#!/usr/bin/env bash
set -euo pipefail

# One-time host provisioning for Ubuntu 24.04 LTS on Oracle Cloud Always Free (amd64 or arm64).
# Run it from the cloned repository; that clone becomes the deploy path (for example /srv/planner):
#   sudo bash tools/deploy/oracle-ubuntu-setup.sh --domain notes.example.com --email you@example.com [--user ubuntu] [--skip-tls]
# It installs Nginx, PHP 8.5-FPM, Composer 2, Node.js 22, Certbot and MySQL 8.4 (official Docker
# image: MySQL's APT repository has no arm64 build), creates the database and backend/.env,
# configures the Nginx site, TLS, scheduler and backups, and runs the first release.
# Re-running is safe: MySQL data, generated credentials, backend/.env and backup.conf are kept.

DEPLOY_PATH="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"
DEPLOY_USER="${SUDO_USER:-ubuntu}"
DOMAIN=""
EMAIL=""
SKIP_TLS=false

PHP_VERSION="8.5"
WEB_GROUP="www-data"
CONFIG_DIR="/etc/planner"
BACKUP_DIR="/var/backups/planner"
MYSQL_IMAGE="mysql:8.4"
MYSQL_CONTAINER="planner-mysql"
MYSQL_DATA="/var/lib/planner-mysql"
DB_NAME="planner"
DB_USER="planner"
ENV_FILE="${DEPLOY_PATH}/backend/.env"

usage() {
    echo "Usage: sudo bash tools/deploy/oracle-ubuntu-setup.sh --domain <host> --email <address> [--user <deploy_user>] [--skip-tls]" >&2
}

die() {
    echo "Error: $*" >&2
    exit 1
}

while [ $# -gt 0 ]; do
    case "$1" in
        --domain)
            DOMAIN="${2:-}"
            shift 2
            ;;
        --email)
            EMAIL="${2:-}"
            shift 2
            ;;
        --user)
            DEPLOY_USER="${2:-}"
            shift 2
            ;;
        --skip-tls)
            SKIP_TLS=true
            shift
            ;;
        *)
            echo "Unknown option: $1" >&2
            usage
            exit 1
            ;;
    esac
done

[ "$(id -u)" -eq 0 ] || die "Run this script with sudo."
[[ "${DOMAIN}" =~ ^[A-Za-z0-9]([A-Za-z0-9-]*[A-Za-z0-9])?(\.[A-Za-z0-9]([A-Za-z0-9-]*[A-Za-z0-9])?)+$ ]] \
    || { usage; die "--domain must be a DNS name that points to this host."; }
if [ "${SKIP_TLS}" = false ]; then
    [[ "${EMAIL}" =~ ^[^@[:space:]]+@[^@[:space:]]+\.[^@[:space:]]+$ ]] \
        || { usage; die "--email is required for Let's Encrypt (or pass --skip-tls)."; }
fi
if [ "${DEPLOY_USER}" = "root" ] || ! id "${DEPLOY_USER}" >/dev/null 2>&1; then
    die "Deploy user '${DEPLOY_USER}' must be an existing non-root user."
fi
[ -f "${DEPLOY_PATH}/backend/composer.json" ] || die "Run this script from a clone of the repository."
# Paths end up unquoted in backend/.env, Nginx and cron.
[[ "${DEPLOY_PATH}" =~ ^/[A-Za-z0-9._/-]+$ ]] || die "Deploy path ${DEPLOY_PATH} must contain only letters, digits, '.', '_', '-' and '/'."

# shellcheck source=/dev/null
. /etc/os-release
[ "${VERSION_ID:-}" = "24.04" ] || echo "Warning: tested on Ubuntu 24.04 LTS; this host reports ${PRETTY_NAME:-unknown}." >&2

export DEBIAN_FRONTEND=noninteractive
TOTAL_MEM_MB="$(awk '/MemTotal/ {print int($2/1024)}' /proc/meminfo)"

echo "==> Installing Nginx, PHP ${PHP_VERSION}-FPM, Node.js 22, Certbot and base tools..."
apt-get update -y
apt-get install -y software-properties-common curl git unzip acl rsync ca-certificates gnupg openssl cron iptables
add-apt-repository -y ppa:ondrej/php
curl -fsSL https://deb.nodesource.com/setup_22.x | bash -
apt-get install -y \
    nginx \
    nodejs \
    certbot \
    python3-certbot-nginx \
    "php${PHP_VERSION}-fpm" \
    "php${PHP_VERSION}-cli" \
    "php${PHP_VERSION}-mysql" \
    "php${PHP_VERSION}-curl" \
    "php${PHP_VERSION}-gd" \
    "php${PHP_VERSION}-intl" \
    "php${PHP_VERSION}-mbstring" \
    "php${PHP_VERSION}-zip" \
    "php${PHP_VERSION}-xml"

if ! command -v composer >/dev/null 2>&1; then
    echo "==> Installing Composer 2..."
    curl -sS https://getcomposer.org/installer | php -- --install-dir=/usr/local/bin --filename=composer
fi

# 2GB swap on low-memory instances (such as 1GB AMD Micro VMs) for npm builds and MySQL.
if [ "${TOTAL_MEM_MB}" -lt 2048 ] && [ ! -f /swapfile ]; then
    echo "==> Creating 2GB swapfile for low-memory instance..."
    fallocate -l 2G /swapfile
    chmod 600 /swapfile
    mkswap /swapfile
    swapon /swapfile
    grep -q '^/swapfile ' /etc/fstab || echo '/swapfile none swap sw 0 0' >>/etc/fstab
fi

# Oracle images end INPUT with a REJECT rule, so ACCEPT rules must go before it.
open_port() {
    local port="$1" reject_line
    iptables -C INPUT -p tcp -m state --state NEW --dport "${port}" -j ACCEPT 2>/dev/null && return 0
    reject_line="$(iptables -L INPUT --line-numbers -n | awk '$2 == "REJECT" { print $1; exit }')"
    if [ -n "${reject_line}" ]; then
        iptables -I INPUT "${reject_line}" -p tcp -m state --state NEW --dport "${port}" -j ACCEPT
    else
        iptables -A INPUT -p tcp -m state --state NEW --dport "${port}" -j ACCEPT
    fi
}

# Saved before Docker is installed so its runtime chains are not persisted.
echo "==> Opening HTTP (80) and HTTPS (443) in host iptables..."
open_port 80
open_port 443
if command -v netfilter-persistent >/dev/null 2>&1; then
    netfilter-persistent save
else
    echo "Warning: netfilter-persistent is not installed; the port 80/443 rules will not survive a reboot." >&2
fi

echo "==> Installing Docker for MySQL ${MYSQL_IMAGE#mysql:}..."
apt-get install -y docker.io
systemctl enable --now docker

echo "==> Preparing deploy user ${DEPLOY_USER} and ${DEPLOY_PATH} permissions..."
usermod -aG "${WEB_GROUP}" "${DEPLOY_USER}"
chown -R "${DEPLOY_USER}:${WEB_GROUP}" "${DEPLOY_PATH}"
chmod 2775 "${DEPLOY_PATH}"
sudo -u "${WEB_GROUP}" test -r "${DEPLOY_PATH}/backend/public/index.php" \
    || die "${WEB_GROUP} cannot read ${DEPLOY_PATH}; clone the repository under a world-traversable path such as /srv/planner."

echo "==> Starting MySQL ${MYSQL_IMAGE#mysql:} on 127.0.0.1:3306..."
install -d -m 750 "${CONFIG_DIR}"
if [ ! -s "${CONFIG_DIR}/mysql-client.cnf" ]; then
    [ ! -d "${MYSQL_DATA}/mysql" ] || die "${MYSQL_DATA} already holds MySQL data but ${CONFIG_DIR}/mysql-client.cnf is missing; restore it instead of generating a new root password."
    (
        umask 077
        printf '[client]\nuser=root\npassword=%s\n' "$(openssl rand -hex 24)" >"${CONFIG_DIR}/mysql-client.cnf"
    )
fi
MYSQL_ROOT_PASSWORD="$(sed -n 's/^password=//p' "${CONFIG_DIR}/mysql-client.cnf")"

mysql_root() {
    docker exec -i "${MYSQL_CONTAINER}" mysql --defaults-extra-file=/etc/planner/client.cnf "$@"
}

if ! docker container inspect "${MYSQL_CONTAINER}" >/dev/null 2>&1; then
    MYSQL_TUNING=()
    if [ "${TOTAL_MEM_MB}" -lt 2048 ]; then
        MYSQL_TUNING+=(--performance-schema=OFF --max-connections=50)
    fi
    # Host networking keeps MySQL on loopback only; root is limited to the in-container socket.
    docker run -d \
        --name "${MYSQL_CONTAINER}" \
        --restart unless-stopped \
        --network host \
        -v "${MYSQL_DATA}:/var/lib/mysql" \
        -v "${CONFIG_DIR}/mysql-client.cnf:/etc/planner/client.cnf:ro" \
        -e MYSQL_ROOT_PASSWORD="${MYSQL_ROOT_PASSWORD}" \
        -e MYSQL_ROOT_HOST=localhost \
        "${MYSQL_IMAGE}" \
        --bind-address=127.0.0.1 \
        --port=3306 \
        --mysqlx=OFF \
        --character-set-server=utf8mb4 \
        --collation-server=utf8mb4_0900_ai_ci \
        "${MYSQL_TUNING[@]}" >/dev/null
fi
docker start "${MYSQL_CONTAINER}" >/dev/null

# TCP only answers once initialisation has finished (the init server runs with --skip-networking).
MYSQL_READY=false
for _ in $(seq 1 90); do
    if docker exec "${MYSQL_CONTAINER}" mysqladmin --protocol=TCP -h 127.0.0.1 -P 3306 ping --silent >/dev/null 2>&1; then
        MYSQL_READY=true
        break
    fi
    sleep 2
done
[ "${MYSQL_READY}" = true ] || die "MySQL did not become ready; inspect: docker logs ${MYSQL_CONTAINER}"
MYSQL_VERSION="$(mysql_root -N -e 'SELECT VERSION()')" || die "Cannot sign in to MySQL as root with ${CONFIG_DIR}/mysql-client.cnf."
case "${MYSQL_VERSION}" in
    8.4.*) echo "MySQL ${MYSQL_VERSION} is running." ;;
    *) die "Expected MySQL 8.4, found ${MYSQL_VERSION}." ;;
esac

set_env() {
    local key="$1" value="$2" tmp
    tmp="$(mktemp)"
    awk -v key="${key}" -v value="${value}" '
        index($0, key "=") == 1 { if (!done) print key "=" value; done = 1; next }
        { print }
        END { if (!done) print key "=" value }
    ' "${ENV_FILE}" >"${tmp}"
    cat "${tmp}" >"${ENV_FILE}"
    rm -f "${tmp}"
}

if [ ! -f "${ENV_FILE}" ]; then
    echo "==> Creating database ${DB_NAME}, its user and production backend/.env..."
    DB_PASSWORD="$(openssl rand -hex 24)"
    mysql_root <<SQL
CREATE DATABASE IF NOT EXISTS \`${DB_NAME}\` CHARACTER SET utf8mb4 COLLATE utf8mb4_0900_ai_ci;
CREATE USER IF NOT EXISTS '${DB_USER}'@'127.0.0.1' IDENTIFIED BY '${DB_PASSWORD}';
ALTER USER '${DB_USER}'@'127.0.0.1' IDENTIFIED BY '${DB_PASSWORD}';
GRANT ALL PRIVILEGES ON \`${DB_NAME}\`.* TO '${DB_USER}'@'127.0.0.1';
SQL
    (
        umask 027
        cp "${DEPLOY_PATH}/backend/.env.example" "${ENV_FILE}"
    )
    set_env APP_ENV production
    set_env APP_DEBUG false
    set_env APP_URL "https://${DOMAIN}"
    set_env PLANNER_DB_HOST 127.0.0.1
    set_env PLANNER_DB_PORT 3306
    set_env PLANNER_DB_DATABASE "${DB_NAME}"
    set_env PLANNER_DB_USERNAME "${DB_USER}"
    set_env PLANNER_DB_PASSWORD "${DB_PASSWORD}"
    set_env PLANNER_DB_ALLOWED "${DB_NAME}"
    set_env DB_USERNAME "${DB_USER}"
    set_env DB_PASSWORD ""
    set_env SESSION_SECURE_COOKIE true
    set_env SESSION_ENCRYPTION_KEY "$(openssl rand -base64 32)"
    set_env PRIVATE_STORAGE_ROOT "${DEPLOY_PATH}/backend/storage/app/private"
    set_env LOG_PATH "${DEPLOY_PATH}/backend/storage/logs/planner.log"
    set_env LOG_LEVEL info
    set_env VITE_DEV_URL ""
else
    echo "==> Keeping existing backend/.env and its database credentials."
fi
chown "${DEPLOY_USER}:${WEB_GROUP}" "${ENV_FILE}"
chmod 640 "${ENV_FILE}"

# backup.conf is root-owned: the backup helper never trusts the deploy-writable .env.
if [ ! -f "${CONFIG_DIR}/backup.conf" ]; then
    CONFIGURED_DB="$(sed -n 's/^PLANNER_DB_DATABASE=//p' "${ENV_FILE}" | tail -n 1)"
    CONFIGURED_STORAGE="$(sed -n 's/^PRIVATE_STORAGE_ROOT=//p' "${ENV_FILE}" | tail -n 1)"
    [[ "${CONFIGURED_DB}" =~ ^[A-Za-z0-9_]+$ ]] || die "PLANNER_DB_DATABASE in ${ENV_FILE} is missing or unsupported."
    case "${CONFIGURED_STORAGE}" in
        /*) ;;
        *) CONFIGURED_STORAGE="${DEPLOY_PATH}/backend/${CONFIGURED_STORAGE:-storage/app/private}" ;;
    esac
    [[ "${CONFIGURED_STORAGE}" =~ ^/[A-Za-z0-9._/-]+$ ]] || die "PRIVATE_STORAGE_ROOT in ${ENV_FILE} contains unsupported characters."
    cat >"${CONFIG_DIR}/backup.conf" <<CONF
# Read by /usr/local/sbin/planner-backup (tools/deploy/backup.sh).
DEPLOY_PATH=${DEPLOY_PATH}
DB_NAME=${CONFIGURED_DB}
PRIVATE_STORAGE_ROOT=${CONFIGURED_STORAGE}
MYSQL_CONTAINER=${MYSQL_CONTAINER}
BACKUP_DIR=${BACKUP_DIR}
KEEP_DAYS=14
# Optional off-site copy, e.g. RCLONE_REMOTE=b2:planner-backups (install and configure rclone as root).
RCLONE_REMOTE=
CONF
    chmod 600 "${CONFIG_DIR}/backup.conf"
fi

echo "==> Installing backup helper, sudo rules, PHP limits and cron jobs..."
install -m 755 -o root -g root "${DEPLOY_PATH}/tools/deploy/backup.sh" /usr/local/sbin/planner-backup
install -d -m 700 "${BACKUP_DIR}"

SUDOERS_TMP="$(mktemp)"
cat >"${SUDOERS_TMP}" <<EOF
${DEPLOY_USER} ALL=(root) NOPASSWD: /usr/bin/systemctl reload php${PHP_VERSION}-fpm, /usr/local/sbin/planner-backup
EOF
visudo -cf "${SUDOERS_TMP}" >/dev/null
install -m 440 -o root -g root "${SUDOERS_TMP}" /etc/sudoers.d/planner-deploy
rm -f "${SUDOERS_TMP}"

# File uploads accept up to 20MB each (UploadValidator); keep Nginx and PHP slightly above that.
cat >"/etc/php/${PHP_VERSION}/fpm/conf.d/99-planner.ini" <<'INI'
upload_max_filesize = 20M
post_max_size = 32M
expose_php = Off
INI

# Scheduler runs as the PHP-FPM user so files it writes keep matching ownership (docs/operations/jobs.md).
cat >/etc/cron.d/planner <<CRON
# Planner scheduler and nightly backup, installed by tools/deploy/oracle-ubuntu-setup.sh.
* * * * * ${WEB_GROUP} cd ${DEPLOY_PATH}/backend && flock -n /run/lock/planner-scheduler.lock php bin/console schedule:run 2>&1 | logger -t planner-scheduler
15 3 * * * root /usr/local/sbin/planner-backup daily 2>&1 | logger -t planner-backup
CRON
chmod 644 /etc/cron.d/planner

systemctl enable --now cron "php${PHP_VERSION}-fpm" nginx
systemctl restart "php${PHP_VERSION}-fpm"

echo "==> Running the first release as ${DEPLOY_USER}..."
sudo -u "${DEPLOY_USER}" -H bash "${DEPLOY_PATH}/tools/deploy/release.sh" --build-frontend

echo "==> Configuring Nginx site for ${DOMAIN}..."
cat >/etc/nginx/sites-available/planner <<NGINX
# Installed by tools/deploy/oracle-ubuntu-setup.sh; Certbot adds the TLS directives.
server {
    listen 80;
    listen [::]:80;
    server_name ${DOMAIN};

    root ${DEPLOY_PATH}/backend/public;
    client_max_body_size 32m;
    server_tokens off;

    location ^~ /build/ {
        try_files \$uri =404;
        expires 1y;
        add_header Cache-Control "public, immutable";
    }
    location / { try_files \$uri /index.php?\$query_string; }
    location = /index.php {
        include fastcgi_params;
        fastcgi_param SCRIPT_FILENAME \$document_root/index.php;
        fastcgi_pass unix:/run/php/php${PHP_VERSION}-fpm.sock;
    }
    location ~ \.php\$ { return 404; }
    location ~ /\. { deny all; }
}
NGINX
ln -sf /etc/nginx/sites-available/planner /etc/nginx/sites-enabled/planner
rm -f /etc/nginx/sites-enabled/default
nginx -t
systemctl reload nginx

if [ "${SKIP_TLS}" = false ]; then
    echo "==> Requesting the Let's Encrypt certificate and enabling the HTTPS redirect..."
    certbot --nginx --non-interactive --agree-tos --keep-until-expiring --redirect \
        --email "${EMAIL}" -d "${DOMAIN}"
    systemctl reload nginx
fi

echo "==> Host provisioning completed."
echo
echo "Site:           https://${DOMAIN} (health check: https://${DOMAIN}/up)"
echo "Database:       MySQL ${MYSQL_VERSION} in container ${MYSQL_CONTAINER}, data in ${MYSQL_DATA}"
echo "Root client:    ${CONFIG_DIR}/mysql-client.cnf (root only)"
echo "Backups:        ${BACKUP_DIR} (nightly + before every release; configure RCLONE_REMOTE in ${CONFIG_DIR}/backup.conf for off-site copies)"
echo
echo "Remaining manual steps:"
echo "  1. Allow ingress TCP 80 and 443 in the Oracle VCN security list or NSG for this instance."
if [ "${SKIP_TLS}" = true ]; then
    echo "  2. TLS was skipped. Production cookies are Secure-only, so sign-in fails over plain HTTP:"
    echo "     re-run this script without --skip-tls once DNS for ${DOMAIN} points here."
else
    echo "  2. TLS is active; certbot.timer renews the certificate automatically."
fi
echo "  3. Configure MAIL_* (and optional AI_*) in ${ENV_FILE}; there is no local mail transport."
echo "  4. For GitHub deployments, add ORACLE_KNOWN_HOSTS from a trusted network and compare it with:"
for key in /etc/ssh/ssh_host_*_key.pub; do
    if [ -f "${key}" ]; then
        echo "       $(ssh-keygen -lf "${key}")"
    fi
done
