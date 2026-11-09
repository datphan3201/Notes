# Current decisions and product boundaries

[Documentation home](../README.md) · [Open issues](../issues.md)

## Runtime and deployment

Active source is **Next.js/React/TypeScript + FastAPI/Python + PostgreSQL/pgvector under `apps/` on `main`**. The modular monolith has separate API/worker processes sharing one database. PHP/vanilla JS sources and obsolete tooling were removed in `8714dc0`; historical Git contents/private exports are not a current runnable rollback runtime. Framework/ORM/architecture lock-in restrictions are lifted, subject to the user's task and domain/security invariants.

Repository records report deployment on 2026-11-08 to Vercel web, Render Singapore API/worker and Supabase database/private Storage. [Cloud operations](../operations/cloud.md) owns the recorded resources/runbooks; no fresh hosted checks are implied. `render.yaml` selects `main`, Free colocated polling worker and manual deploy trigger. Sleep pauses background work. Funnel remains a local development fallback; the former paused preparation handoff is historical, not an active stop instruction.

## Product model

| Concept | Maintained boundary |
| --- | --- |
| Area / Goal | Configurable Areas, arbitrary-depth single-parent Goal hierarchy; one Area or parent Goal |
| Icons / importance | Supported server-validated icon/accent choices on Areas, Goals, Milestones and Habits; importance 1–5, including Areas; Tasks have no icon |
| Milestone | Goal checkpoint; separate acyclic prerequisite relation, including other owned Goals' Milestones |
| Task | At most one primary Goal/Milestone, otherwise Inbox; dates/schedule, plain-text criteria, estimate, independent completion checklist and ordinary linked Notes |
| Main goal | Explicit account focus shared by Dashboard roadmap and Goals; unset/archived focus invites selection, no automatic highest-importance fallback |
| Calendar | Monday-first month/week and reviewed Gantt projections over Tasks/Milestones/Goals; ordinary versioned writes, no separate event store/external sync; Habits excluded |
| Daily/weekly plans | Explicit account-local selection, Today also selects current Monday week; never rewrites dates/status or automatically carries to next day |
| Progress / related work | Finite primary children only; exclude Habits, related contributions and recurring occurrences; avoid double-counting Tasks through Milestones |
| Recurrence | Personal daily/weekly/monthly/yearly TaskSeries, worker materialization; Ended terminal |
| Habit | Dedicated local-day check-ins/rest/streaks; timezone/period freeze after history; no Goal percentage contribution |
| Notes | Rich JSON document with server-derived searchable plain text, prioritized heading/checkbox/text previews, explicit Save/local drafts/conflict recovery, tags, private attachments and optional owned Goal/Task link; session-bound password unlock; registered-account view/edit sharing |
| Shared editing | Versioned title/content writes and conflict recovery; no V1 realtime OT/WebSocket/presence |
| Offline | Personal unshared/unlocked Notes only; account-scoped IndexedDB drafts/outbox, conflict copies and unchanged-version deletion; generic Notes shell/static cache, no offline feature promise for other pages/private media |
| Reviews / Activity | Persisted period snapshot/reflection versus real append-only transition/reversal facts; no fabricated scoring |
| Accounts | User/admin roles, locking, email verification/change/recovery, optional email/TOTP MFA; registration open/invitation/closed; admin roles only through audited server console |
| Moderation | Authorized reports/snapshots/private evidence; explicit resolution action or dismissal; protection for admin accounts and append-only audit entries |
| AI | Owned read tools plus one supported Goal/Milestone/Task/Habit/Note proposal; exact hash, versions, permissions and explicit acknowledgements checked on confirmed atomic Apply; no autonomous mutation |

## Interface and security

The recorded Dashboard requirement places insight cards above one full-width checklist in Today/This week. Current mounted desktop source uses a split layout; ISSUE-067 requires an explicit acceptance decision or implementation change. Preserve this distinction rather than silently rewriting the requirement to match source.

Preserve the illustrated five-theme system, independent light/dark, supported scenery/quote/background controls, English/Vietnamese, semantic controls, readable focus and mobile layouts. Shared floating Task/Goal/Milestone editors preserve originating context; full detail/roadmap surfaces remain for sustained work. Task Notes and standalone Notes use one Note resource/editor and explicit Save; Review reflections remain explicit Save. Note local draft recovery remains separate from server writes.

Owned reads/writes scope `user_id`; sharing/evidence require explicit permission and inaccessible identifiers return 404. Validate graphs and writes atomically, use UTC instants separately from user-facing DATE, keep server validation authoritative and private files authorized. AI/provider calls must not hold business write transactions.

## Excluded and remaining acceptance

Teamwork is permanently removed. No generic custom-field/database builder, Task dependency graph, native mobile app, general offline editing, timers/time tracking, gamification or autonomous AI writes. Realtime collaborative editing remains excluded.

Deployment does not close historical-data/visual acceptance, migration/MFA/file recovery, managed restore, paid AI quality/cost or sustained large-account capacity. These remain ISSUE-045–048; context relevance/source presentation remains ISSUE-063. Record specifically reproduced discrepancies rather than changing tests/prose to claim parity.
