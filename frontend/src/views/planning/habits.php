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
    <section aria-label="<?= $view->e($view->t('Check-ins')) ?>">
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
                <label for="habit-description"><?= $view->e($view->t('Description (optional)')) ?></label>
                <textarea id="habit-description" name="description" rows="3" maxlength="10000" placeholder="<?= $view->e($view->t('Why this habit matters, or exactly what counts')) ?>"></textarea>
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
</section>
