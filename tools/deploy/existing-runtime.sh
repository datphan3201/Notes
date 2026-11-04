#!/usr/bin/env bash
set -euo pipefail

# Pull green main into an existing, clean main checkout. Keep its server, tunnel, .env and data.
# Schema/dependency changes require the backed-up release flow; this mode never migrates.
main() {
    local dry_run=false retry=false root_dir branch current target state_dir stage url metrics failed
    for arg in "$@"; do
        case "${arg}" in
            --dry-run) dry_run=true ;;
            --retry) retry=true ;;
            *) echo 'Usage: bash tools/deploy/existing-runtime.sh [--dry-run] [--retry]' >&2; return 1 ;;
        esac
    done
    root_dir="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"
    cd "${root_dir}"
    branch="$(git branch --show-current)"
    if [ "${branch}" != main ]; then
        echo 'Existing runtime: checkout is not on main; preserving the working branch.'
        return 0
    fi
    if [ -n "$(git status --porcelain)" ]; then
        echo 'Existing runtime: uncommitted files present; preserving the working tree.'
        return 0
    fi
    state_dir="${PLANNER_RUNTIME_STATE:-${XDG_STATE_HOME:-${HOME}/.local/state}/planner-existing-runtime}"
    umask 077
    mkdir -p "${state_dir}"
    exec 9>"${state_dir}/deploy.lock"
    flock -n 9 || return 0
    current="$(git rev-parse HEAD)"
    target="$(gh api 'repos/datphan3201/Notes/actions/workflows/ci-cd.yml/runs?branch=main&event=push&status=success&per_page=1' --jq '.workflow_runs[0].head_sha // empty')"
    if [ -z "${target}" ]; then echo 'No successful main push CI run yet.'; return 0; fi
    [[ "${target}" =~ ^[0-9a-f]{40}$ ]] || { echo 'Invalid CI revision.' >&2; return 1; }
    failed="${state_dir}/failed-revision"
    if [ "${target}" = "${current}" ] && [ ! -f "${failed}" ]; then return 0; fi
    if [ "${retry}" = false ] && [ "$(cat "${failed}" 2>/dev/null || true)" = "${target}" ]; then
        echo 'This revision failed previously; use --retry after inspecting the failure.'
        return 0
    fi
    git fetch --quiet origin main
    git merge-base --is-ancestor "${target}" origin/main || { echo 'CI revision is not on origin/main.' >&2; return 1; }
    if [ "${target}" != "${current}" ] && git merge-base --is-ancestor "${target}" "${current}"; then echo 'Checkout is already ahead of the green revision.'; return 0; fi
    git merge-base --is-ancestor "${current}" "${target}" || { echo 'Green revision does not fast-forward this checkout.' >&2; return 1; }
    # This is the owner's live database/dependency installation, not the isolated CI fixture.
    if [ -n "$(git diff --name-only "${current}" "${target}" -- backend/database/plain-migrations backend/composer.json backend/composer.lock)" ]; then
        echo 'Schema/backend dependency changes require the backed-up release procedure; no checkout change.' >&2
        return 1
    fi
    if [ "${dry_run}" = true ]; then echo "Would deploy CI-approved ${current} -> ${target} using the existing runtime."; return 0; fi
    [ -f backend/.env ] || { echo 'backend/.env is missing.' >&2; return 1; }
    # Detect pre-existing schema drift, read-only, before preparing or publishing anything.
    (cd backend && php bin/console migrate:check)
    stage="$(mktemp -d "${state_dir}/release.XXXXXXXX")"
    RUNTIME_STAGE_DIR="${stage}"
    trap 'rm -rf -- "${RUNTIME_STAGE_DIR}"' EXIT
    printf '%s\n' "${target}" >"${failed}"
    git archive "${target}" | tar -x -C "${stage}"
    # The candidate is built off-line, without copying .env or starting another server.
    (cd "${stage}/frontend" && npm ci && npm run build)
    [ -s "${stage}/backend/public/build/manifest.json" ] || { echo 'Candidate build has no manifest.' >&2; return 1; }
    # A user may have switched branches or edited files while npm ran.
    [ "$(git branch --show-current)" = main ] && [ "$(git rev-parse HEAD)" = "${current}" ] && [ -z "$(git status --porcelain)" ] \
        || { echo 'Checkout changed during preparation; nothing published.' >&2; return 1; }
    mkdir -p backend/public/build/assets
    # Keep old hashed assets for tabs already open; publish the new manifest atomically last.
    cp -a "${stage}/backend/public/build/assets/." backend/public/build/assets/
    git merge --ff-only --no-edit "${target}"
    install -m 644 "${stage}/backend/public/build/manifest.json" backend/public/build/.manifest.deploy.json
    mv backend/public/build/.manifest.deploy.json backend/public/build/manifest.json
    metrics="${PLANNER_TUNNEL_METRICS:-}"
    url=""
    if [ -n "${metrics}" ]; then
        url="$(curl -fsS --max-time 5 "http://${metrics}/quicktunnel" | node -e 'const fs=require("fs");const host=JSON.parse(fs.readFileSync(0,"utf8")).hostname;if(typeof host!=="string"||!/^[-a-z0-9.]+$/.test(host))process.exit(1);process.stdout.write("https://"+host)' )"
    else
        # Read data, never source an env file as shell code.
        url="$(sed -n 's/^APP_URL=//p' backend/.env | tail -n 1 | sed -e 's/^"\(.*\)"$/\1/' -e "s/^'\(.*\)'$/\1/")"
    fi
    [[ "${url}" =~ ^https?://[^[:space:]]+$ ]] || { echo 'No valid runtime URL.' >&2; return 1; }
    curl -fsS --max-time 20 --retry 3 --retry-delay 2 "${url%/}/up" | node -e 'const fs=require("fs");if(JSON.parse(fs.readFileSync(0,"utf8")).data?.status!=="ok")process.exit(1)' 
    rm -f "${failed}"
    echo "Deployed ${target}; existing server/tunnel health passed."
    # A failed health check leaves the new source in place for a forward fix, never a DB reset.
}
main "$@"; exit $?
