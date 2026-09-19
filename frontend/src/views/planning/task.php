<section class="planning-page" data-task-detail data-task-id="<?= $view->e($task_id) ?>" aria-labelledby="task-detail-title">
    <header class="workspace-header">
        <div><p class="eyebrow"><a href="/tasks">Tasks</a> / Details</p><h1 id="task-detail-title" data-task-name>Loading…</h1><p data-task-meta></p></div>
        <div class="action-row"><button class="button button-quiet" type="button" data-task-week>Select for this week</button><button class="button button-primary" type="button" data-task-transition></button></div>
    </header>
    <p class="field-error is-hidden" data-planning-error role="alert"></p>
    <div class="planning-grid">
        <article class="planning-panel">
            <h2>Definition of done</h2>
            <dl class="detail-list">
                <div><dt>Description</dt><dd data-task-description>—</dd></div>
                <div><dt>Expected result</dt><dd data-task-result>—</dd></div>
                <div><dt>Completion criteria</dt><dd data-task-criteria>—</dd></div>
            </dl>
        </article>
        <article class="planning-panel">
            <h2>Checklist</h2>
            <div data-task-checklist aria-live="polite"></div>
            <form class="inline-form" data-checklist-form>
                <label class="sr-only" for="checklist-title">New checklist item</label>
                <input id="checklist-title" name="title" maxlength="500" placeholder="New checklist item" required>
                <button class="button button-quiet" type="submit">Add</button>
            </form>
        </article>
    </div>
    <article class="planning-panel">
        <div class="section-heading"><div><h2>Working notes</h2><p class="subtle-copy">A place for research, links, decisions, and ideas.</p></div><span data-task-note-state aria-live="polite"></span></div>
        <form class="stack-form" data-task-note-form>
            <label class="sr-only" for="task-note-body">Task note</label>
            <textarea id="task-note-body" name="body" maxlength="50000" rows="12" placeholder="Research, links, decisions, and working notes…"></textarea>
            <button class="button button-primary" type="submit">Save note</button>
        </form>
    </article>
</section>
