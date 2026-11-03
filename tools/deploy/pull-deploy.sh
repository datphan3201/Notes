#!/usr/bin/env bash
# shellcheck disable=SC2154  # settings come from the sourced /etc/planner/*.conf
set -euo pipefail

# Pull-based continuous deployment. Asks GitHub for the newest DEPLOY_BRANCH commit whose CI
# workflow run succeeded, fast-forwards the checkout to it, runs release.sh and checks /up on the
# local app server. Runs as the deploy user from planner-deploy.timer (installed by setup.sh), so
# no inbound SSH or deployment secret is needed; it is also safe to run by hand.
# Usage:
#   bash tools/deploy/pull-deploy.sh [--force] [--dry-run]
# --force retries a commit that already failed and allows a non-fast-forward target.
# Private repositories (or a higher API rate limit) need a read-only token in
# ~/.config/planner/github-token (fine-grained: Actions read and Contents read).
#
# Everything runs inside main() and is invoked from a single line, because the checkout (and so
# this file) changes while it runs and bash reads scripts incrementally.

HOSTING_CONF="${PLANNER_HOSTING_CONF:-/etc/planner/hosting.conf}"

main() {
    local force=false dry_run=false root_dir
    for arg in "$@"; do
        case "${arg}" in
            --force) force=true ;;
            --dry-run) dry_run=true ;;
            *)
                echo "Usage: bash tools/deploy/pull-deploy.sh [--force] [--dry-run]" >&2
                return 1
                ;;
        esac
    done

    root_dir="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"
    # shellcheck source=lib/common.sh
    . "${root_dir}/tools/deploy/lib/common.sh"

    [ -f "${HOSTING_CONF}" ] || die "${HOSTING_CONF} is missing; run tools/deploy/setup.sh first."
    # shellcheck source=/dev/null
    . "${HOSTING_CONF}"
    [ "$(id -un)" = "${DEPLOY_USER}" ] || die "Run as ${DEPLOY_USER}, the owner of ${DEPLOY_PATH}."
    cd "${DEPLOY_PATH}"

    local state_dir failed_file token_file target current
    state_dir="${XDG_STATE_HOME:-${HOME}/.local/state}/planner"
    failed_file="${state_dir}/failed-revision"
    token_file="${XDG_CONFIG_HOME:-${HOME}/.config}/planner/github-token"
    mkdir -p "${state_dir}"

    # The token goes through a private header file, never the command line.
    HEADER_FILE="$(mktemp)"
    trap 'rm -f "${HEADER_FILE}"' EXIT
    printf 'Accept: application/vnd.github+json\nX-GitHub-Api-Version: 2022-11-28\n' >"${HEADER_FILE}"
    if [ -s "${token_file}" ]; then
        printf 'Authorization: Bearer %s\n' "$(tr -d '[:space:]' <"${token_file}")" >>"${HEADER_FILE}"
    fi

    target="$(curl -fsS --max-time 20 -H @"${HEADER_FILE}" \
        "https://api.github.com/repos/${GITHUB_REPO}/actions/workflows/${CI_WORKFLOW}/runs?branch=${DEPLOY_BRANCH}&event=push&status=success&per_page=1" \
        | jq -r '.workflow_runs[0].head_sha // empty')" || die "Cannot query GitHub Actions for ${GITHUB_REPO}."
    if [[ ! "${target}" =~ ^[0-9a-f]{40}$ ]]; then
        log "No successful ${CI_WORKFLOW} run on ${DEPLOY_BRANCH} yet; nothing to deploy."
        return 0
    fi

    current="$(git rev-parse HEAD)"
    [ "${target}" != "${current}" ] || return 0

    if [ "${force}" = false ] && [ "$(cat "${failed_file}" 2>/dev/null || true)" = "${target}" ]; then
        log "Skipping ${target}: its deployment already failed (fix forward, or retry with --force)."
        return 0
    fi
    # Never discard edits made on the host; ignored files (build output, .env, storage) are fine.
    [ -z "$(git status --porcelain --untracked-files=no)" ] \
        || die "Tracked files are modified on the host; commit or discard them before deploying."

    git fetch --quiet origin "${DEPLOY_BRANCH}"
    git cat-file -e "${target}^{commit}" 2>/dev/null || die "Commit ${target} is not reachable from origin/${DEPLOY_BRANCH}."
    if ! git merge-base --is-ancestor "${current}" "${target}"; then
        if git merge-base --is-ancestor "${target}" "${current}"; then
            log "The host is ahead of the newest green commit ${target}; nothing to deploy."
            return 0
        fi
        [ "${force}" = true ] || die "${target} does not fast-forward from ${current}; re-run with --force to deploy it anyway."
    fi

    if [ "${dry_run}" = true ]; then
        log "Would deploy ${current} -> ${target}."
        return 0
    fi

    if ! flock -n /tmp/planner-release.lock true; then
        log "Another release is running; trying again on the next run."
        return 0
    fi

    log "Deploying ${current} -> ${target}..."
    git checkout --quiet -B "${DEPLOY_BRANCH}" "${target}"

    local status=0
    bash tools/deploy/release.sh --build-frontend || status=$?

    if [ "${status}" -eq 4 ]; then
        git checkout --quiet -B "${DEPLOY_BRANCH}" "${current}"
        log "Another release started meanwhile; ${target} will be retried on the next run."
        return 0
    fi

    if [ "${status}" -eq 0 ] && health_check; then
        rm -f "${failed_file}"
        log "Deployed ${target}."
        return 0
    fi

    printf '%s\n' "${target}" >"${failed_file}"
    if [ "${status}" -eq 3 ]; then
        # release.sh exits 3 when it failed before touching the database: rolling back is safe.
        log "Release failed before migrations; rolling back to ${current}..."
        git checkout --quiet -B "${DEPLOY_BRANCH}" "${current}"
        bash tools/deploy/release.sh --build-frontend --skip-backup \
            || die "Rollback release of ${current} failed as well; the site needs manual repair."
        die "Deployment of ${target} failed and ${current} was restored."
    fi
    if [ "${status}" -eq 0 ]; then
        die "Released ${target}, but http://127.0.0.1:${LOCAL_APP_PORT}/up is unhealthy; inspect the Nginx and application logs."
    fi
    die "Deployment of ${target} failed after migrations started (exit ${status}); the host runs ${target}. Fix forward, or restore the pre-release backup in /var/backups/planner."
}

health_check() {
    curl -fsS --max-time 10 --retry 5 --retry-delay 2 --retry-all-errors \
        "http://127.0.0.1:${LOCAL_APP_PORT}/up" | jq -e '.data.status == "ok"' >/dev/null
}

main "$@"; exit $?
