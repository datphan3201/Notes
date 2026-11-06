<section class="settings-page" data-archive-settings aria-labelledby="settings-title">
    <header class="settings-header">
        <div>
            <p class="eyebrow"><?= $view->e($view->t('Account')) ?></p>
            <h1 id="settings-title"><?= $view->e($view->t('Archive')) ?></h1>
            <p><?= $view->e($view->t('Archived Areas, Goals, Milestones, Tasks and Habits keep all their data. Restore one to bring it back to your lists; a Goal or Milestone comes back with everything archived together with it.')) ?></p>
        </div>
    </header>
    <div class="settings-panel">
        <div class="archive-filters">
            <div class="field">
                <label for="archive-type"><?= $view->e($view->t('Show')) ?></label>
                <select id="archive-type" data-archive-type>
                    <option value="all"><?= $view->e($view->t('Everything')) ?></option>
                    <option value="area"><?= $view->e($view->t('Areas')) ?></option>
                    <option value="goal"><?= $view->e($view->t('Goals')) ?></option>
                    <option value="milestone"><?= $view->e($view->t('Milestones')) ?></option>
                    <option value="task"><?= $view->e($view->t('Tasks')) ?></option>
                    <option value="habit"><?= $view->e($view->t('Habits')) ?></option>
                </select>
            </div>
            <div class="field">
                <label for="archive-search"><?= $view->e($view->t('Find')) ?></label>
                <input id="archive-search" type="search" placeholder="<?= $view->e($view->t('Search names')) ?>" data-archive-search>
            </div>
        </div>
        <div class="archive-tools">
            <p class="save-status" data-archive-status role="status"></p>
            <button class="button button-danger-quiet" type="button" data-archive-empty hidden><?= $view->e($view->t('Empty archive')) ?></button>
        </div>
        <div class="planning-list" data-archive-list aria-live="polite"></div>
        <div class="collection-pagination" data-archive-pagination></div>
    </div>
</section>
