<section class="planning-page" data-goals-page aria-labelledby="planning-title">
    <header class="workspace-header scene-header">
        <div>
            <h1 id="planning-title"><?= $view->e($view->t('Goals')) ?></h1>
            <p><?= $view->e($view->t('Give your ambitions a direction.')) ?></p>
        </div>
        <div class="action-row">
            <button class="button button-quiet" type="button" data-planning-retry>
                <svg class="ui-icon" aria-hidden="true"><use href="#icon-refresh"/></svg>
                <?= $view->e($view->t('Refresh')) ?>
            </button>
            <button class="button button-quiet" type="button" data-open-dialog="areas-dialog"><svg class="ui-icon" aria-hidden="true"><use href="#icon-settings"/></svg><?= $view->e($view->t('Manage areas')) ?></button>
            <button class="button button-primary" type="button" data-goal-new>
                <svg class="ui-icon" aria-hidden="true"><use href="#icon-plus"/></svg>
                <?= $view->e($view->t('New goal')) ?>
            </button>
        </div>
    </header>
    <p class="field-error is-hidden" data-planning-error role="alert"></p>
    <div data-main-goal></div>
    <div class="task-view-menu" role="group" aria-label="<?= $view->e($view->t('Goal views')) ?>">
        <button type="button" data-goals-view="areas" aria-pressed="true"><?= $view->e($view->t('Areas')) ?></button>
        <button type="button" data-goals-view="timeline" aria-pressed="false"><?= $view->e($view->t('Timeline')) ?></button>
        <button type="button" data-goals-expand><?= $view->e($view->t('Expand all')) ?></button>
    </div>
    <div class="planning-panel" data-goal-timeline hidden></div>
    <div class="collection-layout collection-focused" data-goal-areas-view>
        <div class="collection-main">
            <section class="planning-panel" aria-labelledby="goal-tree-title">
                <h2 id="goal-tree-title" class="sr-only"><?= $view->e($view->t('Your goals')) ?></h2>
                <div data-goal-tree aria-live="polite">
                    <p class="loading-copy"><?= $view->e($view->t('Loading goals…')) ?></p>
                </div>
            </section>
        </div>
    </div>
    <button class="button add-area-reference" type="button" data-open-dialog="areas-dialog">
        <svg class="ui-icon" aria-hidden="true"><use href="#icon-plus"/></svg>
        <?= $view->e($view->t('Add another life area')) ?>
    </button>
    <dialog id="areas-dialog" class="workspace-dialog" aria-labelledby="areas-dialog-title" data-workspace-dialog>
        <header class="section-heading">
            <h2 id="areas-dialog-title"><?= $view->e($view->t('Manage areas')) ?></h2>
            <button class="icon-button" type="button" data-close-dialog aria-label="<?= $view->e($view->t('Close manage areas')) ?>">×</button>
        </header>
        <p class="panel-description"><?= $view->e($view->t('Areas give your goals a home. Two to four is a good place to start.')) ?></p>
        <div data-area-list aria-live="polite">
            <p class="loading-copy"><?= $view->e($view->t('Loading areas…')) ?></p>
        </div>
        <form class="stack-form" data-area-create-form>
            <label class="sr-only" for="area-name"><?= $view->e($view->t('New area name')) ?></label>
            <input id="area-name" name="name" maxlength="80" placeholder="<?= $view->e($view->t('Another life area')) ?>" required>
            <div class="dialog-footer">
                <button class="button button-quiet" type="button" data-close-dialog><?= $view->e($view->t('Cancel')) ?></button>
                <button class="button button-primary" type="submit"><svg class="ui-icon" aria-hidden="true"><use href="#icon-plus"/></svg><?= $view->e($view->t('Add area')) ?></button>
            </div>
        </form>
        <p class="field-error is-hidden" data-dialog-error role="alert"></p>
    </dialog>
</section>
