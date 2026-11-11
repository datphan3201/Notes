# Offline Notes and PWA

[Documentation home](../../README.md) · [Route inventory](../../reference/routes.md)

IndexedDB stores account-scoped personal Note drafts/outbox. Offline creates/edits/deletes replay after reconnect. A stale edit recovers a copy while preserving remote text; deletion proceeds only against the unchanged owned version. Shared/password-protected Notes and private media are excluded.

The service worker caches only generic `/` and `/notes` navigation shells plus selected static assets. It never caches `/api/*` or private file responses. Other sections are not an offline editing feature. Cached data and sessions are origin-specific; moving between local/Funnel/Vercel origins does not transfer them. Logout clears account drafts/cache through the browser cleanup path.

<!-- BEGIN GENERATED TRACE -->

## Source and verification map

Trace ID: `notes.offline`. Test references identify coverage to inspect; they are not execution results.

| Role | Current source |
| --- | --- |
| UI | [apps/web/src/lib/offline-notes.ts](../../../apps/web/src/lib/offline-notes.ts#L53) — `export async function cachedNotes(` |
| Notes shell/static cache boundary | [apps/web/public/planner-sw.js](../../../apps/web/public/planner-sw.js#L2) — `const CACHE="planner-shell-v1";` |
| API / domain | [apps/api/planner/workspace.py](../../../apps/api/planner/workspace.py#L580) — `def apply_changes(` |
| API / domain | [apps/api/planner/planning.py](../../../apps/api/planner/planning.py#L284) — `def update(` |
| Related tests | [apps/api/tests/test_complete_workspace.py](../../../apps/api/tests/test_complete_workspace.py) |
| Related tests | [apps/web/tests/e2e/complete-features.spec.ts](../../../apps/web/tests/e2e/complete-features.spec.ts) |

<!-- END GENERATED TRACE -->
