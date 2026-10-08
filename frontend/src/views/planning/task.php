<section class="planning-page" data-task-detail data-task-id="<?= $view->e($task_id) ?>" aria-labelledby="task-detail-title">
    <header class="workspace-header">
        <div><p class="eyebrow"><a href="/tasks">Tasks</a> / Details</p><h1 id="task-detail-title" data-task-name>Loading…</h1><p data-task-meta></p></div>
        <div class="action-row"><button class="button button-quiet" type="button" data-open-dialog="edit-task-dialog" data-task-edit-open disabled>✎ Edit task</button><button class="button button-quiet" type="button" data-task-week disabled>Select for this week</button><button class="button button-primary" type="button" data-task-transition disabled></button></div>
    </header>
    <p class="field-error is-hidden" data-planning-error role="alert"></p>
<nav class="workspace-section-menu" role="tablist" aria-label="Task sections"><button type="button" role="tab" id="task-tab-work" aria-controls="task-panel-work" aria-selected="true" tabindex="0" data-workspace-tab="work">Overview</button><button type="button" role="tab" id="task-tab-notes" aria-controls="task-panel-notes" aria-selected="false" tabindex="-1" data-workspace-tab="notes">Notes</button><button type="button" role="tab" id="task-tab-related" aria-controls="task-panel-related" aria-selected="false" tabindex="-1" data-workspace-tab="related">Related work</button></nav>
    <section id="task-panel-work" role="tabpanel" aria-labelledby="task-tab-work" data-workspace-panel="work">    <div class="planning-grid task-detail-grid">
        <article class="planning-panel">
            <h2>About this task</h2>
            <p class="task-description" data-task-description>—</p>
            <dl class="detail-list task-context-details">
                <div><dt>Belongs to</dt><dd class="task-context" data-task-context></dd></div>
                <div><dt>Estimated time</dt><dd data-task-estimate>—</dd></div>
            </dl>
            <details class="task-extra-definition"><summary>Outcome and criteria</summary><dl class="detail-list">
                <div><dt>Expected result</dt><dd data-task-result>—</dd></div>
                <div><dt>Completion criteria</dt><dd data-task-criteria>—</dd></div>
            </dl></details>
        </article>
        <div data-note-overview-host></div>
    </div>
</section>
    <section id="task-panel-notes" role="tabpanel" aria-labelledby="task-tab-notes" data-workspace-panel="notes" hidden>    <article class="planning-panel" data-task-note-card>
        <div class="section-heading"><div><h2 data-task-note-heading>Working notes</h2><p class="subtle-copy">A place for research, links, decisions, and ideas.</p></div><span data-task-note-state aria-live="polite"></span></div>
        <aside class="draft-conflict is-hidden" data-task-note-conflict role="alert"><p>The note changed elsewhere. Your draft is preserved. Choose which version to continue with.</p><div class="action-row"><button class="button button-quiet" type="button" data-note-use-saved>Use saved version</button><button class="button button-primary" type="button" data-note-keep-draft>Keep my draft</button></div></aside><nav class="workspace-section-menu" role="tablist" aria-label="Working note views"><button type="button" role="tab" id="task-note-tab-editor" aria-controls="task-note-panel-editor" aria-selected="true" tabindex="0" data-workspace-tab="note-editor">Write</button><button type="button" role="tab" id="task-note-tab-resources" aria-controls="task-note-panel-resources" aria-selected="false" tabindex="-1" data-workspace-tab="note-resources">Resources</button></nav><section id="task-note-panel-editor" role="tabpanel" aria-labelledby="task-note-tab-editor" data-workspace-panel="note-editor"><form class="stack-form" data-task-note-form>
            <label class="sr-only" for="task-note-body">Task note</label>
            <textarea id="task-note-body" name="body" maxlength="50000" rows="8" placeholder="Research, links, decisions, and working notes…"></textarea>
            <button class="button button-primary" type="submit">Save note</button>
        </form>
        <section class="task-note-checklist" aria-labelledby="task-completion-checklist-title">
            <div class="section-heading"><h3 id="task-completion-checklist-title">Task completion checklist</h3><span class="subtle-copy" data-task-checklist-count></span></div>
            <p class="subtle-copy">Used when completing this task. Check boxes in the note above are for your own tracking.</p>
            <div data-task-checklist aria-live="polite"></div>
            <details class="capture-details"><summary>Add completion check</summary>
                <form class="inline-form" data-checklist-form>
                    <label class="sr-only" for="checklist-title">New completion check</label>
                    <input id="checklist-title" name="title" maxlength="500" placeholder="What needs to be done?" required>
                    <button class="button button-quiet" type="submit">Add</button>
                </form>
            </details>
        </section>
        </section><section id="task-note-panel-resources" role="tabpanel" aria-labelledby="task-note-tab-resources" data-workspace-panel="note-resources" hidden><div class="resources-list" data-task-resources></div></section>
    </article>
</section>
<section id="task-panel-related" role="tabpanel" aria-labelledby="task-tab-related" data-workspace-panel="related" hidden><article class="planning-panel"><h2>Context and contributions</h2><p class="subtle-copy">Other goals this work supports.</p><div data-task-related></div></article></section>
<dialog id="edit-task-dialog" class="workspace-dialog" aria-labelledby="edit-task-title" data-workspace-dialog data-wait-for-data><header class="section-heading"><h2 id="edit-task-title">Edit task</h2><button class="icon-button" type="button" data-close-dialog aria-label="Close edit task">×</button></header><aside class="draft-conflict is-hidden" data-task-edit-conflict role="alert"><p>This task changed elsewhere. Your edits are preserved.</p><div class="action-row"><button type="button" class="button button-quiet" data-task-edit-use-saved>Use saved version</button><button type="button" class="button button-primary" data-task-edit-keep-draft>Keep my draft</button></div></aside><form class="stack-form" data-task-edit-form>
<div class="field"><label for="edit">Task name</label><input id="edit" name="name" autofocus maxlength="200" required disabled></div>
<div class="field"><label for="edit-task-description">Description</label><textarea id="edit-task-description" name="description" maxlength="10000" rows="3"></textarea></div>
<div class="field"><label for="edit-task-criteria">Completion criteria</label><textarea id="edit-task-criteria" name="completion_criteria" maxlength="10000" rows="3"></textarea></div>
<details class="capture-details"><summary>Outcome, dates and planning</summary>
<div class="field"><label for="edit-task-result">Expected result</label><textarea id="edit-task-result" name="expected_result" maxlength="10000" rows="2"></textarea></div>
<div class="field"><label for="edit-task-importance">Importance (1–5)</label><input id="edit-task-importance" name="importance" type="number" min="1" max="5" required></div>
<div class="field"><label for="edit-task-estimate">Estimated minutes (optional)</label><input id="edit-task-estimate" name="estimated_minutes" type="number" min="1" max="1440"></div>
<div class="field"><label for="edit-task-status">Status</label><select id="edit-task-status" name="status"><option value="NotStarted">Not started</option><option value="InProgress">In progress</option><option value="Blocked">Blocked</option><option value="Done" disabled>Completed · reopen to change status</option></select></div>
<div class="field"><label for="edit-task-start">Start date</label><input id="edit-task-start" name="start_date" type="date"></div>
<div class="field"><label for="edit-task-deadline">Deadline</label><input id="edit-task-deadline" name="deadline" type="date"></div>
<div class="field"><label for="edit-task-scheduled-start">Scheduled start (UTC)</label><input id="edit-task-scheduled-start" name="scheduled_start" type="datetime-local"></div>
<div class="field"><label for="edit-task-scheduled-end">Scheduled end (UTC)</label><input id="edit-task-scheduled-end" name="scheduled_end" type="datetime-local"></div>
</details><button class="button button-primary" type="submit" disabled>Save task</button></form><p class="field-error is-hidden" data-dialog-error role="alert"></p></dialog>
</section>
