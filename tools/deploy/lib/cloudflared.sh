# shellcheck shell=bash disable=SC2154
# Cloudflare Tunnel plumbing shared by the quick-tunnel and cloudflare-tunnel ingresses.
# Sourced by setup.sh after lib/common.sh.

install_cloudflared() {
    if ! command -v cloudflared >/dev/null 2>&1; then
        log "Installing cloudflared from Cloudflare's APT repository..."
        curl -fsSL https://pkg.cloudflare.com/cloudflare-public-v2.gpg -o /usr/share/keyrings/cloudflare-public-v2.gpg
        echo "deb [signed-by=/usr/share/keyrings/cloudflare-public-v2.gpg] https://pkg.cloudflare.com/cloudflared any main" \
            >/etc/apt/sources.list.d/cloudflared.list
        apt-get update -y
        apt-get install -y cloudflared
    fi
    if ! id cloudflared >/dev/null 2>&1; then
        useradd --system --no-create-home --shell /usr/sbin/nologin cloudflared
    fi
}

# $1: arguments after the global cloudflared flags; $2: extra [Service] lines.
# The tunnel only reaches the local app server, so cloudflared runs unprivileged.
write_tunnel_unit() {
    local arguments="$1" extra="$2" binary unit tmp
    binary="$(command -v cloudflared)"
    unit=/etc/systemd/system/planner-tunnel.service
    tmp="$(mktemp)"
    cat >"${tmp}" <<UNIT
[Unit]
Description=Planner Cloudflare Tunnel (${INGRESS})
After=network-online.target nginx.service
Wants=network-online.target

[Service]
User=cloudflared
ExecStart=${binary} tunnel --no-autoupdate --metrics ${TUNNEL_METRICS} ${arguments}
${extra}
Restart=on-failure
RestartSec=5s

[Install]
WantedBy=multi-user.target
UNIT
    # A restart gives a quick tunnel a new URL, so only restart when something changed.
    if ! cmp -s "${tmp}" "${unit}" || ! systemctl is-active --quiet planner-tunnel.service || [ "${TUNNEL_CONFIG_CHANGED:-false}" = true ]; then
        install -m 644 "${tmp}" "${unit}"
        systemctl daemon-reload
        systemctl enable planner-tunnel.service
        log "Starting planner-tunnel.service..."
        systemctl restart planner-tunnel.service
    fi
    rm -f "${tmp}"
}
