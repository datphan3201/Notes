# Habits

[Documentation home](../../README.md) · [Route inventory](../../reference/routes.md)

Habits have dedicated dated check-ins, daily/weekly targets, rest planning and streaks. They never contribute to Goal percentage. A check-in uses the Habit timezone; timezone/period rules freeze once history exists, including after a check-in is cleared.

Actual done/undo transitions feed Activity; planned rest is future-only, cancelable and does not fabricate completion Activity. Rest days do not count as successful days. Server validation and the domain streak functions define weekly boundaries, partial first weeks and unfinished today behavior.

<!-- BEGIN GENERATED TRACE -->

## Source and verification map

Trace ID: `habits`. Test references identify coverage to inspect; they are not execution results.

| Role | Current source |
| --- | --- |
| Live UI view (via WorkspaceView) | [apps/web/src/components/preview/habits.tsx](../../../apps/web/src/components/preview/habits.tsx#L28) — `export default function HabitsPreview({ text }: { text: Text }) {` |
| API / domain | [apps/api/planner/planning.py](../../../apps/api/planner/planning.py#L765) — `def checkin(` |
| API / domain | [apps/api/planner/planning.py](../../../apps/api/planner/planning.py#L800) — `def habit_days(` |
| Related tests | [apps/api/tests/test_domain.py](../../../apps/api/tests/test_domain.py) |
| Related tests | [apps/api/tests/test_complete_workspace.py](../../../apps/api/tests/test_complete_workspace.py) |
| Related tests | [apps/api/tests/test_workspace_ui.py](../../../apps/api/tests/test_workspace_ui.py) |
| Related tests | [apps/web/tests/e2e/complete-features.spec.ts](../../../apps/web/tests/e2e/complete-features.spec.ts) |

<!-- END GENERATED TRACE -->
