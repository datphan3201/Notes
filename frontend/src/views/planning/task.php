<section class="planning-page" data-task-detail data-task-id="<?= $view->e($task_id) ?>" aria-labelledby="task-detail-title">
    <header class="workspace-header">
        <div>
            <p class="eyebrow">
                <a href="/tasks"><?= $view->e($view->t('Tasks')) ?></a>
                <?= $view->e($view->t('/ Details')) ?>
            </p>
            <h1 id="task-detail-title" data-task-name><?= $view->e($view->t('Loading…')) ?></h1>
            <p data-task-meta></p>
        </div>
        <div class="action-row">
            <button class="button button-quiet" type="button" data-open-dialog="edit-task-dialog" data-task-edit-open disabled><?= $view->e($view->t('✎ Edit task')) ?></button>
            <button class="button button-quiet" type="button" data-task-week disabled><?= $view->e($view->t('Select for this week')) ?></button>
            <button class="button button-primary" type="button" data-task-transition disabled></button>
        </div>
    </header>
    <p class="field-error is-hidden" data-planning-error role="alert"></p>
    <nav class="workspace-section-menu" role="tablist" aria-label="Task sections">
        <button type="button" role="tab" id="task-tab-work" aria-controls="task-panel-work" aria-selected="true" tabindex="0" data-workspace-tab="work"><?= $view->e($view->t('Overview')) ?></button>
        <button type="button" role="tab" id="task-tab-notes" aria-controls="task-panel-notes" aria-selected="false" tabindex="-1" data-workspace-tab="notes"><?= $view->e($view->t('Notes')) ?></button>
        <button type="button" role="tab" id="task-tab-related" aria-controls="task-panel-related" aria-selected="false" tabindex="-1" data-workspace-tab="related"><?= $view->e($view->t('Related work')) ?></button>
    </nav>
    <section id="task-panel-work" role="tabpanel" aria-labelledby="task-tab-work" data-workspace-panel="work">
        <div class="planning-grid task-detail-grid">
            <article class="planning-panel">
                <h2><?= $view->e($view->t('About this task')) ?></h2>
                <p class="task-description" data-task-description>—</p>
                <dl class="detail-list task-context-details">
                    <div>
                        <dt><?= $view->e($view->t('Belongs to')) ?></dt>
                        <dd class="task-context" data-task-context></dd>
                    </div>
                    <div>
                        <dt><?= $view->e($view->t('Estimated time')) ?></dt>
                        <dd data-task-estimate>—</dd>
                    </div>
                </dl>
                <details class="task-extra-definition">
                    <summary><?= $view->e($view->t('Outcome and criteria')) ?></summary>
                    <dl class="detail-list">
                        <div>
                            <dt><?= $view->e($view->t('Expected result')) ?></dt>
                            <dd data-task-result>—</dd>
                        </div>
                        <div>
                            <dt><?= $view->e($view->t('Completion criteria')) ?></dt>
                            <dd data-task-criteria>—</dd>
                        </div>
                    </dl>
                </details>
            </article>
            <div data-note-overview-host></div>
        </div>
    </section>
    <section id="task-panel-notes" role="tabpanel" aria-labelledby="task-tab-notes" data-workspace-panel="notes" hidden>
        <article class="planning-panel" data-task-note-card>
            <div class="section-heading">
                <div>
                    <h2 data-task-note-heading><?= $view->e($view->t('Working notes')) ?></h2>
                    <p class="subtle-copy"><?= $view->e($view->t('A place for research, links, decisions, and ideas.')) ?></p>
                </div>
                <span data-task-note-state aria-live="polite"></span>
            </div>
            <aside class="draft-conflict is-hidden" data-task-note-conflict role="alert">
                <p><?= $view->e($view->t('The note changed elsewhere. Your draft is preserved. Choose which version to continue with.')) ?></p>
                <div class="action-row">
                    <button class="button button-quiet" type="button" data-note-use-saved><?= $view->e($view->t('Use saved version')) ?></button>
                    <button class="button button-primary" type="button" data-note-keep-draft><?= $view->e($view->t('Keep my draft')) ?></button>
                </div>
            </aside>
            <nav class="workspace-section-menu" role="tablist" aria-label="Working note views">
                <button type="button" role="tab" id="task-note-tab-editor" aria-controls="task-note-panel-editor" aria-selected="true" tabindex="0" data-workspace-tab="note-editor"><?= $view->e($view->t('Write')) ?></button>
                <button type="button" role="tab" id="task-note-tab-resources" aria-controls="task-note-panel-resources" aria-selected="false" tabindex="-1" data-workspace-tab="note-resources"><?= $view->e($view->t('Resources')) ?></button>
            </nav>
            <section id="task-note-panel-editor" role="tabpanel" aria-labelledby="task-note-tab-editor" data-workspace-panel="note-editor">
                <form class="stack-form" data-task-note-form>
                    <label class="sr-only" for="task-note-body"><?= $view->e($view->t('Task note')) ?></label>
                    <textarea id="task-note-body" name="body" maxlength="50000" rows="8" placeholder="Research, links, decisions, and working notes…"></textarea>
                    <button class="button button-primary" type="submit"><?= $view->e($view->t('Save note')) ?></button>
                </form>
                <section class="task-note-checklist" aria-labelledby="task-completion-checklist-title">
                    <div class="section-heading">
                        <h3 id="task-completion-checklist-title"><?= $view->e($view->t('Task completion checklist')) ?></h3>
                        <span class="subtle-copy" data-task-checklist-count></span>
                    </div>
                    <p class="subtle-copy"><?= $view->e($view->t('Used when completing this task. Check boxes in the note above are for your own tracking.')) ?></p>
                    <div data-task-checklist aria-live="polite"></div>
                    <details class="capture-details">
                        <summary><?= $view->e($view->t('Add completion check')) ?></summary>
                        <form class="inline-form" data-checklist-form>
                            <label class="sr-only" for="checklist-title"><?= $view->e($view->t('New completion check')) ?></label>
                            <input id="checklist-title" name="title" maxlength="500" placeholder="What needs to be done?" required>
                            <button class="button button-quiet" type="submit"><?= $view->e($view->t('Add')) ?></button>
                        </form>
                    </details>
                </section>
            </section>
            <section id="task-note-panel-resources" role="tabpanel" aria-labelledby="task-note-tab-resources" data-workspace-panel="note-resources" hidden>
                <div class="resources-list" data-task-resources></div>
            </section>
        </article>
    </section>
    <section id="task-panel-related" role="tabpanel" aria-labelledby="task-tab-related" data-workspace-panel="related" hidden>
        <article class="planning-panel">
            <h2><?= $view->e($view->t('Context and contributions')) ?></h2>
            <p class="subtle-copy"><?= $view->e($view->t('Other goals this work supports.')) ?></p>
            <div data-task-related></div>
        </article>
    </section>
    <dialog id="edit-task-dialog" class="workspace-dialog" aria-labelledby="edit-task-title" data-workspace-dialog data-wait-for-data>
        <header class="section-heading">
            <h2 id="edit-task-title"><?= $view->e($view->t('Edit task')) ?></h2>
            <button class="icon-button" type="button" data-close-dialog aria-label="Close edit task">×</button>
        </header>
        <aside class="draft-conflict is-hidden" data-task-edit-conflict role="alert">
            <p><?= $view->e($view->t('This task changed elsewhere. Your edits are preserved.')) ?></p>
            <div class="action-row">
                <button type="button" class="button button-quiet" data-task-edit-use-saved><?= $view->e($view->t('Use saved version')) ?></button>
                <button type="button" class="button button-primary" data-task-edit-keep-draft><?= $view->e($view->t('Keep my draft')) ?></button>
            </div>
        </aside>
        <form class="stack-form" data-task-edit-form>
            <div class="field">
                <label for="edit"><?= $view->e($view->t('Task name')) ?></label>
                <input id="edit" name="name" autofocus maxlength="200" required disabled>
            </div>
            <div class="field">
                <label for="edit-task-description"><?= $view->e($view->t('Description')) ?></label>
                <textarea id="edit-task-description" name="description" maxlength="10000" rows="3"></textarea>
            </div>
            <div class="field">
                <label for="edit-task-criteria"><?= $view->e($view->t('Completion criteria')) ?></label>
                <textarea id="edit-task-criteria" name="completion_criteria" maxlength="10000" rows="3"></textarea>
            </div>
            <details class="capture-details">
                <summary><?= $view->e($view->t('Outcome, dates and planning')) ?></summary>
                <div class="field">
                    <label for="edit-task-result"><?= $view->e($view->t('Expected result')) ?></label>
                    <textarea id="edit-task-result" name="expected_result" maxlength="10000" rows="2"></textarea>
                </div>
                <div class="field">
                    <label for="edit-task-importance"><?= $view->e($view->t('Importance')) ?></label>
                    <select id="edit-task-importance" name="importance" required>
                        <?php require __DIR__.'/importance-options.php'; ?>
                    </select>
                </div>
                <div class="field">
                    <label for="edit-task-estimate"><?= $view->e($view->t('Estimated minutes (optional)')) ?></label>
                    <input id="edit-task-estimate" name="estimated_minutes" type="number" min="1" max="1440">
                </div>
                <div class="field">
                    <label for="edit-task-status"><?= $view->e($view->t('Status')) ?></label>
                    <select id="edit-task-status" name="status">
                        <option value="NotStarted"><?= $view->e($view->t('Not started')) ?></option>
                        <option value="InProgress"><?= $view->e($view->t('In progress')) ?></option>
                        <option value="Blocked"><?= $view->e($view->t('Blocked')) ?></option>
                        <option value="Done" disabled><?= $view->e($view->t('Completed · reopen to change status')) ?></option>
                    </select>
                </div>
                <div class="field">
                    <label for="edit-task-start"><?= $view->e($view->t('Start date')) ?></label>
                    <input id="edit-task-start" name="start_date" type="date">
                </div>
                <div class="field">
                    <label for="edit-task-deadline"><?= $view->e($view->t('Deadline')) ?></label>
                    <input id="edit-task-deadline" name="deadline" type="date">
                </div>
                <div class="field">
                    <label for="edit-task-reminder"><?= $view->e($view->t('Reminder (UTC)')) ?></label>
                    <input id="edit-task-reminder" name="reminder_at" type="datetime-local">
                </div>
                <div class="field">
                    <label for="edit-task-scheduled-start"><?= $view->e($view->t('Scheduled start (UTC)')) ?></label>
                    <input id="edit-task-scheduled-start" name="scheduled_start" type="datetime-local">
                </div>
                <div class="field">
                    <label for="edit-task-scheduled-end"><?= $view->e($view->t('Scheduled end (UTC)')) ?></label>
                    <input id="edit-task-scheduled-end" name="scheduled_end" type="datetime-local">
                </div>
            </details>
            <button class="button button-primary" type="submit" disabled><?= $view->e($view->t('Save task')) ?></button>
        </form>
        <p class="field-error is-hidden" data-dialog-error role="alert"></p>
    </dialog>
</section>
