# shellcheck shell=bash disable=SC2154
# Host provisioning steps shared by every ingress (see setup.sh). Sourced after lib/common.sh;
# uses the globals that setup.sh defines.

install_runtime_packages() {
    log "Installing Nginx, PHP ${PHP_VERSION}-FPM, Node.js 22, Composer 2 and base tools..."
    apt-get update -y
    apt-get install -y software-properties-common curl git unzip acl rsync ca-certificates gnupg openssl cron jq
    add-apt-repository -y ppa:ondrej/php
    curl -fsSL https://deb.nodesource.com/setup_22.x | bash -
    apt-get install -y \
        nginx \
        nodejs \
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
        log "Installing Composer 2..."
        curl -sS https://getcomposer.org/installer | php -- --install-dir=/usr/local/bin --filename=composer
    fi
}

# 2GB swap on low-memory instances (such as 1GB VMs) for npm builds and MySQL.
ensure_swap() {
    if [ "${TOTAL_MEM_MB}" -lt 2048 ] && [ ! -f /swapfile ]; then
        log "Creating 2GB swapfile for low-memory host..."
        fallocate -l 2G /swapfile
        chmod 600 /swapfile
        mkswap /swapfile
        swapon /swapfile
        grep -q '^/swapfile ' /etc/fstab || echo '/swapfile none swap sw 0 0' >>/etc/fstab
    fi
}

install_docker() {
    log "Installing Docker for MySQL ${MYSQL_IMAGE#mysql:}..."
    # MySQL uses host networking, so Docker needs no NAT chains; this also keeps them out of
    # saved iptables rules (direct ingress).
    if [ ! -f /etc/docker/daemon.json ]; then
        install -d -m 755 /etc/docker
        echo '{ "iptables": false }' >/etc/docker/daemon.json
    fi
    apt-get install -y docker.io
    systemctl enable --now docker
}

prepare_deploy_tree() {
    log "Preparing deploy user ${DEPLOY_USER} and ${DEPLOY_PATH} permissions..."
    usermod -aG "${WEB_GROUP}" "${DEPLOY_USER}"
    chown -R "${DEPLOY_USER}:${WEB_GROUP}" "${DEPLOY_PATH}"
    chmod 2775 "${DEPLOY_PATH}"
    sudo -u "${WEB_GROUP}" test -r "${DEPLOY_PATH}/backend/public/index.php" \
        || die "${WEB_GROUP} cannot read ${DEPLOY_PATH}; clone the repository under a world-traversable path such as /srv/planner."
}

mysql_root() {
    docker exec -i "${MYSQL_CONTAINER}" mysql --defaults-extra-file=/etc/planner/client.cnf "$@"
}

# MySQL 8.4 from the official multi-arch image: MySQL's APT repository has no arm64 build.
start_mysql() {
    log "Starting MySQL ${MYSQL_IMAGE#mysql:} on 127.0.0.1:3306..."
    install -d -m 750 "${CONFIG_DIR}"
    if [ ! -s "${CONFIG_DIR}/mysql-client.cnf" ]; then
        [ ! -d "${MYSQL_DATA}/mysql" ] || die "${MYSQL_DATA} already holds MySQL data but ${CONFIG_DIR}/mysql-client.cnf is missing; restore it instead of generating a new root password."
        (
            umask 077
            printf '[client]\nuser=root\npassword=%s\n' "$(openssl rand -hex 24)" >"${CONFIG_DIR}/mysql-client.cnf"
        )
    fi

    if ! docker container inspect "${MYSQL_CONTAINER}" >/dev/null 2>&1; then
        local root_password tuning=()
        root_password="$(sed -n 's/^password=//p' "${CONFIG_DIR}/mysql-client.cnf")"
        if [ "${TOTAL_MEM_MB}" -lt 2048 ]; then
            tuning+=(--performance-schema=OFF --max-connections=50)
        fi
        # Host networking keeps MySQL on loopback only; root is limited to the in-container socket.
        docker run -d \
            --name "${MYSQL_CONTAINER}" \
            --restart unless-stopped \
            --network host \
            -v "${MYSQL_DATA}:/var/lib/mysql" \
            -v "${CONFIG_DIR}/mysql-client.cnf:/etc/planner/client.cnf:ro" \
            -e MYSQL_ROOT_PASSWORD="${root_password}" \
            -e MYSQL_ROOT_HOST=localhost \
            "${MYSQL_IMAGE}" \
            --bind-address=127.0.0.1 \
            --port=3306 \
            --mysqlx=OFF \
            --character-set-server=utf8mb4 \
            --collation-server=utf8mb4_0900_ai_ci \
            "${tuning[@]}" >/dev/null
    fi
    docker start "${MYSQL_CONTAINER}" >/dev/null

    # TCP only answers once initialisation has finished (the init server runs with --skip-networking).
    local ready=false
    for _ in $(seq 1 90); do
        if docker exec "${MYSQL_CONTAINER}" mysqladmin --protocol=TCP -h 127.0.0.1 -P 3306 ping --silent >/dev/null 2>&1; then
            ready=true
            break
        fi
        sleep 2
    done
    [ "${ready}" = true ] || die "MySQL did not become ready; inspect: docker logs ${MYSQL_CONTAINER}"
    MYSQL_VERSION="$(mysql_root -N -e 'SELECT VERSION()')" || die "Cannot sign in to MySQL as root with ${CONFIG_DIR}/mysql-client.cnf."
    case "${MYSQL_VERSION}" in
        8.4.*) echo "MySQL ${MYSQL_VERSION} is running." ;;
        *) die "Expected MySQL 8.4, found ${MYSQL_VERSION}." ;;
    esac
}

# Creates the database, its user and a production backend/.env once; later runs keep them.
# APP_URL is owned by the ingress and set separately.
ensure_app_env() {
    if [ -f "${ENV_FILE}" ]; then
        log "Keeping existing backend/.env and its database credentials."
    else
        log "Creating database ${DB_NAME}, its user and production backend/.env..."
        local db_password
        db_password="$(openssl rand -hex 24)"
        mysql_root <<SQL
CREATE DATABASE IF NOT EXISTS \`${DB_NAME}\` CHARACTER SET utf8mb4 COLLATE utf8mb4_0900_ai_ci;
CREATE USER IF NOT EXISTS '${DB_USER}'@'127.0.0.1' IDENTIFIED BY '${db_password}';
ALTER USER '${DB_USER}'@'127.0.0.1' IDENTIFIED BY '${db_password}';
GRANT ALL PRIVILEGES ON \`${DB_NAME}\`.* TO '${DB_USER}'@'127.0.0.1';
SQL
        (
            umask 027
            cp "${DEPLOY_PATH}/backend/.env.example" "${ENV_FILE}"
        )
        env_set "${ENV_FILE}" APP_ENV production
        env_set "${ENV_FILE}" APP_DEBUG false
        env_set "${ENV_FILE}" PLANNER_DB_HOST 127.0.0.1
        env_set "${ENV_FILE}" PLANNER_DB_PORT 3306
        env_set "${ENV_FILE}" PLANNER_DB_DATABASE "${DB_NAME}"
        env_set "${ENV_FILE}" PLANNER_DB_USERNAME "${DB_USER}"
        env_set "${ENV_FILE}" PLANNER_DB_PASSWORD "${db_password}"
        env_set "${ENV_FILE}" PLANNER_DB_ALLOWED "${DB_NAME}"
        env_set "${ENV_FILE}" DB_USERNAME "${DB_USER}"
        env_set "${ENV_FILE}" DB_PASSWORD ""
        env_set "${ENV_FILE}" SESSION_SECURE_COOKIE true
        env_set "${ENV_FILE}" SESSION_ENCRYPTION_KEY "$(openssl rand -base64 32)"
        env_set "${ENV_FILE}" PRIVATE_STORAGE_ROOT "${DEPLOY_PATH}/backend/storage/app/private"
        env_set "${ENV_FILE}" LOG_PATH "${DEPLOY_PATH}/backend/storage/logs/planner.log"
        env_set "${ENV_FILE}" LOG_LEVEL info
        env_set "${ENV_FILE}" VITE_DEV_URL ""
    fi
    chown "${DEPLOY_USER}:${WEB_GROUP}" "${ENV_FILE}"
    chmod 640 "${ENV_FILE}"
}

# backup.conf is root-owned: the backup helper never trusts the deploy-writable .env.
write_backup_conf() {
    [ ! -f "${CONFIG_DIR}/backup.conf" ] || return 0
    local db storage
    db="$(env_get "${ENV_FILE}" PLANNER_DB_DATABASE)"
    storage="$(backend_path "${DEPLOY_PATH}/backend" "$(env_get "${ENV_FILE}" PRIVATE_STORAGE_ROOT)")"
    [[ "${db}" =~ ^[A-Za-z0-9_]+$ ]] || die "PLANNER_DB_DATABASE in ${ENV_FILE} is missing or unsupported."
    is_safe_path "${storage}" || die "PRIVATE_STORAGE_ROOT in ${ENV_FILE} contains unsupported characters."
    cat >"${CONFIG_DIR}/backup.conf" <<CONF
# Read by /usr/local/sbin/planner-backup (tools/deploy/backup.sh).
DEPLOY_PATH=${DEPLOY_PATH}
DB_NAME=${db}
PRIVATE_STORAGE_ROOT=${storage}
MYSQL_CONTAINER=${MYSQL_CONTAINER}
BACKUP_DIR=${BACKUP_DIR}
KEEP_DAYS=14
# Optional off-site copy, e.g. RCLONE_REMOTE=b2:planner-backups (install and configure rclone as root).
RCLONE_REMOTE=
CONF
    chmod 600 "${CONFIG_DIR}/backup.conf"
}

# Root-owned copies, so sudo and systemd never run code the deploy user can edit.
install_root_helpers() {
    log "Installing root-owned helpers, sudo rules, PHP limits and cron jobs..."
    install -d -m 755 /usr/local/lib/planner
    install -m 644 -o root -g root "${DEPLOY_PATH}/tools/deploy/lib/common.sh" /usr/local/lib/planner/common.sh
    install -m 755 -o root -g root "${DEPLOY_PATH}/tools/deploy/backup.sh" /usr/local/sbin/planner-backup
    install -m 755 -o root -g root "${DEPLOY_PATH}/tools/deploy/tunnel-url.sh" /usr/local/sbin/planner-tunnel-url
    install -d -m 700 "${BACKUP_DIR}"

    local sudoers_tmp
    sudoers_tmp="$(mktemp)"
    cat >"${sudoers_tmp}" <<EOF
${DEPLOY_USER} ALL=(root) NOPASSWD: /usr/bin/systemctl reload php${PHP_VERSION}-fpm, /usr/bin/systemctl restart planner-realtime, /usr/local/sbin/planner-backup
EOF
    visudo -cf "${sudoers_tmp}" >/dev/null
    install -m 440 -o root -g root "${sudoers_tmp}" /etc/sudoers.d/planner-deploy
    rm -f "${sudoers_tmp}"

    # File uploads accept up to 20MB each (UploadValidator); keep Nginx and PHP slightly above that.
    cat >"/etc/php/${PHP_VERSION}/fpm/conf.d/99-planner.ini" <<'INI'
upload_max_filesize = 20M
post_max_size = 32M
expose_php = Off
INI

    # Scheduler runs as the PHP-FPM user so files it writes keep matching ownership (docs/operations/jobs.md).
    cat >/etc/cron.d/planner <<CRON
# Planner scheduler and nightly backup, installed by tools/deploy/setup.sh.
* * * * * ${WEB_GROUP} cd ${DEPLOY_PATH}/backend && flock -n /run/lock/planner-scheduler.lock php bin/console schedule:run 2>&1 | logger -t planner-scheduler
15 3 * * * root /usr/local/sbin/planner-backup daily 2>&1 | logger -t planner-backup
CRON
    chmod 644 /etc/cron.d/planner

    # Live collaboration WebSocket server (bin/realtime.php), reached through Nginx at /realtime.
    cat >/etc/systemd/system/planner-realtime.service <<UNIT
[Unit]
Description=Planner live collaboration (WebSocket)
After=network-online.target docker.service php${PHP_VERSION}-fpm.service

[Service]
User=${WEB_GROUP}
Group=${WEB_GROUP}
WorkingDirectory=${DEPLOY_PATH}/backend
Environment=REALTIME_LISTEN=127.0.0.1:${REALTIME_PORT:-8090}
ExecStart=/usr/bin/php ${DEPLOY_PATH}/backend/bin/realtime.php
Restart=always
RestartSec=2
NoNewPrivileges=true

[Install]
WantedBy=multi-user.target
UNIT

    systemctl daemon-reload
    systemctl enable --now cron "php${PHP_VERSION}-fpm" nginx
    systemctl restart "php${PHP_VERSION}-fpm"
    systemctl enable planner-realtime
    systemctl restart planner-realtime || log "planner-realtime will start after the first release."
}

# Every ingress shares the same application server on 127.0.0.1:LOCAL_APP_PORT (tunnels connect
# to it, the pull deployer health-checks it). Ingresses may add a public server via $1.
# $2=true trusts CF-Connecting-IP from loopback so rate limits see real visitor addresses.
write_nginx_site() {
    local public_server="$1" trust_cloudflare="$2" real_ip=""
    if [ "${trust_cloudflare}" = true ]; then
        real_ip="    set_real_ip_from 127.0.0.1;
    set_real_ip_from ::1;
    real_ip_header CF-Connecting-IP;"
    fi

    log "Writing Nginx site (local app server on 127.0.0.1:${LOCAL_APP_PORT})..."
    cat >/etc/nginx/snippets/planner-app.conf <<NGINX
# Installed by tools/deploy/setup.sh; rules follow docs/operations/deployment.md.
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
# Live collaboration: WebSocket upgrade to bin/realtime.php (systemd planner-realtime).
location = /realtime {
    proxy_pass http://127.0.0.1:${REALTIME_PORT:-8090};
    proxy_http_version 1.1;
    proxy_set_header Upgrade \$http_upgrade;
    proxy_set_header Connection "upgrade";
    proxy_set_header Host \$host;
    proxy_read_timeout 120s;
    proxy_send_timeout 120s;
}
location ~ \.php\$ { return 404; }
location ~ /\. { deny all; }
NGINX

    cat >/etc/nginx/sites-available/planner <<NGINX
# Installed by tools/deploy/setup.sh (ingress: ${INGRESS}).
server {
    listen 127.0.0.1:${LOCAL_APP_PORT} default_server;
    server_name _;
${real_ip}
    include snippets/planner-app.conf;
}
${public_server}
NGINX
    ln -sf /etc/nginx/sites-available/planner /etc/nginx/sites-enabled/planner
    rm -f /etc/nginx/sites-enabled/default
    nginx -t
    systemctl reload nginx
}

# Non-secret settings shared by the pull deployer and the tunnel helper (root-owned, world-readable).
write_hosting_conf() {
    cat >"${HOSTING_CONF}" <<CONF
# Written by tools/deploy/setup.sh; re-run setup to change it.
DEPLOY_PATH=${DEPLOY_PATH}
DEPLOY_USER=${DEPLOY_USER}
INGRESS=${INGRESS}
PUBLIC_HOSTNAME=${DOMAIN}
LOCAL_APP_PORT=${LOCAL_APP_PORT}
TUNNEL_METRICS=${TUNNEL_METRICS}
GITHUB_REPO=${GITHUB_REPO}
DEPLOY_BRANCH=${DEPLOY_BRANCH}
CI_WORKFLOW=${CI_WORKFLOW}
CONF
    chmod 644 "${HOSTING_CONF}"
}

# Continuous deployment: the host polls GitHub for the newest commit whose CI run passed.
install_pull_deployer() {
    if [ "${AUTO_DEPLOY}" = false ]; then
        log "Automatic deployment disabled (--no-auto-deploy)."
        systemctl disable --now planner-deploy.timer >/dev/null 2>&1 || true
        return 0
    fi
    log "Installing the pull deployer (checks every ${DEPLOY_INTERVAL})..."
    cat >/etc/systemd/system/planner-deploy.service <<UNIT
[Unit]
Description=Planner pull deployment (tools/deploy/pull-deploy.sh)
After=network-online.target docker.service
Wants=network-online.target

[Service]
Type=oneshot
User=${DEPLOY_USER}
ExecStart=/usr/bin/bash ${DEPLOY_PATH}/tools/deploy/pull-deploy.sh
UNIT
    cat >/etc/systemd/system/planner-deploy.timer <<UNIT
[Unit]
Description=Run Planner pull deployment periodically

[Timer]
OnBootSec=2min
OnUnitActiveSec=${DEPLOY_INTERVAL}
RandomizedDelaySec=20s

[Install]
WantedBy=timers.target
UNIT
    systemctl daemon-reload
    systemctl enable --now planner-deploy.timer
}

disable_tunnel() {
    if systemctl list-unit-files planner-tunnel.service >/dev/null 2>&1; then
        systemctl disable --now planner-tunnel.service >/dev/null 2>&1 || true
    fi
}
