#!/usr/bin/env bash
set -euo pipefail

# Initial provisioning helper for Ubuntu 24.04 LTS on Oracle Cloud Always Free.
# Installs Nginx, MySQL 8.4, PHP 8.5-FPM + required extensions, Composer 2, Node.js 22 and Certbot.
# Usage:
#   sudo bash tools/deploy/oracle-ubuntu-setup.sh [deploy_user] [deploy_path]

DEPLOY_USER="${1:-${SUDO_USER:-ubuntu}}"
DEPLOY_PATH="${2:-/srv/planner}"

if [ "$(id -u)" -ne 0 ]; then
    echo "Please run this script with sudo: sudo bash tools/deploy/oracle-ubuntu-setup.sh" >&2
    exit 1
fi

echo "==> Updating apt packages and adding PHP 8.5 / Node.js 22 repositories..."
apt-get update -y
apt-get install -y software-properties-common curl git unzip acl rsync ca-certificates gnupg
add-apt-repository ppa:ondrej/php -y
curl -fsSL https://deb.nodesource.com/setup_22.x | bash -

echo "==> Installing Nginx, MySQL, Node.js 22, Certbot and PHP 8.5 extensions..."
apt-get install -y \
    nginx \
    mysql-server \
    nodejs \
    certbot \
    python3-certbot-nginx \
    php8.5-fpm \
    php8.5-cli \
    php8.5-mysql \
    php8.5-curl \
    php8.5-gd \
    php8.5-intl \
    php8.5-mbstring \
    php8.5-zip \
    php8.5-xml

if ! command -v composer >/dev/null 2>&1; then
    echo "==> Installing Composer 2..."
    curl -sS https://getcomposer.org/installer | php -- --install-dir=/usr/local/bin --filename=composer
fi

# Create a 2GB swap file on low-memory instances (such as 1GB AMD Micro VMs)
TOTAL_MEM_MB="$(awk '/MemTotal/ {print int($2/1024)}' /proc/meminfo)"
if [ "${TOTAL_MEM_MB}" -lt 2048 ] && [ ! -f /swapfile ]; then
    echo "==> Creating 2GB swapfile for low-memory instance..."
    fallocate -l 2G /swapfile
    chmod 600 /swapfile
    mkswap /swapfile
    swapon /swapfile
    if ! grep -q '/swapfile' /etc/fstab; then
        echo '/swapfile none swap sw 0 0' >> /etc/fstab
    fi
fi

echo "==> Opening HTTP (80) and HTTPS (443) in host iptables if rules are not present..."
if command -v iptables >/dev/null 2>&1; then
    iptables -C INPUT -p tcp -m state --state NEW --dport 80 -j ACCEPT 2>/dev/null \
        || iptables -I INPUT 6 -p tcp -m state --state NEW --dport 80 -j ACCEPT
    iptables -C INPUT -p tcp -m state --state NEW --dport 443 -j ACCEPT 2>/dev/null \
        || iptables -I INPUT 6 -p tcp -m state --state NEW --dport 443 -j ACCEPT
    if command -v netfilter-persistent >/dev/null 2>&1; then
        netfilter-persistent save
    fi
fi

echo "==> Preparing deployment directory ${DEPLOY_PATH} and PHP-FPM reload sudoers rule..."
mkdir -p "${DEPLOY_PATH}"
usermod -aG www-data "${DEPLOY_USER}" || true
chown -R "${DEPLOY_USER}:www-data" "${DEPLOY_PATH}"
chmod 2775 "${DEPLOY_PATH}"

cat >/etc/sudoers.d/planner-deploy <<EOF
${DEPLOY_USER} ALL=(ALL) NOPASSWD: /bin/systemctl reload php8.5-fpm, /usr/bin/systemctl reload php8.5-fpm
EOF
chmod 440 /etc/sudoers.d/planner-deploy

systemctl enable --now mysql php8.5-fpm nginx

echo "==> Host provisioning completed."
echo "Next steps:"
echo "  1. Create the MySQL database and user (utf8mb4 / utf8mb4_0900_ai_ci)."
echo "  2. Clone the repository into ${DEPLOY_PATH} and configure ${DEPLOY_PATH}/backend/.env."
echo "  3. Run: bash ${DEPLOY_PATH}/tools/deploy/release.sh --build-frontend"
echo "  4. Point Nginx root to ${DEPLOY_PATH}/backend/public and enable TLS with certbot --nginx."

