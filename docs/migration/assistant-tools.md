# Assistant tool parity

[Integration](ui-integration.md) · [Status](status.md) · [Retained baseline](../ui/shared/ai.md)

The migrated assistant now advertises the same **35 named tools** as the retained `AIChatService` catalogue. The earlier two generic tools were insufficient for whole-roadmap actions and same-request parent references. This follow-up replaces that advertised catalogue with named planning tools and a proposal compiler; it does not add external browsing or code execution.

| Tool group | Names / supported behavior |
| --- | --- |
| Read | `list_areas`; `search_tasks`, `get_task`; `search_notes`, `get_note`; `search_goals`, `get_goal`; `get_roadmap`; `search_habits`, `get_habit` |
| Roadmaps | `create_roadmap` creates or reuses one Goal and queues its Milestones, their Tasks and optional ordered prerequisite chain. `create_milestones` adds phases/tasks to an existing or newly queued Goal |
| Goals | `create_goal`, `update_goal`, `complete_goal`, `reopen_goal`, `delete_goal` |
| Milestones | `update_milestone`, `complete_milestone`, `reopen_milestone`, `delete_milestone`; create through `create_milestones` |
| Tasks | `create_tasks`, `update_task`, `complete_task`, `reopen_task`, `delete_task`, `move_tasks`, `reschedule` |
| Habits | `create_habit`, `update_habit`, `delete_habit`, `check_in_habit` |
| Notes | `create_note`, `update_note`, `delete_note` |

Read tools execute immediately against owned active records. Password-protected Notes and received shares are excluded, and inaccessible IDs return no foreign data. Results contain versions and parent/date context. Search is literal text matching with bounded results; `get_roadmap` returns the bounded Goal/Milestone/Task structure and prerequisites.

Write tools **only compile one proposal**, with at most 50 changes and six model rounds per request. Temporary refs (`c1`, `c2`, etc.) connect a new Goal, its Milestones and Tasks before database IDs exist. Each tool call either queues its entire group or restores the previous queue. Goal duplicates, phases pretending to be child Goals and delete/recreate restructuring are guarded. Existing Tasks move with their IDs, checklist and history preserved. When the recreation guard withdraws queued operations, the persisted proposal is refreshed from the remaining queue; an empty queue leaves no stale destructive card.

The confirmation card resolves new references to human names. The user reviews every operation and explicitly checks any required unchecked-checklist, unfinished-child or completed-parent acknowledgement. Apply verifies the exact proposal hash, source ownership/versions and ordered reference types, then invokes the same transactional workspace/domain service as ordinary UI writes. Local refs are namespaced per run to prevent collisions between different proposals. Domain changes, outbox work and the applied marker commit together. Retried Apply returns the original result without duplicate records.

Planning delete tools archive work; deleting a Note permanently removes it and queues private-file cleanup. A Milestone must have no remaining Tasks; queued moves/archives can empty it first. Calendar moves preserve local wall-clock times across DST, shift associated dates, reject invalid local times/past dates and leave completed work/repeating occurrences fixed. Habit check-ins use the Habit timezone. Server-side domain validation remains authoritative.

Reject is persisted through `POST /api/v1/assistant/runs/{id}/reject`, bound to the reviewed hash. It invalidates Apply and survives history reload; it retains usage accounting and does not undo previously applied work. Conversation turns annotate whether a proposal was applied, rejected or still awaits confirmation, so a follow-up can reuse the actual existing structure.

The compatible-provider adapter preserves returned tool-call metadata, including Gemini thought signatures, when passing tool results into a subsequent model round. See [Google's documentation](https://docs.cloud.google.com/gemini-enterprise-agent-platform/models/thinking/thought-signatures). Tool-call boundaries do not rely on the provider returning a particular `finish_reason`.

## Verification boundary

The PostgreSQL suite exercises named-tool worker calls, no mutation before Apply, complete roadmap creation/order, replay, distinct proposal ref namespaces, atomic invalid groups, duplicate/structure guards, owned/locked reads, Task moves, stale versions, explicit acknowledgements, Habit check-ins, append/delete Notes and Calendar DST behavior. Browser checks exercise the readable roadmap card and actual Apply through ordinary cookie/CSRF APIs, as well as required checkboxes and persisted Reject. A delayed auxiliary response regression verifies that refreshing workspace data preserves a newly opened assistant and its unsent draft; the former stale snapshot could also close shared Task editors.

A synthetic live Gemini protocol check called `list_areas` then `create_roadmap` and completed a following model round with a four-Milestone/seven-Task proposal, without business writes. A second end-to-end check used a disposable account in the verified `planner_test` database: the actual configured provider and durable worker prepared a proposal; there were zero Goals before approval, and the ordinary hash-bound Apply returned HTTP 200 and created exactly one Goal, three Milestones and six Tasks. SMTP and unrelated indexing were disabled for that probe. Development/source data were not used or reset. These are protocol/tool-use and persistence evidence, not a guarantee of model quality for every request, external repository inspection or paid-production readiness. Current executed totals are in [status](status.md).
