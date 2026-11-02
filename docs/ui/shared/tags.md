# Shared — Tags and legacy labels

[Documentation home](../../README.md) · [All routes](../../reference/routes.md)

There is no standalone Tags HTML route. Notes exposes label management; planning entities expose tag pickers. The physical `labels` table is the shared Tag store, not a second classification system.

<!-- BEGIN GENERATED TRACE -->

### Tag picker, hierarchy and Notes labels

**Trace ID:** `shared.tags`

Names are normalized and owner-unique. Tag moves reject cycles; complete tag_ids snapshots belong to their aggregate mutation. `/api/v1/labels` remains a compatibility API over the same rows.

| Layer | Entry point |
| --- | --- |
| UI / DOM | [index.php · &lt;button class="label-add-link" type="button" data-open-label-manager&gt;](../../../frontend/src/views/notes/index.php#L76) |
| Browser logic | [tag-picker.js · export function createTagPicker](../../../frontend/src/js/planning/tag-picker.js#L38)<br>[notes-page.js · export class NotesPage](../../../frontend/src/js/notes/notes-page.js#L8) |
| Controller / service / domain | [TagService.php · public function createTag(](../../../backend/src/Application/Tags/TagService.php#L140)<br>[TagService.php · public function updateTag(](../../../backend/src/Application/Tags/TagService.php#L170)<br>[TagService.php · public function archiveTag(](../../../backend/src/Application/Tags/TagService.php#L214) |
| Persistence | [PdoTagRepository.php · public function listForOwner(](../../../backend/src/Infrastructure/Persistence/Pdo/Tags/PdoTagRepository.php#L17)<br>[PdoTagRepository.php · public function updateTag(](../../../backend/src/Infrastructure/Persistence/Pdo/Tags/PdoTagRepository.php#L182)<br>[PdoTagRepository.php · public function hierarchyEdges(](../../../backend/src/Infrastructure/Persistence/Pdo/Tags/PdoTagRepository.php#L239) |
| Relevant tests (not a pass claim) | [PlanningCoreTest.php · public function test_hierarchical_tags_reject_cycles_and_snapshots_are_owner_scoped(](../../../backend/tests/Plain/Integration/PlanningCoreTest.php#L174) |
| HTTP | `GET /api/v1/labels` (`api.labels.index`) → [LabelController::index](../../../backend/src/Http/Controller/LabelController.php#L26)<br>`POST /api/v1/labels` (`api.labels.store`) → [LabelController::store](../../../backend/src/Http/Controller/LabelController.php#L36)<br>`GET /api/v1/tags` (`api.tags.index`) → [LabelController::index](../../../backend/src/Http/Controller/LabelController.php#L26)<br>`POST /api/v1/tags/{tag}/move` (`api.tags.move`) → [LabelController::tagMove](../../../backend/src/Http/Controller/LabelController.php#L103) |

<!-- END GENERATED TRACE -->


