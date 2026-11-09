# Open issues

[Documentation home](README.md) · [Changelog](../CHANGELOG.md)

Only unresolved current problems/acceptance decisions belong here. Fixed entries are removed and recorded in the changelog; Git history preserves reports. Legacy-only runtime issues ISSUE-035–044 are retired following removal of that runtime, not claimed fixed or accepted in the new system. Historical diagram whitespace remains separately scoped.

## Reporting rules

- Next unused ID: **ISSUE-079**. Never reuse an earlier ID.
- Include status, severity, affected source/UI, observed versus expected behavior, evidence type/limits and a concrete next step.
- Severity: High (data loss/security/core failure), Medium (wrong behavior or material unverified operational/scaling gap), Low (cosmetic/documentation/tooling friction).
- Status: Open, Needs decision or In progress. Listing an issue alone does not authorize runtime changes.

| ID | Issue | Severity | Status |
| --- | --- | --- | --- |
| [ISSUE-007](#issue-007--historical-archify-html-contains-trailing-whitespace) | Historical Archify HTML contains trailing whitespace | Low | Open |
| [ISSUE-045](#issue-045--personal-feature-parity-is-incomplete-in-the-new-runtime) | Personal feature parity is incomplete in the new runtime | High | In progress |
| [ISSUE-046](#issue-046--full-migration-reconciliation-and-managed-recovery-are-unverified) | Full migration reconciliation and managed recovery are unverified | High | Open |
| [ISSUE-047](#issue-047--ai-provider-quality-and-complete-cost-accounting-need-production-evidence) | AI provider quality and complete cost accounting need production evidence | High | Open |
| [ISSUE-048](#issue-048--single-instance-concurrency-latency-exceeds-the-provisional-budget) | Single-instance concurrency latency exceeds the provisional budget | Medium | Open |
| [ISSUE-063](#issue-063--assistant-context-selection-is-too-broad-and-source-lists-are-noisy) | Assistant context selection is too broad and source lists are noisy | Medium | Open |
| [ISSUE-064](#issue-064--orphaned-legacy-deployment-test-references-a-removed-script) | Orphaned legacy deployment test references a removed script | Low | Open |
| [ISSUE-065](#issue-065--cloud-copy-helper-lacks-complete-migration-and-recovery-guards) | Cloud COPY helper lacks complete migration and recovery guards | Medium | Open |
| [ISSUE-066](#issue-066--workspace-snapshot-loads-unbounded-account-data) | Workspace snapshot loads unbounded account data | Medium | Open |
| [ISSUE-067](#issue-067--dashboard-layout-requirement-disagrees-with-the-mounted-desktop-view) | Dashboard layout requirement disagrees with the mounted desktop view | Low | Needs decision |
| [ISSUE-068](#issue-068--dashboard-habit-strip-assumes-today-is-saturday) | Dashboard Habit strip assumes today is Saturday | Medium | Open |
| [ISSUE-069](#issue-069--hosted-ai-is-unconfigured-on-render) | Hosted AI is unconfigured on Render | Medium | Open |
| [ISSUE-070](#issue-070--hosted-mail-still-uses-the-resend-testing-sender) | Hosted mail still uses the Resend testing sender | Medium | Open |
| [ISSUE-076](#issue-076--dashboard-roadmap-marks-completed-milestones-by-count) | Dashboard roadmap marks completed milestones by count | Medium | Open |
| [ISSUE-077](#issue-077--task-reopen-prompts-do-not-cover-all-completed-ancestors) | Task reopen prompts do not cover all completed ancestors | Medium | Open |

## UI refinement queue

The former ISSUE-049–062 implementation gaps were closed by the connected UI work; full historical acceptance remains ISSUE-045. [Integration](migration/ui-integration.md) describes current scope.

## ISSUE-007 — Historical Archify HTML contains trailing whitespace

- **Status:** Open.
- **Severity:** Low.
- **Affected:** preserved HTML under [historical diagrams](diagrams/README.md).
- **Observed:** the prior source inspection recorded trailing whitespace in generated HTML. Those artifacts and receipts are historical, not current-runtime diagrams; this pass leaves their bytes/receipt hashes unchanged.
- **Expected / next step:** if those artifacts are regenerated, use their actual authoring workflow and refresh provenance/receipts together; do not hand-edit receipts to manufacture new validation.
- **Evidence and limits:** historical source-inspection report, not freshly regenerated or browser-validated. The current documentation checker does not validate artifact hashes.

## ISSUE-045 — Personal feature parity is incomplete in the new runtime

- **Status:** In progress.
- **Severity:** High.
- **Affected:** [live workspace](../apps/web/src/components/live-workspace.tsx), [domain](../apps/api/planner/workspace.py), [integration](migration/ui-integration.md), [manual acceptance](testing/manual-checklist.md).
- **Observed:** approved personal UI clusters are connected to scoped APIs, but representative historical datasets, all Calendar/Gantt interactions and complete localization/keyboard/responsive/visual acceptance are not established. Source presence and selected automated runs are not exhaustive equivalence. Teamwork is removed; realtime co-editing is intentionally excluded.
- **Expected / next step:** run the current human acceptance matrix against representative migrated data, record specifically reproduced differences and fix them through ordinary services/tests.
- **Evidence and limits:** source inspection and historical isolated execution reports in [status](migration/status.md). Recorded deployment/legacy removal does not close this acceptance gate.

## ISSUE-046 — Full migration reconciliation and managed recovery are unverified

- **Status:** Open.
- **Severity:** High.
- **Affected:** [legacy importer](../apps/api/planner/migrate_legacy.py), [cloud COPY helper](../tools/deploy/migrate_to_supabase.py), [cloud operations](operations/cloud.md).
- **Observed:** earlier local export/staging/development reports reconciled core records and preserved unsupported raw data. Repository records now report hosted deployment, superseding the former unprovisioned-cloud status. Complete hosted relation/settings/MFA/private-file reconciliation and managed DB+object restore evidence are still absent from maintained records; the guarded importer returns `cutover_ready: false`.
- **Expected / next step:** reconcile source/target counts, owners, edges, versions, dates and content/file checksums; test representative active attachments and legacy MFA recovery; rehearse consistent database/private-file restore into a separate environment with recorded recovery objectives. Review the separate raw-COPY limitations in ISSUE-065 before further transfer.
- **Evidence and limits:** historical local reports and current source/runbook inspection; no fresh hosted database, service configuration, contents or managed recovery inspection performed.

## ISSUE-047 — AI provider quality and complete cost accounting need production evidence

- **Status:** Open.
- **Severity:** High.
- **Affected:** [AI workflow](../apps/api/planner/ai.py), [provider](../apps/api/planner/provider.py), [worker](../apps/api/planner/jobs.py), [settings](../apps/api/planner/config.py).
- **Observed:** deterministic ownership/vector/tool/approval/usage tests and historical synthetic live checks exist. Maintained evidence does not establish calibrated provider/citation/adversarial quality, complete embedding usage/cost accounting, money-based hard caps or tracing across queue hops. Zero configured token prices mean unpriced usage, not free service.
- **Expected / next step:** version representative synthetic evaluations, configure/calibrate chat and embedding budgets/prices, inspect real stream/retry/citation behavior and retain staged quality/cost/trace evidence before paid AI release.
- **Evidence and limits:** source inspection and historical test reports, not a new live-provider evaluation.

## ISSUE-048 — Single-instance concurrency latency exceeds the provisional budget

- **Status:** Open.
- **Severity:** Medium.
- **Affected:** [authentication lifecycle](../apps/api/planner/auth.py), [pool](../apps/api/planner/db.py), [load tool](../tools/performance/planner_load.py).
- **Observed:** a historical local 1000-request/100-concurrency Task-list run reported 1000 HTTP 200 responses, 197.16 requests/s, p95 645.59 ms and p99 761.52 ms with one process, 5+2 pool and one synthetic Task. A separate 20-concurrency run reported p95 129.64 ms. The earlier pool-starvation defect was fixed; higher-concurrency workload acceptance was not.
- **Expected / next step:** agree a realistic fixture/workload budget, profile CPU/pool/queue waits, measure large datasets and concurrent worker/AI load, and compare controlled staging scaling/pool settings. Include snapshot behavior in ISSUE-066.
- **Evidence and limits:** historical local benchmark report, not rerun here and not production capacity evidence. The committed Render blueprint now configures 4+2 per process, not that benchmark's settings.

## ISSUE-063 — Assistant context selection is too broad and source lists are noisy

- **Status:** Open — recorded at the user's request; implementation deferred.
- **Severity and impact:** Medium — weakly relevant or unnecessarily detailed context increases provider input, cost and distraction; displaying every read record as a source chip can overwhelm the conversation as account data grows.
- **Affected:** assistant chat and proposal sources in [live-assistant.tsx](../apps/web/src/components/live-assistant.tsx), request/run orchestration and retrieval in [ai.py](../apps/api/planner/ai.py), read/search tools in [assistant_tools.py](../apps/api/planner/assistant_tools.py), and the [tool record](migration/assistant-tools.md). Related production evaluation work remains under [ISSUE-047](#issue-047--ai-provider-quality-and-complete-cost-accounting-need-production-evidence).
- **Observed:** initial chat retrieval selects up to six chunks using lexical/vector ranking without a semantic relevance cutoff. Search/list tools return up to 12 serialized records, including content, and register each as a read source. Chat does not pass a structured current Goal/Task/Note scope; the UI renders every recorded source as a chip without distinguishing search candidates from sources used in the answer. The user reported that these labels are confusing and asked to record selective, on-demand context retrieval before implementation.
- **Planned scope:**
  1. Pass explicit current/discussed entity context with the request; validate ownership and resolve ambiguous conversational references before using that scope.
  2. Support structured search filters for Goal, entity type, status and dates. Search the relevant scope first and expand only when needed.
  3. Return compact candidate metadata (ID, type, title and short snippet); fetch full details only for selected records through existing read tools.
  4. Calibrate relevance filtering, allow empty results, and enforce context/read budgets. Ask the user to distinguish genuinely ambiguous matches rather than selecting an arbitrary record.
  5. Distinguish search candidates, records actually read and explicit answer citations. Collapse the source list behind a localized “Referenced N items” control, while retaining direct citations where useful.
  6. Add isolated retrieval/tool/API and desktop/mobile checks covering large datasets, Vietnamese/English queries, duplicate titles, no matches, topic/scope changes and stale records.
- **Acceptance criteria:** a request to create a new backend-learning roadmap reads only the Area choices and possible duplicate roadmaps needed for that action; unrelated Notes/Tasks are not fetched in full. A request to reschedule work in an identified Goal stays within that Goal unless expansion is justified. Weak matches may produce zero results, ambiguous targets prompt clarification, and the source display remains compact. Ownership, locked-Note exclusion, source-version checks and exact confirmed atomic Apply remain authoritative; changing visible citations must not remove required proposal validation.
- **Evidence type and limits:** user screenshot/discussion and source inspection; no large-account load benchmark or calibrated relevance evaluation has been performed for this issue. Existing retrieval bounds do not establish that each selected record is necessary.
- **Next step:** when implementation is requested, define representative relevance/scope fixtures and read budgets, then implement the six items using the existing PostgreSQL/pgvector and tool infrastructure. This entry authorizes documentation only, not a runtime change.

## ISSUE-064 — Orphaned legacy deployment test references a removed script

- **Status:** Open.
- **Severity:** Low.
- **Affected:** [existing-runtime.test.mjs](../tools/deploy/tests/existing-runtime.test.mjs).
- **Observed:** its fixture copies `tools/deploy/existing-runtime.sh`, which was removed with the PHP runtime. The eight cases fail before assertions with ENOENT. The active CI executes the Python deployment-helper suite and does not invoke this orphaned Node suite.
- **Expected / next step:** remove the obsolete suite as a deliberate legacy-test cleanup after confirming its coverage belongs to the retired deployment workflow. Runtime/test removal is outside this documentation synchronization.
- **Evidence and limits:** reproduced by `node tools/deploy/tests/existing-runtime.test.mjs` during repository inspection; no server/cloud/database involved. The stale-documentation portion originally reported under this ID is now corrected and recorded in the changelog.

## ISSUE-065 — Cloud COPY helper lacks complete migration and recovery guards

- **Status:** Open.
- **Severity:** Medium.
- **Affected:** [migrate_to_supabase.py](../tools/deploy/migrate_to_supabase.py), [cloud operations](operations/cloud.md), [migration acceptance](migration/personal-ai-planner.md#data-migration-and-cutover).
- **Observed:** the helper uses a fixed table order and `SELECT *` binary COPY in one destination transaction. It reads the destination revision but does not compare source/destination schema revisions or columns, verify configured/actual database identity with an allowlist, or reject a nonempty target before copying. Counts are compared only for nonempty copied source tables; it does not enumerate all current tables, reconcile owner/graph/content/file checksums, move private object bytes or implement repeatable incremental merge. In the current model/schema, Tasks may reference TaskSeries copied later, so a valid source containing occurrences can fail immediate FK checks before the series table is copied.
- **Expected:** an explicitly reviewed transfer with checked target/source/schema, dependency-safe ordering, empty-target or validated merge semantics, full inventory/content/file reconciliation, backups and isolated restore rehearsal. A successful count-only transaction is insufficient acceptance.
- **Next step:** define supported transfer semantics and add isolated fixtures for nonempty/mismatched targets, parent/series relations, reruns, missing tables and private-file restoration before further real transfer. Keep the current helper out of ordinary synchronization guidance until addressed.
- **Evidence and limits:** source-inspected only; the helper was not executed and no development/hosted data was read or changed. Documentation now describes actual limitations. Broader acceptance stays in ISSUE-046.

## ISSUE-066 — Workspace snapshot loads unbounded account data

- **Status:** Open.
- **Severity:** Medium.
- **Affected:** [workspace snapshot](../apps/api/planner/workspace.py), [live refresh](../apps/web/src/components/live-workspace.tsx).
- **Observed:** `/api/v1/workspace/snapshot` loads every owned model row, including archived rows, plus all account selections, Habit days, dependencies and Activity. Ordinary live refresh calls this snapshot. Per-resource list pagination does not bound this endpoint or browser transformation/rendering work.
- **Expected / next step:** define measured large-account payload/latency/memory budgets; use representative history/Notes/Habits fixtures, then select pagination/lazy loading or incremental projections while preserving offline/version/graph/permission semantics. Reuse capacity acceptance in ISSUE-048.
- **Evidence and limits:** source-inspected; no large-account benchmark or production failure was reproduced. Ownership checks remain present; this reports growth/scalability exposure, not a demonstrated cross-account leak.

## ISSUE-067 — Dashboard layout requirement disagrees with the mounted desktop view

- **Status:** Needs decision.
- **Severity:** Low — ambiguous layout acceptance, without a demonstrated data/authorization defect.
- **Affected:** [decisions](architecture/decisions.md#interface-and-security), [mounted Dashboard](../apps/web/src/components/preview/dashboard.tsx), [dashboard styles](../apps/web/src/styles/dashboard-preview.css), [parity styles](../apps/web/src/styles/parity.css), [historical UI review](migration/dashboard-ui.md).
- **Observed:** the retained product decision requires insight cards above a full-width checklist in Today/This week. The actual `LiveWorkspace` → `WorkspaceView` → `PreviewDashboard` route uses `dashboard-split-main`/`dashboard-split-side` and a desktop two-column CSS grid. Historical preview review explicitly chose that baseline split while leaving final acceptance to the user; no explicit resolution of this conflicting layout contract is recorded.
- **Expected / next step:** confirm whether the split is accepted and amend the owning decision, or change the mounted view to the recorded stacked requirement and verify desktop/mobile/keyboard behavior. Keep observed and intended layouts separate until then; do not modify the unmounted alternate `dashboard-page.tsx` by mistake.
- **Evidence and limits:** source/decision/history inspection; no new browser visual review or user acceptance is claimed. The feature map now reports the discrepancy explicitly.

## ISSUE-068 — Dashboard Habit strip assumes today is Saturday

- **Status:** Open.
- **Severity:** Medium — weekday/date labels and past/today/future states can misrepresent the stored Habit history.
- **Affected:** [mounted Dashboard](../apps/web/src/components/preview/dashboard.tsx), its `sampleHabits.history` mapping and the day-strip `weekdays.map` rendering; the [daily check-in handler](../apps/web/src/components/live-workspace.tsx) uses the Habit-local current day separately.
- **Observed:** on the live demo Dashboard dated Sunday 2026-11-08, the strip labeled Monday as 3 November, Saturday as 8 November and Sunday as upcoming 9 November. The actual Monday-based week is 2–8 November. Source fixes history to five days before today (`i - 5`), treats index 5 as today and index 6 as upcoming, regardless of the current weekday. It also retains the “Sample check-ins this week” accessible label on the live surface.
- **Expected / next step:** derive the seven dates and their before/today/after states from the applicable Habit-local Monday and current day; read done/rest history for those exact dates. Add Sunday/Monday/midweek and account/Habit timezone fixtures plus desktop/mobile tooltip/accessibility checks. Keep this separate from the autosave queue fix.
- **Evidence and limits:** actual authenticated cloud browser snapshot plus source inspection during deployment verification on 2026-11-08. No underlying check-in write/date corruption was reproduced, and no correction to the day-strip implementation was made in this task.

## ISSUE-069 — Hosted AI is unconfigured on Render

- **Status:** Open.
- **Severity:** Medium — hosted assistant requests are unavailable before they can be queued.
- **Affected:** active Render backend `planner-api-sg`, [start_run](../apps/api/planner/ai.py), [provider](../apps/api/planner/provider.py), [cloud configuration](operations/cloud.md).
- **Observed:** read-only Render API inspection on 2026-11-08 returned HTTP 200 but no nonempty `PLANNER_AI_API_KEY`, `PLANNER_AI_MODEL`, `PLANNER_AI_BASE_URL` or `PLANNER_EMBEDDING_MODEL` on the active Singapore service. The other Render service also lacks these fields. Private local configuration has all four (values were not printed). Backend readiness and authenticated assistant-history reads returned 200; the demo history was empty. Worker settings are `poll` / `true`, which is configuration evidence, not a process-health guarantee.
- **Cause / expected:** `start_run` immediately returns 503 with “The assistant is currently unavailable. Try again later.” when the API key or chat model is absent, before budget reservation or job enqueue. Configure the intended provider base URL, private key and chat model on the actual hosted backend/worker, plus a compatible embedding model if semantic retrieval is intended.
- **Next step:** when configuration changes are requested, apply the private server settings, restart/redeploy the affected backend and verify a synthetic provider request through the actual worker/frontend. Keep quality/cost acceptance separate under ISSUE-047.
- **Evidence and limits:** user report, current source inspection and read-only configuration/readiness/history checks. No new chat/provider request, configuration change or deployment was performed for this diagnosis, and no prompts/answers/credential values were printed.

## ISSUE-070 — Hosted mail still uses the Resend testing sender

- **Status:** Open.
- **Severity:** Medium — ordinary recipient verification/recovery/MFA delivery is not established with the configured test sender.
- **Affected:** Render `planner-api-sg`, [mail adapter](../apps/api/planner/accounts.py), [blueprint](../render.yaml), [cloud runbook](operations/cloud.md).
- **Observed:** read-only Render environment inspection on 2026-11-08 confirms a nonempty `PLANNER_RESEND_API_KEY` and `PLANNER_SMTP_FROM=Planner <onboarding@resend.dev>`; SMTP host/user/password are absent. The adapter prioritizes Resend HTTPS whenever that key exists. Resend documents its resend.dev sender as testing-only, restricted to the Resend account email; arbitrary recipient delivery requires a verified owned domain and a matching From address.
- **Expected / next step:** configure a verified sender/domain and update the backend From value, then verify authorized real-recipient delivery for verification/recovery/MFA. Keep HTTPS delivery for the recorded Render Free topology, whose standard SMTP ports are blocked. A present API key alone does not establish validity or delivery.
- **Evidence and limits:** current configuration/source inspection and official [Resend sender restriction](https://resend.com/docs/knowledge-base/403-error-resend-dev-domain) / [Render Free network limits](https://render.com/docs/free). No email was sent, key validity was not tested, no provider domain state was inspected, and no delivery failure to a particular recipient was reproduced.

## ISSUE-076 — Dashboard roadmap marks completed milestones by count

- **Status / severity:** Open / Medium.
- **Affected:** [Dashboard roadmap](../apps/web/src/components/preview/dashboard.tsx).
- **Observed:** the preview calculates an aggregate completed count, then marks the first N milestone buttons as done using `index < focus.completed`, rather than checking the corresponding milestone's status. Out-of-order completion can therefore mark a different named milestone as complete; the total count can still be correct.
- **Expected / next step:** derive each displayed dot/segment's completion from its corresponding milestone and verify an out-of-order completion fixture. Keep this status correction separate from the responsive-width change.
- **Evidence and limits:** source-inspected during responsive layout work; the incorrect status case was not executed and no development/cloud records were changed.

## ISSUE-077 — Task reopen prompts do not cover all completed ancestors

- **Status / severity:** Open / Medium.
- **Affected:** [Task collection](../apps/web/src/components/preview/tasks.tsx), [shared Task interactions](../apps/web/src/components/preview/task-interaction.tsx), [domain transitions](../apps/api/planner/planning.py).
- **Observed:** frontend reopen acknowledgement detection checks the directly associated Goal against completed Goals. The server checks a completed Milestone and the full ancestor Goal chain, requiring `reopen_parents` and rejecting a completed dependent Milestone. A done Task under a completed Milestone or higher ancestor can therefore reach a server rejection without the UI offering the required acknowledgement. The frontend's synthetic parent updates also reset a detected Goal to NotStarted whereas the server reopens completed ancestors as doing.
- **Expected / next step:** share a complete ancestor/dependency projection for Task reopen prompts, describe all affected parents and match acknowledged server states. Cover a completed Milestone with an active Goal, a completed higher Goal, and a completed dependent Milestone.
- **Evidence and limits:** source inspection on 2026-11-09; these transition cases were not executed against development or production, and no Task records were changed.

## New issue template

```text
ISSUE-NNN — Concrete title
Status / severity:
Affected source / UI:
Observed versus expected:
Evidence type and limits:
Next step:
```
