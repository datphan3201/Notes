<section class="planning-page calendar-page" data-calendar-page aria-labelledby="calendar-title">
    <header class="workspace-header scene-header">
        <div>
            <h1 id="calendar-title"><?= $view->e($view->t('Calendar')) ?></h1>
            <p><?= $view->e($view->t('Every date in your plan, and room to move work where it fits.')) ?></p>
        </div>
        <div class="action-row">
            <button class="button button-quiet" type="button" data-planning-retry>
                <svg class="ui-icon" aria-hidden="true"><use href="#icon-refresh"/></svg>
                <?= $view->e($view->t('Refresh')) ?>
            </button>
            <button class="button button-primary" type="button" data-calendar-add>
                <svg class="ui-icon" aria-hidden="true"><use href="#icon-plus"/></svg>
                <?= $view->e($view->t('New task')) ?>
            </button>
        </div>
    </header>
    <p class="field-error is-hidden" data-planning-error role="alert"></p>
    <p class="sr-only" data-calendar-status aria-live="polite"></p>
    <div class="calendar-layout">
        <section class="planning-panel calendar-main" aria-labelledby="calendar-period">
            <div class="calendar-toolbar">
                <div class="calendar-nav">
                    <button class="icon-button" type="button" data-calendar-step="-1" aria-label="<?= $view->e($view->t('Previous period')) ?>" title="<?= $view->e($view->t('Previous period')) ?>">
                        <svg class="ui-icon" aria-hidden="true"><use href="#icon-arrow-left"/></svg>
                    </button>
                    <button class="icon-button" type="button" data-calendar-step="1" aria-label="<?= $view->e($view->t('Next period')) ?>" title="<?= $view->e($view->t('Next period')) ?>">
                        <svg class="ui-icon" aria-hidden="true"><use href="#icon-arrow"/></svg>
                    </button>
                    <h2 id="calendar-period" data-calendar-period></h2>
                    <button class="button button-quiet" type="button" data-calendar-today><?= $view->e($view->t('Today')) ?></button>
                </div>
                <div class="calendar-controls">
                    <label class="sr-only" for="calendar-goal"><?= $view->e($view->t('Goal')) ?></label>
                    <select id="calendar-goal" data-calendar-goal>
                        <option value=""><?= $view->e($view->t('All goals')) ?></option>
                    </select>
                    <div class="calendar-switch" role="group" aria-label="<?= $view->e($view->t('Calendar view')) ?>">
                        <button type="button" data-calendar-view="month" aria-pressed="true"><?= $view->e($view->t('Month')) ?></button>
                        <button type="button" data-calendar-view="week" aria-pressed="false"><?= $view->e($view->t('Week')) ?></button>
                    </div>
                </div>
            </div>
            <div class="calendar-weekdays" data-calendar-weekdays aria-hidden="true"></div>
            <div class="calendar-grid" data-calendar-grid aria-busy="true"></div>
            <p class="calendar-hint subtle-copy"><?= $view->e($view->t('Drag an item to another day, or focus it and press Alt with an arrow key. Double-click a day to add a task on it.')) ?></p>
        </section>
        <aside class="calendar-side">
            <section class="planning-panel calendar-day" data-calendar-day aria-labelledby="calendar-day-title">
                <div class="section-heading">
                    <h2 id="calendar-day-title" data-calendar-day-title></h2>
                    <button class="button button-quiet" type="button" data-calendar-day-add>
                        <svg class="ui-icon" aria-hidden="true"><use href="#icon-plus"/></svg>
                        <?= $view->e($view->t('Add task')) ?>
                    </button>
                </div>
                <ul class="calendar-agenda" data-calendar-day-list></ul>
            </section>
            <section class="planning-panel calendar-unscheduled" data-calendar-unscheduled aria-labelledby="calendar-unscheduled-title">
                <div class="section-heading">
                    <h2 id="calendar-unscheduled-title"><?= $view->e($view->t('Unscheduled')) ?> <span class="count-badge" data-calendar-unscheduled-count>0</span></h2>
                </div>
                <p class="subtle-copy"><?= $view->e($view->t('Open tasks without a date. Drag one onto a day to set its due date.')) ?></p>
                <ul class="calendar-agenda" data-calendar-unscheduled-list></ul>
            </section>
        </aside>
    </div>
    <dialog id="calendar-task-dialog" class="workspace-dialog" aria-labelledby="calendar-task-dialog-title" data-workspace-dialog>
        <header class="section-heading">
            <h2 id="calendar-task-dialog-title"><?= $view->e($view->t('New task')) ?></h2>
            <button class="icon-button" type="button" data-close-dialog aria-label="<?= $view->e($view->t('Close new task')) ?>">×</button>
        </header>
        <form class="stack-form" data-calendar-task-form>
            <div class="field">
                <label for="calendar-task-name"><?= $view->e($view->t('Task name')) ?></label>
                <input id="calendar-task-name" name="name" autofocus maxlength="200" placeholder="<?= $view->e($view->t('What needs to get done?')) ?>" required>
            </div>
            <div class="field">
                <label for="calendar-task-parent"><?= $view->e($view->t('Add to')) ?></label>
                <select id="calendar-task-parent" name="parent" data-calendar-parent>
                    <option value=""><?= $view->e($view->t('Inbox · organize later')) ?></option>
                </select>
            </div>
            <div class="field">
                <label for="calendar-task-deadline"><?= $view->e($view->t('Due date')) ?></label>
                <input id="calendar-task-deadline" name="deadline" type="date" required>
            </div>
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
