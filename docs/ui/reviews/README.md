# /reviews — Collection and Review editor

[Documentation home](../../README.md) · [All routes](../../reference/routes.md)

Daily/Weekly/Monthly Reviews open an in-page editor; `/reviews/{id}` is not an HTML route. Snapshot facts and reflection fields have separate meanings. Demo fixtures also require the complete schema-one snapshot, including period/timezone, capture time and fact collections. [ISSUE-021](../../issues.md#issue-021--demo-review-snapshots-do-not-match-the-runtime-schema) records the bounded demo-data repair; normal Finalized snapshot behavior remains unchanged.

<!-- BEGIN GENERATED TRACE -->

### New review, type filter and pagination

**Trace ID:** `reviews.collection`

Identity is owner/kind/period start, with timezone captured on creation. Period navigation does not redefine an existing Review when account timezone later changes. Demo seeding uses the same schema-one snapshot envelope and repository facts consumed by ReviewService/UI; ad hoc summary-only JSON is not a valid Review snapshot.

| Layer | Entry point |
| --- | --- |
| UI / DOM | [reviews.php · data-review-filter](../../../frontend/src/views/planning/reviews.php#L15) |
| Browser logic | [reviews-page.js · export function initReviewsPage](../../../frontend/src/js/planning/reviews-page.js#L19) |
| Controller / service / domain | [ReviewService.php · public function create(](../../../backend/src/Application/Reviews/ReviewService.php#L40)<br>[seed_roadmap_demo.php · function roadmapDemoReviewSnapshot(](../../../backend/bin/seed_roadmap_demo.php#L15) |
| Persistence | [PdoReviewRepository.php · public function list(](../../../backend/src/Infrastructure/Persistence/Pdo/Reviews/PdoReviewRepository.php#L16)<br>[PdoReviewRepository.php · public function insert(](../../../backend/src/Infrastructure/Persistence/Pdo/Reviews/PdoReviewRepository.php#L33)<br>[PdoReviewRepository.php · public function find(](../../../backend/src/Infrastructure/Persistence/Pdo/Reviews/PdoReviewRepository.php#L24) |
| Relevant tests (not a pass claim) | [PlanningHttpTest.php · public function test_planning_habit_dashboard_review_and_disabled_ai_http_contracts(](../../../backend/tests/Plain/Http/PlanningHttpTest.php#L45)<br>[DashboardReviewsTest.php · public function test_demo_seed_reviews_use_the_runtime_snapshot_contract(](../../../backend/tests/Plain/Integration/DashboardReviewsTest.php#L73) |
| HTTP | `GET /api/v1/reviews` (`api.reviews.index`) → [ReviewController::index](../../../backend/src/Http/Controller/ReviewController.php#L17)<br>`POST /api/v1/reviews` (`api.reviews.store`) → [ReviewController::store](../../../backend/src/Http/Controller/ReviewController.php#L21)<br>`GET /api/v1/reviews/{id}` (`api.reviews.show`) → [ReviewController::show](../../../backend/src/Http/Controller/ReviewController.php#L25) |

### Reflections, Save and conflict choices

**Trace ID:** `reviews.editor`

Reflection edits are explicit-save and versioned; newer typing stays dirty after an older save. Finalized Reviews must be reopened before editing. There is no Notes autosave state machine here.

| Layer | Entry point |
| --- | --- |
| UI / DOM | [reviews.php · data-review-editor](../../../frontend/src/views/planning/reviews.php#L26) |
| CSS | [workspace.css · Editor heading layout](../../../frontend/src/css/workspace.css#L103) |
| Browser logic | [reviews-page.js · data-review-editor](../../../frontend/src/js/planning/reviews-page.js#L29)<br>[draft-buffer.js · export class DraftBuffer](../../../frontend/src/js/planning/draft-buffer.js#L1) |
| Controller / service / domain | [ReviewService.php · public function update(](../../../backend/src/Application/Reviews/ReviewService.php#L67) |
| Persistence | [PdoReviewRepository.php · public function update(](../../../backend/src/Infrastructure/Persistence/Pdo/Reviews/PdoReviewRepository.php#L48) |
| Relevant tests (not a pass claim) | [goal-roadmap.test.js · late save acknowledgement](../../../frontend/tests/js/goal-roadmap.test.js#L6)<br>[goal-roadmap.test.js · refresh cannot erase](../../../frontend/tests/js/goal-roadmap.test.js#L20) |
| Coverage limit | The linked JavaScript cases exercise shared DraftBuffer semantics, not this page’s DOM/editor wiring. Verify the page flow separately in a browser. |
| HTTP | `PATCH /api/v1/reviews/{id}` (`api.reviews.update`) → [ReviewController::update](../../../backend/src/Http/Controller/ReviewController.php#L29) |

### Refresh facts, Finalize, Reopen and Delete

**Trace ID:** `reviews.facts`

Refresh rebuilds Draft facts while preserving reflections. Finalize freezes the snapshot; Reopen does not refresh it automatically. Missing historical Goal snapshots remain unavailable. Delete is permanent and versioned.

| Layer | Entry point |
| --- | --- |
| UI / DOM | [reviews.php · data-review-refresh](../../../frontend/src/views/planning/reviews.php#L31) |
| Browser logic | [reviews-page.js · for (const action of &#91;'refresh', 'finalize', 'reopen'&#93;)](../../../frontend/src/js/planning/reviews-page.js#L286) |
| Controller / service / domain | [ReviewService.php · public function transition(](../../../backend/src/Application/Reviews/ReviewService.php#L77)<br>[GoalSnapshotService.php · public function capture(](../../../backend/src/Application/Reviews/GoalSnapshotService.php#L30) |
| Persistence | [PdoReviewRepository.php · public function facts(](../../../backend/src/Infrastructure/Persistence/Pdo/Reviews/PdoReviewRepository.php#L59)<br>[PdoReviewRepository.php · public function update(](../../../backend/src/Infrastructure/Persistence/Pdo/Reviews/PdoReviewRepository.php#L48)<br>[PdoReviewRepository.php · public function delete(](../../../backend/src/Infrastructure/Persistence/Pdo/Reviews/PdoReviewRepository.php#L41) |
| Relevant tests (not a pass claim) | [DashboardReviewsTest.php · public function test_finalized_review_snapshot_is_stable_until_reopened_and_refreshed(](../../../backend/tests/Plain/Integration/DashboardReviewsTest.php#L107)<br>[DashboardReviewsTest.php · public function test_goal_snapshot_capture_is_idempotent(](../../../backend/tests/Plain/Integration/DashboardReviewsTest.php#L126) |
| HTTP | `POST /api/v1/reviews/{id}/{action}` (`api.reviews.transition`) → [ReviewController::transition](../../../backend/src/Http/Controller/ReviewController.php#L33)<br>`DELETE /api/v1/reviews/{id}` (`api.reviews.destroy`) → [ReviewController::destroy](../../../backend/src/Http/Controller/ReviewController.php#L37) |

<!-- END GENERATED TRACE -->


