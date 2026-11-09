# Note summaries and questions

[Documentation home](../../README.md) · [Route inventory](../../reference/routes.md)

Summary and question requests enqueue durable assistant jobs after ownership/password checks. They are read-only: no planning proposal is applied. A job targets the source version; the source is rechecked before a result is persisted. Password-protected, deleted, inaccessible or stale content must not be exposed through AI history.

Provider credentials remain server-only. Availability, retries, quotas and result polling/streaming use the shared AI infrastructure. A test with a fake provider establishes isolation and orchestration, not answer quality or citation faithfulness. Production quality and cost evidence remain ISSUE-047; broader assistant context selection is ISSUE-063.

<!-- BEGIN GENERATED TRACE -->

## Source and verification map

Trace ID: `notes.ai`. Test references identify coverage to inspect; they are not execution results.

| Role | Current source |
| --- | --- |
| Live Notes controls | [apps/web/src/components/preview/notes.tsx](../../../apps/web/src/components/preview/notes.tsx#L39) — `export default function NotesPreview({ text, taskId, resourceNoteId, onResourceClose }: { text: Text; taskId?: number; resourceNoteId?: string; onResourceClose?: () => void }) {` |
| API / domain | [apps/api/planner/note_features.py](../../../apps/api/planner/note_features.py#L158) — `def summarize(` |
| API / domain | [apps/api/planner/note_features.py](../../../apps/api/planner/note_features.py#L194) — `def question(` |
| API / domain | [apps/api/planner/ai.py](../../../apps/api/planner/ai.py#L243) — `def run_assistant(` |
| Related tests | [apps/api/tests/test_ai_jobs.py](../../../apps/api/tests/test_ai_jobs.py) |
| Related tests | [apps/api/tests/test_boundaries.py](../../../apps/api/tests/test_boundaries.py) |
| Related tests | [apps/web/tests/e2e/complete-features.spec.ts](../../../apps/web/tests/e2e/complete-features.spec.ts) |

<!-- END GENERATED TRACE -->
