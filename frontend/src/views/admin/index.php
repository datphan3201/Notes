<section class="planning-page" data-admin-page aria-labelledby="admin-title">
    <header class="workspace-header scene-header">
        <div>
            <h1 id="admin-title"><?= $view->e($view->t('Administration')) ?></h1>
            <p><?= $view->e($view->t('Review reports, act on them, decide who can register and see every administrator action.')) ?></p>
        </div>
    </header>
    <p class="save-status" data-admin-status role="status"></p>
    <section class="planning-panel" aria-labelledby="admin-reports-title">
        <header class="section-heading">
            <h2 id="admin-reports-title"><?= $view->e($view->t('Reported notes')) ?></h2>
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
    <section class="planning-panel" aria-labelledby="admin-user-reports-title">
        <header class="section-heading">
            <h2 id="admin-user-reports-title"><?= $view->e($view->t('User reports')) ?></h2>
            <label><span class="sr-only"><?= $view->e($view->t('Status')) ?></span>
                <select data-admin-user-report-status>
                    <option value="open"><?= $view->e($view->t('Open')) ?></option>
                    <option value="resolved"><?= $view->e($view->t('Resolved')) ?></option>
                    <option value="dismissed"><?= $view->e($view->t('Dismissed')) ?></option>
                    <option value="all"><?= $view->e($view->t('All')) ?></option>
                </select>
            </label>
        </header>
        <div class="planning-list" data-admin-user-reports aria-live="polite"></div>
    </section>
    <section class="planning-panel" aria-labelledby="admin-users-title">
        <header class="section-heading">
            <h2 id="admin-users-title"><?= $view->e($view->t('Accounts')) ?></h2>
        </header>
        <p class="subtle-copy"><?= $view->e($view->t('Locking signs the person out everywhere and hides the notes they shared until you unlock them. Administrators are managed with the server console.')) ?></p>
        <input type="search" placeholder="<?= $view->e($view->t('Search email or name')) ?>" data-admin-user-search aria-label="<?= $view->e($view->t('Search accounts')) ?>">
        <div class="planning-list" data-admin-users aria-live="polite"></div>
    </section>
    <section class="planning-panel" aria-labelledby="admin-registration-title">
        <h2 id="admin-registration-title"><?= $view->e($view->t('Registration')) ?></h2>
        <form class="settings-form admin-settings-form" data-admin-registration>
            <label><?= $view->e($view->t('Who can create an account')) ?>
                <select name="registration_mode">
                    <option value="open"><?= $view->e($view->t('Anyone with the link')) ?></option>
                    <option value="invite"><?= $view->e($view->t('Only invited emails')) ?></option>
                    <option value="closed"><?= $view->e($view->t('Nobody (closed)')) ?></option>
                </select>
            </label>
            <button class="button button-primary" type="submit"><?= $view->e($view->t('Save')) ?></button>
        </form>
        <h3><?= $view->e($view->t('Invited emails')) ?></h3>
        <p class="subtle-copy"><?= $view->e($view->t('Used while registration is by invitation. Each invitation creates one account.')) ?></p>
        <form class="inline-form" data-admin-invite-form>
            <label class="sr-only" for="admin-invite-email"><?= $view->e($view->t('Email to invite')) ?></label>
            <input id="admin-invite-email" name="email" type="email" maxlength="254" placeholder="<?= $view->e($view->t('name@example.com')) ?>" required>
            <button class="button button-quiet" type="submit">
                <svg class="ui-icon" aria-hidden="true"><use href="#icon-plus"/></svg>
                <?= $view->e($view->t('Invite')) ?>
            </button>
        </form>
        <div class="planning-list" data-admin-invites aria-live="polite"></div>
    </section>
    <section class="planning-panel" aria-labelledby="admin-settings-title">
        <h2 id="admin-settings-title"><?= $view->e($view->t('System settings')) ?></h2>
        <form class="settings-form admin-settings-form" data-admin-settings>
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
    <section class="planning-panel" aria-labelledby="admin-activity-title">
        <header class="section-heading">
            <h2 id="admin-activity-title"><?= $view->e($view->t('Administrator activity')) ?></h2>
        </header>
        <ol class="admin-activity" data-admin-activity aria-live="polite"></ol>
    </section>
</section>
