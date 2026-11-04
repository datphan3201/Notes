# Shared — Layout, CSS, navigation and Help

[Documentation home](../../README.md) · [All routes](../../reference/routes.md)

Every authenticated route uses the application layout. The guest layout is separate. `app.js` reads safe bootstrap JSON, starts shared modules, and dispatches page initializers by data attributes.

The application layout also shows a banner for unverified accounts (**Resend email**, gone once the activation link is used) and an **Offline** pill in the top bar while the browser has no connection. Both layouts link the web app manifest and icons; [pwa.js](../../../frontend/src/js/lib/pwa.js) registers the service worker in production builds and clears offline caches on logout ([offline use](../notes/offline.md)). The Notes workspace is loaded as a separate chunk only on `/`.

[Archify: system architecture](../../diagrams/system/index.html) shows the runtime boundaries.

<!-- BEGIN GENERATED TRACE -->

### Sidebar, topbar, mobile navigation and page bootstrap

**Trace ID:** `shell.layout`

AccountController renders page shell/bootstrap; page modules load their own data. Keep root-relative navigation, owned session state and existing data hooks stable.

| Layer | Entry point |
| --- | --- |
| UI / DOM | [app.php · data-app-body](../../../frontend/src/views/layouts/app.php#L102)<br>[guest.php · $view-&gt;assets()](../../../frontend/src/views/layouts/guest.php#L12)<br>[icons.php · &lt;svg](../../../frontend/src/views/layouts/icons.php#L2) |
| Browser logic | [app.js · DOMContentLoaded](../../../frontend/src/js/app.js#L90)<br>[navigation.js · export function initNavigation](../../../frontend/src/js/lib/navigation.js#L3) |
| Controller / service / domain | [AccountController.php · private function renderApplicationPage(](../../../backend/src/Http/Controller/AccountController.php#L232) |
| Relevant tests (not a pass claim) | [AccountHttpTest.php · public function test_php_templates_preserve_dom_contract_and_escape_bootstrap_data(](../../../backend/tests/Plain/Http/AccountHttpTest.php#L143) |
| HTTP | `GET /api/v1/session` (`api.session`) → [AccountController::session](../../../backend/src/Http/Controller/AccountController.php#L104) |

### Typography, themes and component CSS

**Trace ID:** `shell.styles`

CSS entry imports tokens/base/layout/components/feature styles. Change shared tokens for cross-app values; edit feature sheets for scoped presentation. Vite serves source in local mode and hashed /build assets for production.

| Layer | Entry point |
| --- | --- |
| UI / DOM | [app.php · $view-&gt;assets](../../../frontend/src/views/layouts/app.php#L36) |
| Browser logic | [app.js · import '@fontsource/be-vietnam-pro/400.css'](../../../frontend/src/js/app.js#L8) |
| Controller / service / domain | [AssetManifest.php · public function tags(](../../../backend/src/Http/View/AssetManifest.php#L19)<br>[AssetManifest.php · private function developmentTags(](../../../backend/src/Http/View/AssetManifest.php#L29)<br>[AssetManifest.php · private function productionTags(](../../../backend/src/Http/View/AssetManifest.php#L55)<br>[ContentSecurityPolicy.php · public function value(](../../../backend/src/Http/Security/ContentSecurityPolicy.php#L16) |
| Relevant tests (not a pass claim) | [ViewTest.php · public function test_manifest_emits_each_asset_once_and_rejects_unsafe_paths(](../../../backend/tests/Plain/Unit/ViewTest.php#L44)<br>[ViewTest.php · public function test_manifest_rejects_missing_invalid_and_nonlocal_development_configuration(](../../../backend/tests/Plain/Unit/ViewTest.php#L60) |
| Coverage limit | Manifest/CSP checks do not certify visual rendering or typography; inspect browser loading and appearance separately. |

### Dialogs, sections, Escape, backdrop and leave guards

**Trace ID:** `shell.dialogs`

workspace-ui and dialog-backdrop manage common interactions. Dirty/save/conflict flows are owned by each editor; preserve focus and drafts when moving components.

| Layer | Entry point |
| --- | --- |
| UI / DOM | [app.php · data-leave-guard-form&gt;](../../../frontend/src/views/layouts/app.php#L93) |
| Browser logic | [workspace-ui.js · export function initWorkspaceUI](../../../frontend/src/js/lib/workspace-ui.js#L134)<br>[dialog-backdrop.js · export function initDialogBackdropClose](../../../frontend/src/js/lib/dialog-backdrop.js#L18) |
| Relevant tests (not a pass claim) | [workspace-ui.test.js · creation drafts](../../../frontend/tests/js/workspace-ui.test.js#L15)<br>[workspace-ui.test.js · creation serializes](../../../frontend/tests/js/workspace-ui.test.js#L27)<br>[dialog-backdrop.test.js · only clicks beyond](../../../frontend/tests/js/dialog-backdrop.test.js#L5) |

### Help walkthrough and first-visit dismissal

**Trace ID:** `shell.help`

Help opens the illustrated walkthrough beside Appearance. Topics/steps live in walkthrough-content; other dialogs/recovery take priority. Skip/Close/Escape/Finish persist account-wide dismissal once.

| Layer | Entry point |
| --- | --- |
| UI / DOM | [walkthrough.php · data-walkthrough aria-labelledby](../../../frontend/src/views/layouts/walkthrough.php#L1) |
| Browser logic | [walkthrough.js · export function initWalkthrough](../../../frontend/src/js/help/walkthrough.js#L7)<br>[walkthrough-content.js · export](../../../frontend/src/js/help/walkthrough-content.js#L3) |
| Controller / service / domain | [AccountService.php · public function dismissWalkthrough(](../../../backend/src/Application/Account/AccountService.php#L66) |
| Persistence | [PdoAccountRepository.php · public function walkthroughDismissed(](../../../backend/src/Infrastructure/Persistence/Pdo/Account/PdoAccountRepository.php#L93)<br>[PdoAccountRepository.php · public function dismissWalkthrough(](../../../backend/src/Infrastructure/Persistence/Pdo/Account/PdoAccountRepository.php#L108) |
| Relevant tests (not a pass claim) | [AccountHttpTest.php · public function test_walkthrough_dismissal_is_owned_idempotent_and_survives_a_new_login(](../../../backend/tests/Plain/Http/AccountHttpTest.php#L177)<br>[AccountHttpTest.php · public function test_walkthrough_shell_is_shared_and_bootstrap_tracks_dismissal(](../../../backend/tests/Plain/Http/AccountHttpTest.php#L216) |
| HTTP | `POST /api/v1/walkthrough/dismiss` (`api.walkthrough.dismiss`) → [AccountController::dismissWalkthrough](../../../backend/src/Http/Controller/AccountController.php#L147) |

### Floating editor for Tasks, Goals and Milestones

**Trace ID:** `shell.quick-editor`

One side sheet (full screen below 600px) edits or creates a Task, Goal or Milestone on the current page. Calendar items, Tasks rows and their Edit item, Dashboard task rows and the roadmap's Milestone task list open it on a plain click; a modified click (Ctrl, Cmd, Shift, middle button) keeps the full page, and Open full page leads there for working notes, Related work and history. Task: name, Add to (Inbox, Goal or open Milestone), status, importance stars, start/due dates, scheduled start/end, reminder, estimate, description, criteria and the completion checklist (tick or add). Goal and Milestone: icon, name, importance, deadline, description and criteria; a new Goal picks its Area and a new Milestone its Goal, while moving them stays on the roadmap. Save sends only the changed fields with base_version; Complete/Reopen use the ordinary transitions and their confirmations. A version conflict keeps the draft and offers Use saved version or Keep my draft, which lays only the fields edited here over the latest version. Closing with unsaved changes asks first; Escape inside the icon picker closes only the picker. Every save dispatches planner:changed, which refreshes the Calendar, Tasks, Goals, Dashboard and roadmap in place. Goals and roadmap creation also use this sheet; sub-Goals retain parent_goal_id rather than selecting an Area, and roadmap Milestone/Task creations preserve their append-position presets.

| Layer | Entry point |
| --- | --- |
| UI / DOM | [quick-editor.js · class QuickEditor {](../../../frontend/src/js/planning/quick-editor.js#L149) |
| CSS | [workspace.css · Floating editor sheet](../../../frontend/src/css/workspace.css#L362) |
| Browser logic | [quick-editor.js · export function initQuickEditor(](../../../frontend/src/js/planning/quick-editor.js#L632)<br>[quick-editor.js · export function changedFields(](../../../frontend/src/js/planning/quick-editor.js#L89)<br>[quick-editor.js · export function quickEditLink(](../../../frontend/src/js/planning/quick-editor.js#L122) |
| Controller / service / domain | [PlanningService.php · public function update(string $type, int $userId, string $id, array $input): array](../../../backend/src/Application/Planning/PlanningService.php#L164)<br>[PlanningService.php · public function create(string $type, int $userId, array $input): array](../../../backend/src/Application/Planning/PlanningService.php#L97) |
| Persistence | [PdoPlanningRepository.php · public function update(](../../../backend/src/Infrastructure/Persistence/Pdo/Planning/PdoPlanningRepository.php#L94) |
| Relevant tests (not a pass claim) | [quick-editor.test.js · test('an edit sends only what changed, in API shape'](../../../frontend/tests/js/quick-editor.test.js#L34)<br>[quick-editor.test.js · test('creating sends every field, and Goals and Milestones carry their icon'](../../../frontend/tests/js/quick-editor.test.js#L55) |
| Coverage limit | Form value and change mapping are unit-tested; opening, saving, conflicts, checklist and transitions were exercised in a browser. |
| HTTP | `GET /api/v1/tasks/{id}` (`api.tasks.show`) → [PlanningController::show](../../../backend/src/Http/Controller/PlanningController.php#L44)<br>`PATCH /api/v1/tasks/{id}` (`api.tasks.update`) → [PlanningController::update](../../../backend/src/Http/Controller/PlanningController.php#L54)<br>`POST /api/v1/tasks` (`api.tasks.store`) → [PlanningController::store](../../../backend/src/Http/Controller/PlanningController.php#L34)<br>`GET /api/v1/goals/{id}` (`api.goals.show`) → [PlanningController::show](../../../backend/src/Http/Controller/PlanningController.php#L44)<br>`PATCH /api/v1/goals/{id}` (`api.goals.update`) → [PlanningController::update](../../../backend/src/Http/Controller/PlanningController.php#L54)<br>`POST /api/v1/goals` (`api.goals.store`) → [PlanningController::store](../../../backend/src/Http/Controller/PlanningController.php#L34)<br>`GET /api/v1/milestones/{id}` (`api.milestones.show`) → [PlanningController::show](../../../backend/src/Http/Controller/PlanningController.php#L44)<br>`PATCH /api/v1/milestones/{id}` (`api.milestones.update`) → [PlanningController::update](../../../backend/src/Http/Controller/PlanningController.php#L54)<br>`POST /api/v1/milestones` (`api.milestones.store`) → [PlanningController::store](../../../backend/src/Http/Controller/PlanningController.php#L34)<br>`GET /api/v1/tasks/{id}/checklist` (`api.tasks.checklist.index`) → [PlanningController::checklist](../../../backend/src/Http/Controller/PlanningController.php#L151)<br>`POST /api/v1/tasks/{id}/checklist` (`api.tasks.checklist.store`) → [PlanningController::createChecklist](../../../backend/src/Http/Controller/PlanningController.php#L157)<br>`PATCH /api/v1/tasks/{id}/checklist/{item}` (`api.tasks.checklist.update`) → [PlanningController::updateChecklist](../../../backend/src/Http/Controller/PlanningController.php#L167)<br>`POST /api/v1/tasks/{id}/complete` (`api.tasks.complete`) → [PlanningController::transition](../../../backend/src/Http/Controller/PlanningController.php#L92)<br>`POST /api/v1/tasks/{id}/reopen` (`api.tasks.reopen`) → [PlanningController::transition](../../../backend/src/Http/Controller/PlanningController.php#L92)<br>`POST /api/v1/milestones/{id}/complete` (`api.milestones.complete`) → [PlanningController::transition](../../../backend/src/Http/Controller/PlanningController.php#L92)<br>`POST /api/v1/milestones/{id}/reopen` (`api.milestones.reopen`) → [PlanningController::transition](../../../backend/src/Http/Controller/PlanningController.php#L92)<br>`POST /api/v1/goals/{id}/complete` (`api.goals.complete`) → [PlanningController::transition](../../../backend/src/Http/Controller/PlanningController.php#L92)<br>`POST /api/v1/goals/{id}/reopen` (`api.goals.reopen`) → [PlanningController::transition](../../../backend/src/Http/Controller/PlanningController.php#L92) |

<!-- END GENERATED TRACE -->

## Style file ownership

| Change | Source |
| --- | --- |
| Tokens, fonts, basic elements | [tokens.css](../../../frontend/src/css/tokens.css), [base.css](../../../frontend/src/css/base.css), [app.css](../../../frontend/src/css/app.css) |
| Sidebar/topbar/layout and controls | [layout.css](../../../frontend/src/css/layout.css), [controls.css](../../../frontend/src/css/controls.css), [components.css](../../../frontend/src/css/components.css) |
| Planning/workspace | [planning.css](../../../frontend/src/css/planning.css), [workspace.css](../../../frontend/src/css/workspace.css) |
| Notes/editor | [notes.css](../../../frontend/src/css/notes.css), [note-content.css](../../../frontend/src/css/note-content.css) |
| Settings | [settings.css](../../../frontend/src/css/settings.css) |
| Theme/reference/illustrations and later feature overrides | [illustrated.css](../../../frontend/src/css/illustrated.css), [reference.css](../../../frontend/src/css/reference.css), [feedback.css](../../../frontend/src/css/feedback.css) |
| Walkthrough | [walkthrough.css](../../../frontend/src/css/walkthrough.css) |

For missing CSS/fonts during development, use [the Vite runbook](../../operations/local-development.md).
