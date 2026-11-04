#!/usr/bin/env bash
set -euo pipefail
# Install a user timer; no provisioning, server restart, root access or credentials in the unit.
ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"
METRICS="${PLANNER_TUNNEL_METRICS:-}"
[[ "${ROOT_DIR}" =~ ^/[A-Za-z0-9._/-]+$ ]] || { echo 'Unsupported checkout path.' >&2; exit 1; }
[[ -z "${METRICS}" || "${METRICS}" =~ ^127\.0\.0\.1:[0-9]+$ ]] || { echo 'Metrics must be a loopback address.' >&2; exit 1; }
# Resolve only the tools this service needs; an interactive PATH can contain Windows paths
# with spaces, which must not become unquoted systemd environment assignments.
RUNTIME_PATH=/usr/local/bin:/usr/bin:/bin
for tool in node npm php gh git curl flock tar; do
    tool_dir="$(dirname "$(command -v "${tool}")")"
    [[ "${tool_dir}" =~ ^/[A-Za-z0-9._/-]+$ ]] || { echo "Unsupported executable path for ${tool}." >&2; exit 1; }
    case ":${RUNTIME_PATH}:" in
        *":${tool_dir}:"*) ;;
        *) RUNTIME_PATH="${tool_dir}:${RUNTIME_PATH}" ;;
    esac
done
[ -f "${ROOT_DIR}/backend/.env" ] || { echo 'backend/.env is missing.' >&2; exit 1; }
UNIT_DIR="${XDG_CONFIG_HOME:-${HOME}/.config}/systemd/user"
mkdir -p "${UNIT_DIR}"
cat >"${UNIT_DIR}/planner-existing-runtime.service" <<UNIT
[Unit]
Description=Deploy green Planner main using its existing runtime
After=network-online.target

[Service]
Type=oneshot
WorkingDirectory=${ROOT_DIR}
Environment=PATH=${RUNTIME_PATH}
Environment=PLANNER_TUNNEL_METRICS=${METRICS}
ExecStart=/usr/bin/bash ${ROOT_DIR}/tools/deploy/existing-runtime.sh
UNIT
cat >"${UNIT_DIR}/planner-existing-runtime.timer" <<'UNIT'
[Unit]
Description=Check green Planner main every two minutes

[Timer]
OnActiveSec=2min
OnUnitActiveSec=2min
RandomizedDelaySec=10s

[Install]
WantedBy=timers.target
UNIT
systemctl --user daemon-reload
systemctl --user enable --now planner-existing-runtime.timer
echo 'Existing-runtime timer enabled; feature branches and dirty checkouts are preserved.'
