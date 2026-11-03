# shellcheck shell=bash disable=SC2034,SC2154
# Ingress: Cloudflare quick tunnel. No account, domain or open ports; Cloudflare assigns a random
# https://*.trycloudflare.com URL. Intended for trying deployments: the URL changes whenever the
# tunnel restarts, so planner-tunnel-url rewrites APP_URL (CSRF origin checks and mail links)
# each time. Quick tunnels have no uptime guarantee; switch to cloudflare-tunnel or direct for real use.

INGRESS_TRUSTS_CLOUDFLARE=true

ingress_validate() {
    if [ -n "${DOMAIN}" ]; then
        warn "--domain is ignored by the quick-tunnel ingress."
        DOMAIN=""
    fi
}

# The URL is only known once the tunnel is up; planner-tunnel-url sets APP_URL.
ingress_app_url() {
    :
}

ingress_public_server() {
    :
}

ingress_install() {
    install_cloudflared
    write_tunnel_unit "--url http://127.0.0.1:${LOCAL_APP_PORT}" "ExecStartPost=+/usr/local/sbin/planner-tunnel-url"
    PUBLIC_URL="$(cat "${CONFIG_DIR}/public-url" 2>/dev/null || true)"
    [ -n "${PUBLIC_URL}" ] || die "The quick tunnel did not report its URL; inspect: journalctl -u planner-tunnel"
}

ingress_summary() {
    echo "  - The quick tunnel URL changes whenever planner-tunnel restarts (including reboots)."
    echo "    Current URL: cat ${CONFIG_DIR}/public-url    Logs: journalctl -u planner-tunnel"
    echo "  - For a stable address, re-run setup with --ingress cloudflare-tunnel or --ingress direct."
}
