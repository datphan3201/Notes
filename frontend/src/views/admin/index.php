<section class="planning-page" data-admin-page aria-labelledby="admin-title">
    <header class="workspace-header scene-header">
        <div>
            <h1 id="admin-title"><?= $view->e($view->t('Administration')) ?></h1>
            <p><?= $view->e($view->t('Review reported notes, lock accounts that break the rules and set system limits.')) ?></p>
        </div>
    </header>
    <section class="planning-panel" aria-labelledby="admin-reports-title">
        <header class="section-heading">
            <h2 id="admin-reports-title"><?= $view->e($view->t('Reports')) ?></h2>
            <label><span class="sr-only"><?= $view->e($view->t('Status')) ?></span>
                <select data-admin-report-status>
                    <option value="open"><?= $view->e($view->t('Open')) ?></option>
                    <option value="resolved"><?= $view->e($view->t('Resolved')) ?></option>
                    <option value="dismissed"><?= $view->e($view->t('Dismissed')) ?></option>
                    <option value="all"><?= $view->e($view->t('All')) ?></option>
                </select>
            </label>
        </header>
        <div class="planning-list" data-admin-reports aria-live="polite"></div>
    </section>
    <section class="planning-panel" aria-labelledby="admin-users-title">
        <header class="section-heading">
            <h2 id="admin-users-title"><?= $view->e($view->t('Accounts')) ?></h2>
        </header>
        <input type="search" placeholder="<?= $view->e($view->t('Search email or name')) ?>" data-admin-user-search aria-label="<?= $view->e($view->t('Search accounts')) ?>">
        <div class="planning-list" data-admin-users aria-live="polite"></div>
    </section>
    <section class="planning-panel" aria-labelledby="admin-settings-title">
        <h2 id="admin-settings-title"><?= $view->e($view->t('System settings')) ?></h2>
        <form class="settings-form" data-admin-settings>
            <label><?= $view->e($view->t('Maximum tasks kept in each user’s history')) ?>
                <select name="history_limit">
                    <option value="100">100</option>
                    <option value="500">500</option>
                    <option value="1000">1000</option>
                    <option value="5000">5000</option>
                    <option value="10000">10000</option>
                </select>
            </label>
            <button class="button button-primary" type="submit"><?= $view->e($view->t('Save')) ?></button>
        </form>
    </section>
    <p class="save-status" data-admin-status role="status"></p>
</section>
