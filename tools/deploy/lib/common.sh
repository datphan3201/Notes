# shellcheck shell=bash
# Shared helpers for tools/deploy scripts. Sourced, never executed. setup.sh installs a
# root-owned copy at /usr/local/lib/planner/common.sh for the helpers that run through sudo
# or systemd, so they never execute code the deploy user can edit.

die() {
    echo "Error: $*" >&2
    exit 1
}

log() {
    echo "==> $*"
}

warn() {
    echo "Warning: $*" >&2
}

require_root() {
    [ "$(id -u)" -eq 0 ] || die "Run this script as root (use sudo)."
}

# Last KEY=value assignment in an env file, without surrounding quotes.
env_get() {
    local file="$1" key="$2"
    sed -n "s/^${key}=//p" "${file}" | tail -n 1 | sed -e 's/^"\(.*\)"$/\1/' -e "s/^'\(.*\)'$/\1/"
}

# Replace the first KEY=value line (or append one) in place, keeping the file's owner and mode.
env_set() {
    local file="$1" key="$2" value="$3" tmp
    tmp="$(mktemp)"
    awk -v key="${key}" -v value="${value}" '
        index($0, key "=") == 1 { if (!done) print key "=" value; done = 1; next }
        { print }
        END { if (!done) print key "=" value }
    ' "${file}" >"${tmp}"
    cat "${tmp}" >"${file}"
    rm -f "${tmp}"
}

# Resolve a configured path the same way ConfigLoader does (relative to backend/).
backend_path() {
    local backend_dir="$1" path="$2"
    case "${path}" in
        /*) printf '%s\n' "${path}" ;;
        *) printf '%s\n' "${backend_dir}/${path}" ;;
    esac
}

is_hostname() {
    [[ "$1" =~ ^[A-Za-z0-9]([A-Za-z0-9-]*[A-Za-z0-9])?(\.[A-Za-z0-9]([A-Za-z0-9-]*[A-Za-z0-9])?)+$ ]]
}

# Paths end up unquoted in .env, Nginx, systemd and cron files.
is_safe_path() {
    [[ "$1" =~ ^/[A-Za-z0-9._/-]+$ ]]
}
