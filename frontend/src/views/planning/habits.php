<section class="planning-page" data-habits-page aria-labelledby="habits-title">
    <header class="workspace-header scene-header">
        <div>
            <h1 id="habits-title"><?= $view->e($view->t('Habits')) ?></h1>
            <p><?= $view->e($view->t('Small steps, big consistency.')) ?></p>
        </div>
        <button class="button button-primary" type="button" data-open-dialog="new-habit-dialog">
            <svg class="ui-icon" aria-hidden="true"><use href="#icon-plus"/></svg>
            <?= $view->e($view->t('New habit')) ?>
        </button>
    </header>
    <p class="field-error is-hidden" data-planning-error role="alert"></p>
    <nav class="workspace-section-menu" role="tablist" aria-label="Habits sections">
        <button type="button" role="tab" id="habits-tab-checkins" aria-controls="habits-panel-checkins" aria-selected="true" tabindex="0" data-workspace-tab="checkins"><?= $view->e($view->t('Check-ins')) ?></button>
        <button type="button" role="tab" id="habits-tab-recurring" aria-controls="habits-panel-recurring" aria-selected="false" tabindex="-1" data-workspace-tab="recurring"><?= $view->e($view->t('Recurring tasks')) ?></button>
    </nav>
    <section id="habits-panel-checkins" class="" role="tabpanel" aria-labelledby="habits-tab-checkins" data-workspace-panel="checkins">
        <div class="habit-summary">
            <article class="planning-panel">
                <h2><?= $view->e($view->t('Your streak')) ?></h2>
                <div data-habit-streak></div>
            </article>
            <article class="planning-panel scene-card quote-scene-card" data-reference-decoration="plant">
                <blockquote class="theme-quote" data-theme-quote></blockquote>
            </article>
        </div>
        <section class="planning-panel habit-today-panel">
            <div class="section-heading">
                <h2><?= $view->e($view->t('Today')) ?></h2>
                <div class="action-row">
                    <button class="button button-quiet" type="button" data-planning-retry><?= $view->e($view->t('Refresh')) ?></button>
                </div>
            </div>
            <div data-habit-list aria-live="polite">
                <p class="subtle-copy"><?= $view->e($view->t('Loading…')) ?></p>
            </div>
        </section>
    </section>
    <section id="habits-panel-recurring" class="" role="tabpanel" aria-labelledby="habits-tab-recurring" data-workspace-panel="recurring" hidden>
        <section class="planning-panel series-list-panel">
            <div class="section-heading">
                <h2><?= $view->e($view->t('Recurring tasks')) ?></h2>
                <button class="button button-primary" type="button" data-open-dialog="new-series-dialog"><?= $view->e($view->t('New recurring task')) ?></button>
            </div>
            <p class="panel-description"><?= $view->e($view->t('Keep a regular place for repeatable work.')) ?></p>
            <div data-series-list aria-live="polite">
                <p class="subtle-copy"><?= $view->e($view->t('Loading…')) ?></p>
            </div>
        </section>
    </section>
    <dialog id="new-habit-dialog" class="workspace-dialog" aria-labelledby="new-habit-dialog-title" data-workspace-dialog>
        <header class="section-heading">
            <h2 id="new-habit-dialog-title"><?= $view->e($view->t('New habit')) ?></h2>
            <button class="icon-button" type="button" data-close-dialog aria-label="Close new habit">×</button>
        </header>
        <form class="stack-form" data-habit-create-form>
            <div class="field">
                <label for="habit-name"><?= $view->e($view->t('Name')) ?></label>
                <input id="habit-name" name="name" maxlength="200" required>
            </div>
            <div class="field">
                <label for="habit-period"><?= $view->e($view->t('Period')) ?></label>
                <select id="habit-period" name="period">
                    <option value="daily"><?= $view->e($view->t('Daily')) ?></option>
                    <option value="weekly"><?= $view->e($view->t('Weekly')) ?></option>
                </select>
            </div>
            <div class="field">
                <label for="habit-target"><?= $view->e($view->t('Target days')) ?></label>
                <input id="habit-target" name="target_frequency" type="number" min="1" max="7" value="1" required>
            </div>
            <button class="button button-primary" type="submit"><?= $view->e($view->t('Create habit')) ?></button>
        </form>
        <p class="field-error is-hidden" data-dialog-error role="alert"></p>
    </dialog>
    <dialog id="new-series-dialog" class="workspace-dialog" aria-labelledby="new-series-dialog-title" data-workspace-dialog>
        <header class="section-heading">
            <h2 id="new-series-dialog-title"><?= $view->e($view->t('New recurring task')) ?></h2>
            <button class="icon-button" type="button" data-close-dialog aria-label="Close new recurring task">×</button>
        </header>
        <form class="stack-form" data-series-create-form>
            <div class="field">
                <label for="series-name"><?= $view->e($view->t('Name')) ?></label>
                <input id="series-name" name="name" maxlength="200" required>
            </div>
            <div class="field">
                <label for="series-start"><?= $view->e($view->t('Start date')) ?></label>
                <input id="series-start" name="start_date" type="date" required>
            </div>
            <div class="field">
                <label for="series-frequency"><?= $view->e($view->t('Frequency')) ?></label>
                <select id="series-frequency" name="frequency">
                    <option value="daily"><?= $view->e($view->t('Daily')) ?></option>
                    <option value="weekly"><?= $view->e($view->t('Weekly')) ?></option>
                </select>
            </div>
            <div class="field">
                <label for="series-interval"><?= $view->e($view->t('Every')) ?></label>
                <input id="series-interval" name="interval_count" type="number" min="1" max="52" value="1" required>
            </div>
            <fieldset data-series-weekdays class="is-hidden">
                <legend><?= $view->e($view->t('Days of the week')) ?></legend>
                <div class="weekday-picker">
                    <label>
                        <input type="checkbox" name="weekdays" value="1">
                        <?= $view->e($view->t('Mon')) ?>
                    </label>
                    <label>
                        <input type="checkbox" name="weekdays" value="2">
                        <?= $view->e($view->t('Tue')) ?>
                    </label>
                    <label>
                        <input type="checkbox" name="weekdays" value="3">
                        <?= $view->e($view->t('Wed')) ?>
                    </label>
                    <label>
                        <input type="checkbox" name="weekdays" value="4">
                        <?= $view->e($view->t('Thu')) ?>
                    </label>
                    <label>
                        <input type="checkbox" name="weekdays" value="5">
                        <?= $view->e($view->t('Fri')) ?>
                    </label>
                    <label>
                        <input type="checkbox" name="weekdays" value="6">
                        <?= $view->e($view->t('Sat')) ?>
                    </label>
                    <label>
                        <input type="checkbox" name="weekdays" value="7">
                        <?= $view->e($view->t('Sun')) ?>
                    </label>
                </div>
            </fieldset>
            <details class="capture-details">
                <summary><?= $view->e($view->t('End date and time (optional)')) ?></summary>
                <div class="field">
                    <label for="series-end"><?= $view->e($view->t('End date (optional)')) ?></label>
                    <input id="series-end" name="end_date" type="date">
                </div>
                <div class="field">
                    <label for="series-time"><?= $view->e($view->t('Local time (optional)')) ?></label>
                    <input id="series-time" name="local_time" type="time">
                </div>
            </details>
            <div class="action-row">
                <button class="button button-quiet" type="button" data-series-preview><?= $view->e($view->t('Preview')) ?></button>
                <button class="button button-primary" type="submit"><?= $view->e($view->t('Create series')) ?></button>
            </div>
            <p class="subtle-copy" data-series-preview-output aria-live="polite"></p>
        </form>
        <p class="field-error is-hidden" data-dialog-error role="alert"></p>
    </dialog>
</section>
