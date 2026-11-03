# shellcheck shell=bash disable=SC2034,SC2154
# Ingress: public Nginx on ports 80/443 with a Let's Encrypt certificate. Works with any DNS
# provider: point an A/AAAA record for --domain at this host and allow TCP 80/443 in the cloud
# firewall (for Oracle: the VCN security list or NSG).

INGRESS_TRUSTS_CLOUDFLARE=false

ingress_validate() {
    is_hostname "${DOMAIN}" || die "--domain must be a DNS name that points to this host."
    if [ "${SKIP_TLS}" = false ]; then
        [[ "${EMAIL}" =~ ^[^@[:space:]]+@[^@[:space:]]+\.[^@[:space:]]+$ ]] \
            || die "--email is required for Let's Encrypt (or pass --skip-tls)."
    fi
}

ingress_app_url() {
    echo "https://${DOMAIN}"
}

ingress_public_server() {
    cat <<NGINX
# Certbot adds the TLS directives and the HTTP redirect to this block.
server {
    listen 80;
    listen [::]:80;
    server_name ${DOMAIN};
    include snippets/planner-app.conf;
}
NGINX
}

# Some images (Oracle's included) end INPUT with a REJECT rule, so ACCEPT rules go before it.
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

ingress_install() {
    log "Opening HTTP (80) and HTTPS (443) in host iptables..."
    apt-get install -y iptables certbot python3-certbot-nginx
    open_port 80
    open_port 443
    if command -v netfilter-persistent >/dev/null 2>&1; then
        netfilter-persistent save
    else
        warn "netfilter-persistent is not installed; the port 80/443 rules will not survive a reboot."
    fi

    if [ "${SKIP_TLS}" = false ]; then
        log "Requesting the Let's Encrypt certificate and enabling the HTTPS redirect..."
        certbot --nginx --non-interactive --agree-tos --keep-until-expiring --redirect \
            --email "${EMAIL}" -d "${DOMAIN}"
        systemctl reload nginx
    fi
    PUBLIC_URL="https://${DOMAIN}"
}

ingress_summary() {
    echo "  - Allow ingress TCP 80 and 443 in the cloud firewall (Oracle: VCN security list or NSG)."
    if [ "${SKIP_TLS}" = true ]; then
        echo "  - TLS was skipped. Production cookies are Secure-only, so sign-in fails over plain HTTP:"
        echo "    re-run setup without --skip-tls once DNS for ${DOMAIN} points here."
    else
        echo "  - certbot.timer renews the certificate automatically."
    fi
}
