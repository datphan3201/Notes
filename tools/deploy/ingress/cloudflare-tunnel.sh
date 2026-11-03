# shellcheck shell=bash disable=SC2034,SC2154
# Ingress: named Cloudflare Tunnel for a hostname on a Cloudflare-managed DNS zone. No open
# ports; Cloudflare terminates TLS. Create the tunnel in Zero Trust (Networks > Tunnels), copy
# its token into a file and pass --tunnel-token-file; the token is kept in a root-only file.

INGRESS_TRUSTS_CLOUDFLARE=true
TUNNEL_ENV_FILE="${CONFIG_DIR}/cloudflared.env"

ingress_validate() {
    is_hostname "${DOMAIN}" || die "--domain must be the tunnel's public hostname, e.g. notes.example.com."
    if [ -n "${TUNNEL_TOKEN_FILE}" ]; then
        [ -s "${TUNNEL_TOKEN_FILE}" ] || die "Tunnel token file ${TUNNEL_TOKEN_FILE} is empty or missing."
    elif [ ! -s "${TUNNEL_ENV_FILE}" ]; then
        die "--tunnel-token-file is required the first time the cloudflare-tunnel ingress is set up."
    fi
}

ingress_app_url() {
    echo "https://${DOMAIN}"
}

ingress_public_server() {
    :
}

ingress_install() {
    install_cloudflared
    if [ -n "${TUNNEL_TOKEN_FILE}" ]; then
        local token
        token="$(tr -d '[:space:]' <"${TUNNEL_TOKEN_FILE}")"
        [[ "${token}" =~ ^[A-Za-z0-9+/=_.-]{20,}$ ]] || die "${TUNNEL_TOKEN_FILE} does not look like a Cloudflare Tunnel token."
        (
            umask 077
            printf 'TUNNEL_TOKEN=%s\n' "${token}" >"${TUNNEL_ENV_FILE}"
        )
        TUNNEL_CONFIG_CHANGED=true
    fi
    write_tunnel_unit "run" "EnvironmentFile=${TUNNEL_ENV_FILE}"
    PUBLIC_URL="https://${DOMAIN}"
}

ingress_summary() {
    echo "  - In Cloudflare Zero Trust > Networks > Tunnels > (this tunnel) > Public hostnames, route"
    echo "    ${DOMAIN} to service HTTP 127.0.0.1:${LOCAL_APP_PORT}. Cloudflare creates the DNS record."
    echo "  - Delete ${TUNNEL_TOKEN_FILE:-the token file you passed} now that the token is stored in ${TUNNEL_ENV_FILE}."
}
