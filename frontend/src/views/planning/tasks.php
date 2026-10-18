<section class="planning-page" data-tasks-page aria-labelledby="tasks-title">
    <header class="workspace-header scene-header" data-reference-decoration="corner">
        <div>
            <h1 id="tasks-title"><?= $view->e($view->t('Tasks')) ?></h1>
            <p><?= $view->e($view->t('A place for the next step, and the one after that.')) ?></p>
        </div>
        <button class="button button-primary" type="button" data-open-dialog="new-task-dialog">
            <svg class="ui-icon" aria-hidden="true"><use href="#icon-plus"/></svg>
            <?= $view->e($view->t('New task')) ?>
        </button>
    </header>
    <p class="field-error is-hidden" data-planning-error role="alert"></p>
    <div class="collection-layout collection-focused">
        <section class="planning-panel collection-main">
            <div class="section-heading">
                <h2>
                    <svg class="ui-icon" aria-hidden="true"><use href="#icon-tasks"/></svg>
                    <?= $view->e($view->t('Tasks')) ?>
                </h2>
                <button class="icon-button" type="button" data-planning-retry aria-label="Refresh tasks">
                    <svg class="ui-icon" aria-hidden="true"><use href="#icon-refresh"/></svg>
                </button>
            </div>
            <div class="task-view-menu" role="group" aria-label="Task time filters">
                <button type="button" data-task-view="today" aria-pressed="true">
                    <?= $view->e($view->t('Today')) ?>
                    <span class="count-badge" data-task-view-count="today">—</span>
                </button>
                <button type="button" data-task-view="next" aria-pressed="false">
                    <?= $view->e($view->t('Next')) ?>
                    <span class="count-badge" data-task-view-count="next">—</span>
                </button>
                <button type="button" data-task-view="week" aria-pressed="false">
                    <?= $view->e($view->t('This week')) ?>
                    <span class="count-badge" data-task-view-count="week">—</span>
                </button>
                <button type="button" data-task-view="backlog" aria-pressed="false">
                    <?= $view->e($view->t('Backlog')) ?>
                    <span class="count-badge" data-task-view-count="backlog">—</span>
                </button>
                <button type="button" data-task-view="all" aria-pressed="false">
                    <?= $view->e($view->t('All')) ?>
                    <span class="count-badge" data-task-view-count="all">—</span>
                </button>
                <button type="button" data-task-view="completed" aria-pressed="false"><?= $view->e($view->t('Completed')) ?> <span class="count-badge" data-task-view-count="completed">—</span></button>
                <button type="button" data-task-view="history" aria-pressed="false"><?= $view->e($view->t('History')) ?> <span class="count-badge" data-task-view-count="history">—</span></button>
            </div>
            <p class="subtle-copy" data-task-history-hint hidden><?= $view->e($view->t('Completed for 24 hours or overdue by at least 3 days. History keeps your data; reopen or edit a task to bring it back to current work.')) ?></p>
            <details class="task-filter-details">
                <summary><?= $view->e($view->t('Filter and search')) ?></summary>
                <div class="collection-controls">
                    <div class="field">
                        <label for="task-search"><?= $view->e($view->t('Find a task')) ?></label>
                        <input id="task-search" type="search" placeholder="<?= $view->e($view->t('Search task names')) ?>" data-task-search>
                    </div>
                    <div class="field">
                        <label for="task-status"><?= $view->e($view->t('Status')) ?></label>
                        <select id="task-status" data-task-status>
                            <option value="open"><?= $view->e($view->t('Open tasks')) ?></option>
                            <option value="all"><?= $view->e($view->t('All tasks')) ?></option>
                            <option value="Done"><?= $view->e($view->t('Completed')) ?></option>
                            <option value="NotStarted"><?= $view->e($view->t('Not started')) ?></option>
                            <option value="InProgress"><?= $view->e($view->t('In progress')) ?></option>
                            <option value="Blocked"><?= $view->e($view->t('Blocked')) ?></option>
                        </select>
                    </div>
                </div>
            </details>
            <div data-task-list aria-live="polite">
                <p class="loading-copy"><?= $view->e($view->t('Loading tasks…')) ?></p>
            </div>
            <div class="collection-pagination" data-task-pagination aria-label="<?= $view->e($view->t('Task pages')) ?>"></div>
        </section>
    </div>
    <dialog id="new-task-dialog" class="workspace-dialog" aria-labelledby="new-task-dialog-title" data-workspace-dialog>
        <header class="section-heading">
            <h2 id="new-task-dialog-title"><?= $view->e($view->t('New task')) ?></h2>
            <button class="icon-button" type="button" data-close-dialog aria-label="<?= $view->e($view->t('Close new task')) ?>">×</button>
        </header>
        <form class="stack-form" data-task-create-form>
            <div class="field">
                <label for="task-parent"><?= $view->e($view->t('Add to')) ?></label>
                <select id="task-parent" name="parent" data-task-parent>
                    <option value=""><?= $view->e($view->t('Inbox · organize later')) ?></option>
                </select>
                <small data-task-parent-context></small>
            </div>
            <div class="field">
                <label for="task-name"><?= $view->e($view->t('Task name')) ?></label>
                <input id="task-name" name="name" autofocus maxlength="200" placeholder="<?= $view->e($view->t('What needs to get done?')) ?>" required>
            </div>
            <div class="capture-suggestions" data-capture-suggestions="name">
                <button type="button"><?= $view->e($view->t('Build a minimal example')) ?></button>
                <button type="button"><?= $view->e($view->t('Read and summarize')) ?></button>
                <button type="button"><?= $view->e($view->t('Write an explanation')) ?></button>
            </div>
            <div class="field">
                <label for="task-criteria"><?= $view->e($view->t('Completion criteria')) ?></label>
                <textarea id="task-criteria" name="completion_criteria" rows="3" maxlength="10000" placeholder="<?= $view->e($view->t('What does done look like?')) ?>"></textarea>
                <div class="capture-suggestions" data-capture-suggestions="completion_criteria">
                    <button type="button"><?= $view->e($view->t('Works end-to-end')) ?></button>
                    <button type="button"><?= $view->e($view->t('Tested')) ?></button>
                    <button type="button"><?= $view->e($view->t('Explain in my own words')) ?></button>
                </div>
                <span class="field-hint"><?= $view->e($view->t('Optional. Describe the result in your own words.')) ?></span>
            </div>
            <?php require __DIR__.'/task-capture-fields.php'; ?>
            <div class="dialog-footer">
                <button class="button button-quiet" type="button" data-close-dialog><?= $view->e($view->t('Cancel')) ?></button>
                <button class="button button-primary" type="submit">
                    <svg class="ui-icon" aria-hidden="true"><use href="#icon-plus"/></svg>
                    <?= $view->e($view->t('Create task')) ?>
                </button>
            </div>
        </form>
        <p class="field-error is-hidden" data-dialog-error role="alert"></p>
    </dialog>
</section>
