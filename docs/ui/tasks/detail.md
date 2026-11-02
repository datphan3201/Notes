# /tasks/{id} — Task details

[Documentation home](../../README.md) · [All routes](../../reference/routes.md)

Route: `planning.task`. The shell carries `data-task-id`; the browser loads owned data through the API. `#edit` opens the edit dialog. Overview/Notes/Related content remains in-page.

[Archify: complete/reopen request](../../diagrams/task-transition/index.html) shows the ownership/version/acknowledgement path.

<!-- BEGIN GENERATED TRACE -->

### Overview and Edit dialog

**Trace ID:** `task.detail.edit`

Edits use a separate DraftBuffer. A save acknowledges only the submitted snapshot, retains newer typing and handles 409 through explicit saved/draft choices. Initial controls remain disabled until data loads.

| Layer | Entry point |
| --- | --- |
| UI / DOM | [task.php · data-task-edit-form](../../../frontend/src/views/planning/task.php#L126) |
| Browser logic | [planning-page.js · export function initTaskDetail](../../../frontend/src/js/planning/planning-page.js#L756)<br>[draft-buffer.js · export class DraftBuffer](../../../frontend/src/js/planning/draft-buffer.js#L1) |
| Controller / service / domain | [PlanningService.php · public function update(](../../../backend/src/Application/Planning/PlanningService.php#L163) |
| Persistence | [PdoPlanningRepository.php · public function find(](../../../backend/src/Infrastructure/Persistence/Pdo/Planning/PdoPlanningRepository.php#L63)<br>[PdoPlanningRepository.php · public function update(](../../../backend/src/Infrastructure/Persistence/Pdo/Planning/PdoPlanningRepository.php#L94) |
| Relevant tests (not a pass claim) | [goal-roadmap.test.js · late save acknowledgement](../../../frontend/tests/js/goal-roadmap.test.js#L6)<br>[goal-roadmap.test.js · refresh cannot erase](../../../frontend/tests/js/goal-roadmap.test.js#L20) |
| Coverage limit | The linked JavaScript cases exercise shared DraftBuffer semantics, not this page’s DOM/editor wiring. Verify the page flow separately in a browser. |
| HTTP | `GET /api/v1/tasks/{id}` (`api.tasks.show`) → [PlanningController::show](../../../backend/src/Http/Controller/PlanningController.php#L44)<br>`PATCH /api/v1/tasks/{id}` (`api.tasks.update`) → [PlanningController::update](../../../backend/src/Http/Controller/PlanningController.php#L54) |

### Complete and Reopen

**Trace ID:** `task.detail.transition`

Unchecked Checklist items require explicit acknowledgement. Completing a Task never checks items automatically. Reopening finite work beneath completed Goal ancestors asks to reopen those ancestors atomically. A locked Milestone does not block its Tasks.

| Layer | Entry point |
| --- | --- |
| UI / DOM | [task.php · data-task-transition](../../../frontend/src/views/planning/task.php#L14) |
| Browser logic | [transitions.js · export async function transitionEntity](../../../frontend/src/js/planning/transitions.js#L6) |
| Controller / service / domain | [PlanningService.php · public function transition(](../../../backend/src/Application/Planning/PlanningService.php#L345) |
| Persistence | [PdoPlanningRepository.php · public function find(](../../../backend/src/Infrastructure/Persistence/Pdo/Planning/PdoPlanningRepository.php#L63)<br>[PdoPlanningRepository.php · public function update(](../../../backend/src/Infrastructure/Persistence/Pdo/Planning/PdoPlanningRepository.php#L94) |
| Relevant tests (not a pass claim) | [PlanningCoreTest.php · public function test_checklist_state_is_independent_and_task_completion_requires_acknowledgement(](../../../backend/tests/Plain/Integration/PlanningCoreTest.php#L135)<br>[PlanningCoreTest.php · public function test_finite_reopen_requires_confirmation_and_reopens_ancestors_atomically(](../../../backend/tests/Plain/Integration/PlanningCoreTest.php#L291) |
| HTTP | `POST /api/v1/tasks/{id}/complete` (`api.tasks.complete`) → [PlanningController::transition](../../../backend/src/Http/Controller/PlanningController.php#L92)<br>`POST /api/v1/tasks/{id}/reopen` (`api.tasks.reopen`) → [PlanningController::transition](../../../backend/src/Http/Controller/PlanningController.php#L92) |

### Completion Checklist

**Trace ID:** `task.detail.checklist`

Checklist records are separate owned/versioned rows. Check/uncheck writes Activity; order is a complete-ID-set mutation. This is distinct from inline checkable text in a working note.

| Layer | Entry point |
| --- | --- |
| UI / DOM | [task.php · data-task-checklist aria-live](../../../frontend/src/views/planning/task.php#L91) |
| Browser logic | [planning-page.js · data-checklist-form](../../../frontend/src/js/planning/planning-page.js#L1103) |
| Controller / service / domain | [PlanningService.php · public function createChecklist(](../../../backend/src/Application/Planning/PlanningService.php#L541)<br>[PlanningService.php · public function updateChecklist(](../../../backend/src/Application/Planning/PlanningService.php#L561) |
| Persistence | [PdoPlanningRepository.php · public function insert(](../../../backend/src/Infrastructure/Persistence/Pdo/Planning/PdoPlanningRepository.php#L77)<br>[PdoPlanningRepository.php · public function update(](../../../backend/src/Infrastructure/Persistence/Pdo/Planning/PdoPlanningRepository.php#L94)<br>[PdoPlanningRepository.php · public function archive(](../../../backend/src/Infrastructure/Persistence/Pdo/Planning/PdoPlanningRepository.php#L116) |
| Relevant tests (not a pass claim) | [PlanningCoreTest.php · public function test_checklist_state_is_independent_and_task_completion_requires_acknowledgement(](../../../backend/tests/Plain/Integration/PlanningCoreTest.php#L135) |
| HTTP | `GET /api/v1/tasks/{id}/checklist` (`api.tasks.checklist.index`) → [PlanningController::checklist](../../../backend/src/Http/Controller/PlanningController.php#L151)<br>`POST /api/v1/tasks/{id}/checklist` (`api.tasks.checklist.store`) → [PlanningController::createChecklist](../../../backend/src/Http/Controller/PlanningController.php#L157)<br>`PATCH /api/v1/tasks/{id}/checklist/{item}` (`api.tasks.checklist.update`) → [PlanningController::updateChecklist](../../../backend/src/Http/Controller/PlanningController.php#L167)<br>`POST /api/v1/tasks/{id}/checklist/reorder` (`api.tasks.checklist.reorder`) → [PlanningController::reorder](../../../backend/src/Http/Controller/PlanningController.php#L230)<br>`DELETE /api/v1/tasks/{id}/checklist/{item}` (`api.tasks.checklist.archive`) → [PlanningController::archiveChecklist](../../../backend/src/Http/Controller/PlanningController.php#L178) |

### Working note, Check box and Resources

**Trace ID:** `task.detail.note`

The Task note uses explicit Save. Linking/creating the owned Note is handled by saveTaskNote; text persists through the Note API. Resource URLs are derived from plain note text. There is no promise of browser-crash recovery for this explicit-save editor.

| Layer | Entry point |
| --- | --- |
| UI / DOM | [task.php · data-task-note-form](../../../frontend/src/views/planning/task.php#L80) |
| Browser logic | [planning-page.js · const noteForm =](../../../frontend/src/js/planning/planning-page.js#L858)<br>[note-content-editor.js · export class NoteContentEditor](../../../frontend/src/js/notes/note-content-editor.js#L15)<br>[task-views.js · export function resourceLinks](../../../frontend/src/js/planning/task-views.js#L39) |
| Controller / service / domain | [PlanningService.php · public function saveTaskNote(](../../../backend/src/Application/Planning/PlanningService.php#L635)<br>[NoteService.php · public function update(](../../../backend/src/Application/Notes/NoteService.php#L111) |
| Persistence | [PdoNoteRepository.php · public function updateSnapshot(](../../../backend/src/Infrastructure/Persistence/Pdo/Notes/PdoNoteRepository.php#L151) |
| Relevant tests (not a pass claim) | [note-checkbox-text.test.js · projection preserves](../../../frontend/tests/js/note-checkbox-text.test.js#L14)<br>[note-checkbox-text.test.js · toggling duplicate titles](../../../frontend/tests/js/note-checkbox-text.test.js#L42)<br>[PlanningHttpTest.php · public function test_planning_habit_dashboard_review_and_disabled_ai_http_contracts(](../../../backend/tests/Plain/Http/PlanningHttpTest.php#L45) |
| HTTP | `GET /api/v1/tasks/{id}/note` (`api.tasks.note.show`) → [PlanningController::showTaskNote](../../../backend/src/Http/Controller/PlanningController.php#L199)<br>`POST /api/v1/tasks/{id}/note` (`api.tasks.note.store`) → [PlanningController::taskNote](../../../backend/src/Http/Controller/PlanningController.php#L189)<br>`PATCH /api/v1/notes/{note}` (`api.notes.update`) → [NoteController::update](../../../backend/src/Http/Controller/NoteController.php#L69) |

### Tags, week selection and Related work

**Trace ID:** `task.detail.related`

Tags and contributions classify or relate work without changing its primary location. Week selection controls This week; contributions do not affect progress.

| Layer | Entry point |
| --- | --- |
| UI / DOM | [task.php · data-task-related](../../../frontend/src/views/planning/task.php#L111) |
| Browser logic | [contributions-ui.js · export async function renderContributions](../../../frontend/src/js/planning/contributions-ui.js#L17)<br>[tag-picker.js · export function createTagPicker](../../../frontend/src/js/planning/tag-picker.js#L38) |
| Controller / service / domain | [PlanningService.php · public function addContribution(](../../../backend/src/Application/Planning/PlanningService.php#L494) |
| Persistence | [PdoPlanningRepository.php · public function addEdge(](../../../backend/src/Infrastructure/Persistence/Pdo/Planning/PdoPlanningRepository.php#L247)<br>[PdoPlanningRepository.php · public function removeEdge(](../../../backend/src/Infrastructure/Persistence/Pdo/Planning/PdoPlanningRepository.php#L256)<br>[PdoPlanningRepository.php · public function syncTags(](../../../backend/src/Infrastructure/Persistence/Pdo/Planning/PdoPlanningRepository.php#L356) |
| Relevant tests (not a pass claim) | [PlanningCoreTest.php · public function test_contributions_are_multi_target_and_separate_from_primary_hierarchy(](../../../backend/tests/Plain/Integration/PlanningCoreTest.php#L84) |
| HTTP | `GET /api/v1/tasks/{id}/contributions` (`api.tasks.contributions.index`) → [PlanningController::contributions](../../../backend/src/Http/Controller/PlanningController.php#L220)<br>`POST /api/v1/tasks/{id}/contributions` (`api.tasks.contributions.store`) → [PlanningController::addContribution](../../../backend/src/Http/Controller/PlanningController.php#L127)<br>`DELETE /api/v1/tasks/{id}/contributions/{target}` (`api.tasks.contributions.destroy`) → [PlanningController::removeContribution](../../../backend/src/Http/Controller/PlanningController.php#L138) |

<!-- END GENERATED TRACE -->


