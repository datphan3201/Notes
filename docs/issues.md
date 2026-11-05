# Open issues

[Documentation home](README.md) · [Changelog](../CHANGELOG.md)

Known problems and pending decisions that are **not** resolved. When an issue is fixed, delete its entry in the same change and describe the fix in the [changelog](../CHANGELOG.md); resolved reports remain in Git history. Do not change behavior just because it is listed here; confirm intent first.

## Reporting rules

- One entry per problem, with a stable ID (continue numbering from the highest ID ever used: next is ISSUE-037).
- State affected UI/source, observed versus expected behavior, impact, evidence type (reproduced / source-inspected / report), limits, and the proposed next step.
- Severity: **High** (data loss, security, unusable core flow), **Medium** (wrong behavior with a workaround), **Low** (cosmetic, documentation or operational friction).
- Status: **Open**, **Needs decision** or **In progress**.

| ID | Issue | Severity | Status |
| --- | --- | --- | --- |
| [ISSUE-007](#issue-007--archify-html-contains-trailing-whitespace) | Archify HTML contains trailing whitespace | Low | Open |
| [ISSUE-035](#issue-035--live-collaboration-needs-a-websocket-proxy-that-the-existing-runtime-lacks) | Live collaboration needs a WebSocket proxy that the existing runtime lacks | Low | Open |
| [ISSUE-036](#issue-036--archify-diagrams-predate-note-passwords-collaboration-ai-and-offline) | Archify diagrams predate Note passwords, collaboration, AI and offline | Low | Open |

## ISSUE-007 — Archify HTML contains trailing whitespace

- **Status:** Open.
- **Affected:** delivered `index.html` files under [diagrams](diagrams/README.md).
- **Observed:** each carries 15–18 lines with trailing spaces, so a full `git diff --check` over the tree reports them. Generated Markdown is already clean.
- **Constraint:** the HTML is pinned by SHA-256 in each `index.finalize-summary.json`; hand-editing invalidates the receipt and fails `php tools/docs/check.php`.
- **Next step:** regenerate through the Archify delivery workflow and refresh the receipts.

## ISSUE-035 — Live collaboration needs a WebSocket proxy that the existing runtime lacks

- **Status:** Open (operational limitation).
- **Affected:** [live collaboration](ui/notes/collaboration.md), [existing-runtime deployment](operations/deployment.md#reuse-an-already-running-php-server-and-cloudflare-tunnel).
- **Observed:** the `php -S` + quick-tunnel runtime cannot upgrade `/realtime`, so shared Notes autosave there without live updates. Hosts provisioned by `tools/deploy/setup.sh` (Nginx + `planner-realtime`) serve live editing.
- **Next step:** move the public runtime to the Nginx setup, or run `bin/realtime.php` behind a second tunnel hostname and set `REALTIME_PUBLIC_URL` to its `wss://` URL.

## ISSUE-036 — Archify diagrams predate Note passwords, collaboration, AI and offline

- **Status:** Open.
- **Affected:** [system](diagrams/system/index.html) and Notes maps under [diagrams](diagrams/README.md).
- **Observed:** all nine maps pin implementation 2e9e68d; they do not show the realtime process, Note passwords, AI summary/questions or the service worker/IndexedDB path. The Markdown traces are current.
- **Next step:** update the system and Notes candidates through Archify and refresh receipts (fixes ISSUE-007 at the same time).

## New issue template

```text
ISSUE-NNN — Concrete title
Status:
Severity and impact:
Affected route / component Trace ID:
Observed behavior:
Expected behavior or pending decision:
Evidence type and limits:
Next step:
```
