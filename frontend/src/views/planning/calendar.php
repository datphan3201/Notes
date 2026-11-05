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
                        <button type="button" data-calendar-view="gantt" aria-pressed="false"><?= $view->e($view->t('Gantt')) ?></button>
                    </div>
                </div>
            </div>
            <div class="calendar-weekdays" data-calendar-weekdays aria-hidden="true"></div>
            <div class="calendar-grid" data-calendar-grid aria-busy="true"></div>
            <p class="calendar-hint subtle-copy" data-calendar-hint><?= $view->e($view->t('Drag an item to another day, or focus it and press Alt with an arrow key. Double-click a day to add a task on it.')) ?></p>
            <div class="gantt" data-calendar-gantt hidden>
                <div class="gantt-controls">
                    <label><?= $view->e($view->t('Show by')) ?>
                        <select data-gantt-by>
                            <option value="goal"><?= $view->e($view->t('Goal')) ?></option>
                            <option value="milestone"><?= $view->e($view->t('Milestone')) ?></option>
                            <option value="task"><?= $view->e($view->t('Task')) ?></option>
                        </select>
                    </label>
                    <label><?= $view->e($view->t('Zoom')) ?>
                        <select data-gantt-zoom>
                            <option value="day"><?= $view->e($view->t('Days')) ?></option>
                            <option value="week"><?= $view->e($view->t('Weeks')) ?></option>
                            <option value="month"><?= $view->e($view->t('Months')) ?></option>
                        </select>
                    </label>
                </div>
                <div class="gantt-scroll" data-gantt-scroll tabindex="0" role="region" aria-label="<?= $view->e($view->t('Gantt timeline')) ?>"></div>
                <p class="calendar-hint subtle-copy"><?= $view->e($view->t('Slide sideways to see later weeks. Drag a bar to move it or its edges to change the start or the deadline; focused, Alt with an arrow key moves it and Alt+Shift changes its deadline. Faded edges are taken from the work inside.')) ?></p>
            </div>
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
</section>
