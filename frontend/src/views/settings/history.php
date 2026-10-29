<section class="settings-page" data-history-settings aria-labelledby="settings-title">
    <header class="settings-header">
        <div>
            <p class="eyebrow"><?= $view->e($view->t('Account')) ?></p>
            <h1 id="settings-title"><?= $view->e($view->t('Task history')) ?></h1>
            <p><?= $view->e($view->t('Finished and long-overdue tasks move here so your lists stay focused. Reopen any task to bring it back.')) ?></p>
        </div>
    </header>
    <div class="settings-panel">
        <form class="history-rules" data-history-rules>
            <label><?= $view->e($view->t('Move completed tasks after (hours)')) ?> <input type="number" name="history_completed_hours" min="1" max="720" value="<?= (int) $preferences['history_completed_hours'] ?>" required></label>
            <label><?= $view->e($view->t('Move overdue tasks after (days)')) ?> <input type="number" name="history_overdue_days" min="1" max="365" value="<?= (int) $preferences['history_overdue_days'] ?>" required></label>
            <label><?= $view->e($view->t('Automatically remove history after (days, empty keeps it)')) ?> <input type="number" name="history_retention_days" min="1" max="3650" value="<?= $preferences['history_retention_days'] === null ? '' : (int) $preferences['history_retention_days'] ?>"></label>
            <button class="button button-primary" type="submit"><?= $view->e($view->t('Save rules')) ?></button>
            <p class="field-hint"><?= $view->e($view->t('Removed tasks are archived, not erased. The administrator also sets a maximum history size; the oldest tasks beyond it are removed first.')) ?></p>
        </form>
        <p class="save-status" data-history-status role="status"></p>
    </div>
    <div class="settings-panel">
        <div class="field">
            <label for="history-search"><?= $view->e($view->t('Find')) ?></label>
            <input id="history-search" type="search" placeholder="<?= $view->e($view->t('Search names and descriptions')) ?>" data-history-search>
        </div>
        <div class="planning-list" data-history-list aria-live="polite"></div>
    </div>
</section>
