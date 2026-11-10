# Floating AI assistant

[Documentation home](../../README.md) · [Route inventory](../../reference/routes.md)

The assistant uses durable runs: enqueue with `POST /api/v1/assistant/runs`, observe authenticated SSE/read fallback, then review a proposal. Read tools execute against owned active records; supported writes only compile a proposal. Nothing mutates until the user confirms its exact hash and required acknowledgements. Apply rechecks current versions/permissions and commits ordinary domain writes atomically. Reject persists and prevents later Apply.

The [tool catalogue](../../migration/assistant-tools.md) describes the 35 named tools, graph refs, structural guards and Calendar moves. Password-protected Notes and received shares are excluded from assistant context. Provider calls run outside business write transactions.

Reload restores owner-scoped paged history. Stop waiting pauses browser observation, not the worker; Reconnect resumes. Clearing visible history preserves durable runs/usage/approvals. Source access is rechecked before historical content is shown. Context relevance/source-chip noise remains ISSUE-063; quality, cost and paid-release evidence remain ISSUE-047.

<!-- BEGIN GENERATED TRACE -->

## Source and verification map

Trace ID: `shared.ai`. Test references identify coverage to inspect; they are not execution results.

| Role | Current source |
| --- | --- |
| UI | [apps/web/src/components/live-assistant.tsx](../../../apps/web/src/components/live-assistant.tsx#L115) — `export default function LiveAssistant(` |
| API / domain | [apps/api/planner/ai.py](../../../apps/api/planner/ai.py#L243) — `def run_assistant(` |
| API / domain | [apps/api/planner/ai.py](../../../apps/api/planner/ai.py#L148) — `def apply_proposal(` |
| API / domain | [apps/api/planner/main.py](../../../apps/api/planner/main.py#L631) — `def assistant_history(` |
| Related tests | [apps/api/tests/test_ai_jobs.py](../../../apps/api/tests/test_ai_jobs.py) |
| Related tests | [apps/api/tests/test_assistant_tools.py](../../../apps/api/tests/test_assistant_tools.py) |
| Related tests | [apps/web/tests/e2e/complete-features.spec.ts](../../../apps/web/tests/e2e/complete-features.spec.ts) |

<!-- END GENERATED TRACE -->
