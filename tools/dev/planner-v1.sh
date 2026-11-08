#!/usr/bin/env bash
# Run the migration runtime with frontend, API and worker code watching.
set -euo pipefail

PLANNER_FUNNEL=false
case "${1:-}" in
    --funnel) PLANNER_FUNNEL=true ;;
    --help|-h) echo 'Usage: bash tools/dev/planner-v1.sh [--funnel]'; exit 0 ;;
    '') ;;
    *) echo 'Usage: bash tools/dev/planner-v1.sh [--funnel]' >&2; exit 1 ;;
esac

PLANNER_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"
PLANNER_API="${PLANNER_ROOT}/apps/api"
PLANNER_WEB="${PLANNER_ROOT}/apps/web"
PLANNER_LOGS="${PLANNER_ROOT}/output/playwright/planner-v1-dev"
mkdir -p "${PLANNER_LOGS}"
exec 9>"${PLANNER_LOGS}/run.lock"
if ! flock -n 9; then
    echo 'The Planner development launcher is already running.' >&2
    exit 1
fi

PLANNER_DOCKER_BIN="${PLANNER_DOCKER_BIN:-docker}"
for dependency in "${PLANNER_DOCKER_BIN}" uv npm setsid curl; do
    command -v "${dependency}" >/dev/null || { echo "Missing command: ${dependency}" >&2; exit 1; }
done
export PLANNER_ENVIRONMENT=development

cd "${PLANNER_ROOT}"
"${PLANNER_DOCKER_BIN}" compose up -d db --wait
cd "${PLANNER_API}"
uv sync --frozen --python 3.12
if [[ "${PLANNER_FUNNEL}" == true ]]; then
    command -v tailscale >/dev/null || { echo 'Tailscale is not installed.' >&2; exit 1; }
    PLANNER_FUNNEL_HOST="$(tailscale status --json | uv run python -c '
import json,re,sys
state=json.load(sys.stdin)
host=state.get("Self",{}).get("DNSName", "").rstrip(".")
if state.get("BackendState") != "Running" or not re.fullmatch(r"[a-z0-9][a-z0-9.-]*\.ts\.net", host):
    raise SystemExit("Connect Tailscale with a valid MagicDNS hostname first")
print(host)
')"
    tailscale funnel status --json | uv run python -c '
import json,sys
state=json.load(sys.stdin) or {}
if any(key.endswith(":443") and site.get("Handlers") for key,site in state.get("Web",{}).items()):
    raise SystemExit("HTTPS 443 already has Tailscale handlers; preserve them and stop that launcher first")
'
    export PLANNER_FUNNEL_ORIGIN="https://${PLANNER_FUNNEL_HOST}"
    export PLANNER_WEB_ORIGIN="${PLANNER_PRIMARY_WEB_ORIGIN:-${PLANNER_FUNNEL_ORIGIN}}"
    export PLANNER_DEVELOPMENT_ORIGINS
    PLANNER_DEVELOPMENT_ORIGINS="$(uv run python -c '
import json,os
origins=["http://localhost:3000",os.environ["PLANNER_FUNNEL_ORIGIN"]]
origins+=json.loads(os.environ.get("PLANNER_DEVELOPMENT_ORIGINS") or "[]")
print(json.dumps(list(dict.fromkeys(origins))))
')"
    export PLANNER_DEV_HOSTS="[\"${PLANNER_FUNNEL_HOST}\"]"
fi
if [[ ! -f .env ]]; then
    cp .env.example .env
fi
uv run python - <<'PY'
from pathlib import Path
import socket

from cryptography.fernet import Fernet
from dotenv import get_key, set_key
from sqlalchemy import text
from sqlalchemy.engine import make_url

path = Path('.env')
if not get_key(path, 'PLANNER_ENCRYPTION_KEY'):
    set_key(path, 'PLANNER_ENCRYPTION_KEY', Fernet.generate_key().decode())
path.chmod(0o600)

from planner.config import settings
from planner.db import engine

config = settings()
if make_url(config.database_url).database != 'planner_dev':
    raise SystemExit('Development launcher requires the planner_dev database')
with engine().connect() as connection:
    if connection.scalar(text('SELECT current_database()')) != 'planner_dev':
        raise SystemExit('Actual database is not planner_dev')
Fernet(config.encryption_key.get_secret_value().encode())
for port in (3000, 8001):
    with socket.socket() as probe:
        probe.setsockopt(socket.SOL_SOCKET, socket.SO_REUSEADDR, 1)
        try:
            probe.bind(('127.0.0.1', port))
        except OSError:
            raise SystemExit(f'Port {port} is already in use; stop that server first') from None
print('Features configured:', {
    'AI': bool(config.ai_api_key.get_secret_value() and config.ai_model),
    'semantic_search': bool(config.embedding_model and config.ai_api_key.get_secret_value()),
    'email': bool(config.smtp_host and config.smtp_from),
    'TOTP': True,
})
PY
uv run alembic upgrade head
cd "${PLANNER_WEB}"
npm ci --no-audit --no-fund

PLANNER_CHILDREN=()
PLANNER_FUNNEL_ACTIVE=false
cleanup() {
    trap - EXIT INT TERM
    if [[ "${PLANNER_FUNNEL_ACTIVE}" == true ]]; then
        tailscale funnel --https=443 --set-path=/ off >/dev/null 2>&1 || true
    fi
    for child in "${PLANNER_CHILDREN[@]}"; do
        kill -TERM -- "-${child}" 2>/dev/null || true
    done
    wait "${PLANNER_CHILDREN[@]}" 2>/dev/null || true
}
trap cleanup EXIT
trap 'exit 0' INT TERM

(
    cd "${PLANNER_API}"
    exec setsid uv run uvicorn planner.main:app --host 127.0.0.1 --port 8001 \
        --reload --reload-dir . --reload-include .env \
        --reload-exclude .venv --reload-exclude .private --reload-exclude tests \
        --timeout-graceful-shutdown 3
) >"${PLANNER_LOGS}/api.log" 2>&1 &
PLANNER_CHILDREN+=("$!")
(
    cd "${PLANNER_API}"
    exec setsid uv run watchfiles --target-type command 'python -m planner.jobs' planner .env
) >"${PLANNER_LOGS}/worker.log" 2>&1 &
PLANNER_CHILDREN+=("$!")
(
    cd "${PLANNER_WEB}"
    export API_ORIGIN=http://127.0.0.1:8001
    exec setsid npm run dev
) >"${PLANNER_LOGS}/web.log" 2>&1 &
PLANNER_CHILDREN+=("$!")

echo "Starting frontend, API and worker. Logs: ${PLANNER_LOGS}"
curl --fail --silent --retry 30 --retry-connrefused --retry-delay 1 \
    http://127.0.0.1:8001/ready >/dev/null
curl --fail --silent --retry 30 --retry-connrefused --retry-delay 1 \
    http://localhost:3000/login >/dev/null
echo 'Planner is ready: http://localhost:3000 (frontend/API/worker auto-reload enabled)'
if [[ "${PLANNER_FUNNEL}" == true ]]; then
    PLANNER_FUNNEL_ACTIVE=true
    tailscale funnel --bg --https=443 --set-path=/ "http://127.0.0.1:3000"
    echo "Planner is public: ${PLANNER_FUNNEL_ORIGIN} (auto-reload enabled)"
    echo "Primary browser/email origin: ${PLANNER_WEB_ORIGIN}"
fi
wait -n "${PLANNER_CHILDREN[@]}"
