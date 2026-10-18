<section class="settings-page" data-notification-settings aria-labelledby="settings-title">
    <header class="settings-header"><h1 id="settings-title"><?= $view->e($view->t('Notifications')) ?></h1></header>
    <div class="settings-panel">
        <p><?= $view->e($view->t('Choose how you receive scheduled Task reminders. Email delivery requires server mail configuration and the reminders scheduler.')) ?></p>
        <label><input type="checkbox" data-notification-pref="notifications_enabled"> <?= $view->e($view->t('Enable notifications')) ?></label>
        <label><input type="checkbox" data-notification-pref="email_notifications"> <?= $view->e($view->t('Allow email reminders')) ?></label>
        <p role="status" data-notification-status></p>
    </div>
</section>
