#!/usr/bin/env bash
# Installs a short `planner` command (in ~/.local/bin) that serves this checkout publicly:
#
#   bash tools/dev/install-command.sh
#
#   planner            fixed address through Tailscale Funnel (tools/dev/funnel.sh)
#   planner tunnel     random address through Cloudflare quick tunnels (tools/dev/tunnel.sh)
#
# Other arguments are passed on, for example `planner --build`. Re-run after moving the checkout.
set -euo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"
BIN="${HOME}/.local/bin"
mkdir -p "${BIN}"
cat >"${BIN}/planner" <<SCRIPT
#!/usr/bin/env bash
# Made by ${ROOT}/tools/dev/install-command.sh.
case "\${1:-}" in
    tunnel) shift; exec bash "${ROOT}/tools/dev/tunnel.sh" "\$@" ;;
    funnel) shift ;;
esac
exec bash "${ROOT}/tools/dev/funnel.sh" "\$@"
SCRIPT
chmod 755 "${BIN}/planner"
echo "Installed ${BIN}/planner for ${ROOT}."
case ":${PATH}:" in
    *":${BIN}:"*) echo "Run: planner" ;;
    *) echo "Add ${BIN} to PATH (for example in ~/.bashrc: export PATH=\"\$HOME/.local/bin:\$PATH\"), then run: planner" ;;
esac
