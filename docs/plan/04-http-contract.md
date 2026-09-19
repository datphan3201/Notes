# HTTP and API Contract

## Common behavior

- Same-origin cookie sessions; API base `/api/v1`.
- State-changing requests require CSRF. JSON uses `X-CSRF-TOKEN`; forms use `_token`.
- JSON success: `{ "data": ... }`; collection pages add `meta`.
- JSON failure: `{ "code": "TOKEN", "message": "...", "errors": { ... } }`; conflict may add `current`.
- IDs serialize as strings; timestamps use UTC ISO 8601 with microseconds.
- Reject unknown request keys. Distinguish malformed JSON 400, auth 401, inaccessible 404, conflict 409, expired CSRF/session 419, validation 422, rate limit 429, and service failure 503.
- All mutable aggregate operations require `base_version`; exact replays return the current representation without incrementing version.

## Router behavior

Static routes define methods, path template, name, controller, auth, CSRF, and rate-limit bucket. Path parameters are single decoded segments. Reject malformed encodings, NUL, and encoded separators. Unknown path is 404; wrong method is 405 with `Allow`. HEAD reuses GET headers and suppresses body.

## Preserved endpoints

Preserve all current auth/settings, `/api/v1/session`, Notes, `/api/v1/labels`, attachments, avatar, and private-file URLs. Existing Note mutations retain complete-snapshot/replay/conflict/tombstone semantics. Existing label endpoints remain compatibility aliases over the Tag service.

## New resource endpoints

| Group | Routes |
| --- | --- |
| Areas | `GET/POST /areas`, `GET/PATCH/DELETE /areas/{id}`, `POST /areas/reorder` |
| Goals | `GET/POST /goals`, `GET/PATCH/DELETE /goals/{id}`, `GET /goals/{id}/children`, `POST /goals/{id}/move|complete|reopen` |
| Milestones | CRUD plus `POST /milestones/{id}/complete|reopen` |
| Dependencies | `GET/POST /milestones/{id}/prerequisites`, `DELETE /milestones/{id}/prerequisites/{id}` |
| Tasks | CRUD plus `POST /tasks/{id}/complete|reopen` and `POST /tasks/{id}/note` |
| Checklist | `GET/POST /tasks/{id}/checklist`, `PATCH/DELETE /tasks/{id}/checklist/{id}`, `POST /tasks/{id}/checklist/reorder` |
| Contributions | `GET/POST /{sourceType}/{id}/contributions`, `DELETE /{sourceType}/{id}/contributions/{goalId}` for Goal/Milestone/Task/Habit |
| Tags | CRUD `/tags`, `POST /tags/{id}/move`; entity PATCH accepts complete `tag_ids` snapshot |
| Habits | CRUD plus `GET /habits/{id}/history`, `PUT/DELETE /habits/{id}/check-ins/{date}` |
| Task series | `GET/POST /task-series`, `GET/PATCH /task-series/{id}`, `POST /task-series/{id}/pause|resume|end` |
| Reviews | `GET/POST /reviews`, `GET/PATCH /reviews/{id}`, `POST /reviews/{id}/refresh|finalize|reopen` |
| Dashboard | `GET /dashboard?month=YYYY-MM` |
| Weekly selection | GET/POST Task and Milestone selection collections; DELETE item; POST reorder |
| AI | `POST /ai/actions`, `GET /ai/actions/{id}`, `POST /ai/actions/{id}/apply|reject` |

HTML pages are `/`, `/dashboard`, `/goals`, `/goals/{id}`, `/tasks`, `/habits`, `/reviews`, `/ai`, auth, and settings. `/` remains Notes for compatibility.

## Mutation precedence

For an authenticated request:

1. Parse content type/body; reject malformed/unknown keys.
2. Validate scalar syntax.
3. Load source aggregate by owner; inaccessible is 404.
4. Lock owner and current aggregate.
5. If desired state equals current state, return no-op success even with stale base version where the endpoint contract allows replay.
6. Check base version.
7. Validate referenced owned endpoints and domain rules.
8. Write aggregate, relationships, and Activity atomically.

Never reveal whether a foreign ID exists. A foreign relationship endpoint returns the same field error/404 behavior as a missing one according to the route contract.

## Representative requests

Create Goal:

```json
{
  "area_id": "uuid",
  "parent_goal_id": null,
  "name": "Become a backend developer",
  "description": "",
  "expected_result": "Build and deploy a complete backend",
  "completion_criteria": "Can do so without tutorial assistance",
  "importance": 5,
  "deadline": null
}
```

Complete Milestone:

```json
{ "base_version": 4, "acknowledge_open_tasks": true }
```

Create Task series:

```json
{
  "name": "Weekly project review",
  "primary_goal_id": "uuid",
  "frequency": "weekly",
  "interval_count": 1,
  "weekdays": [1, 5],
  "start_date": "2026-09-18",
  "end_date": null,
  "timezone": "America/Mexico_City"
}
```

All field bounds, state transitions, and relationship rules are defined in documents 10–13 and must be converted into endpoint tests before controller implementation.
