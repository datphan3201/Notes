# Shared steps of the "serve this checkout publicly" scripts (tunnel.sh, funnel.sh).
# Sourced, not run. The caller sets APP_PORT, RT_PORT, BUILD, REALTIME and ASSUME_YES first.
# shellcheck shell=bash

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"
BACKEND="${ROOT}/backend"
RUN_DIR="$(mktemp -d "${TMPDIR:-/tmp}/planner-serve.XXXXXX")"
LOG_DIR="${BACKEND}/storage/logs/tunnel"
mkdir -p "${LOG_DIR}"
PIDS=()
# Extra cleanup a script needs on exit (for example turning Funnel off); a function name.
CLEANUP_HOOK=""

say() { printf '\033[1;36m==>\033[0m %s\n' "$*"; }
die() { printf '\033[1;31mError:\033[0m %s\n' "$*" >&2; exit 1; }

cleanup() {
    trap - EXIT INT TERM
    if [ -n "${CLEANUP_HOOK}" ]; then "${CLEANUP_HOOK}" || true; fi
    if [ "${#PIDS[@]}" -gt 0 ]; then
        say "Stopping…"
        kill "${PIDS[@]}" 2>/dev/null || true
        wait "${PIDS[@]}" 2>/dev/null || true
    fi
    rm -rf "${RUN_DIR}"
}
trap cleanup EXIT INT TERM

port_free() { ! (exec 3<>"/dev/tcp/127.0.0.1/$1") 2>/dev/null; }

free_port() {
    local port="$1"
    while ! port_free "${port}"; do port=$((port + 1)); done
    echo "${port}"
}

# PHP, the app's configuration and dependencies, and a free app port.
require_runtime() {
    command -v php >/dev/null || die "php is not on PATH."
    command -v curl >/dev/null || die "curl is not on PATH."
    [ -f "${BACKEND}/.env" ] || die "backend/.env is missing; see docs/operations/installation.md."
    [ -d "${BACKEND}/vendor" ] || die "backend/vendor is missing; run composer install in backend first."
    port_free "${APP_PORT}" || die "Port ${APP_PORT} is in use (another PHP server?). Stop it or pass --port."
    if [ "${REALTIME}" = true ]; then
        RT_PORT="$(free_port "${RT_PORT}")"
    fi
}

# Refuses to serve an outdated schema: pending migrations are applied after a backup (asked first
# unless --yes).
prepare_database() {
    cd "${BACKEND}"
    local status pending db_name backup answer
    # Checked on its own: inside a pipeline a failure would end the script without a word.
    if ! status="$(php bin/console migrate:status 2>/dev/null)"; then
        local target
        target="$(php -r 'require "vendor/autoload.php"; $c=(new Planner\Config\ConfigLoader)->load(getcwd()); echo $c->string("database.host"), ":", $c->int("database.port");' 2>/dev/null || echo "the configured host")"
        die "Cannot reach the database at ${target}. Start it first (for example Docker Desktop, or: sudo service mysql start), then run this again."
    fi
    pending="$(printf '%s\n' "${status}" | awk '$1 == "pending" {print $2}')"
    if [ -n "${pending}" ]; then
        db_name="$(php -r 'require "vendor/autoload.php"; echo (new Planner\Config\ConfigLoader)->load(getcwd())->string("database.name");')"
        say "Database ${db_name} has pending migrations:"
        printf '      %s\n' ${pending}
        if [ "${ASSUME_YES}" != true ]; then
            read -r -p "Back up ${db_name} and apply them now? [y/N] " answer
            [[ "${answer}" =~ ^[Yy]$ ]] || die "The app needs these migrations; nothing was changed."
        fi
        mkdir -p "${BACKEND}/storage/app/private/backups"
        backup="${BACKEND}/storage/app/private/backups/${db_name}-$(date -u +%Y%m%dT%H%M%SZ).sql.gz"
        if command -v mysqldump >/dev/null; then
            # Credentials go through a private option file, never the command line.
            php -r 'require "vendor/autoload.php"; $c=(new Planner\Config\ConfigLoader)->load(getcwd());
                printf("[client]\nhost=%s\nport=%d\nuser=%s\npassword=\"%s\"\n", $c->string("database.host"), $c->int("database.port"),
                $c->string("database.user"), addcslashes($c->string("database.password"), "\\\""));' >"${RUN_DIR}/my.cnf"
            chmod 600 "${RUN_DIR}/my.cnf"
            # pipefail stops here if the dump fails, before any migration runs.
            mysqldump --defaults-extra-file="${RUN_DIR}/my.cnf" --single-transaction --no-tablespaces "${db_name}" | gzip >"${backup}"
            say "Backup written to ${backup}"
        else
            [ "${ASSUME_YES}" = true ] || read -r -p "mysqldump is not installed, so no backup can be made. Continue anyway? [y/N] " answer
            [ "${ASSUME_YES}" = true ] || [[ "${answer}" =~ ^[Yy]$ ]] || die "Install the MySQL client tools (mysqldump) and run again."
        fi
        php bin/console migrate
    fi
    php bin/console migrate:check
}

build_frontend() {
    if [ "${BUILD}" = true ]; then
        command -v npm >/dev/null || die "npm is not on PATH (or pass --no-build)."
        say "Building the frontend…"
        (cd "${ROOT}/frontend" && { [ -d node_modules ] || npm ci --silent; } && npm run --silent build >/dev/null)
    fi
    [ -f "${BACKEND}/public/build/manifest.json" ] || die "No built assets; run without --no-build."
}

# Starts the realtime server (when enabled) and the PHP server with the environment overrides the
# caller exported (APP_URL, REALTIME_*); backend/.env is never edited.
start_app() {
    cd "${BACKEND}"
    export VITE_DEV_URL="" SESSION_SECURE_COOKIE=true
    if [ "${REALTIME}" = true ]; then
        php bin/realtime.php >"${LOG_DIR}/realtime.log" 2>&1 &
        PIDS+=("$!")
    fi
    PHP_CLI_SERVER_WORKERS=4 php -d opcache.enable=0 -S "127.0.0.1:${APP_PORT}" -t public dev-router.php \
        >"${LOG_DIR}/php.log" 2>&1 &
    PIDS+=("$!")
}

wait_until_up() {
    say "Waiting for the public URL to answer…"
    for _ in $(seq 1 60); do
        curl -fsS --max-time 5 "${APP_URL}/up" >/dev/null 2>&1 && return 0
        sleep 2
    done
    say "The public URL is slow to answer; it usually works within a minute."
}
