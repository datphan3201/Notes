<section class="settings-page" data-user-report-settings aria-labelledby="settings-title">
    <header class="settings-header">
        <div>
            <p class="eyebrow"><?= $view->e($view->t('Account')) ?></p>
            <h1 id="settings-title"><?= $view->e($view->t('Report a user')) ?></h1>
            <p><?= $view->e($view->t('Tell an administrator about someone who broke the rules. Only administrators see your report and its images.')) ?></p>
        </div>
    </header>
    <div class="settings-panel">
        <form class="settings-form" data-user-report-form novalidate>
            <div class="field">
                <label for="report-email"><?= $view->e($view->t('Email of the person')) ?></label>
                <input id="report-email" name="email" type="email" maxlength="254" autocomplete="off" required>
            </div>
            <div class="field">
                <label for="report-reason"><?= $view->e($view->t('What happened?')) ?></label>
                <textarea id="report-reason" name="reason" rows="6" minlength="10" maxlength="2000" required></textarea>
                <p class="field-hint"><?= $view->e($view->t('10 to 2000 characters. Include where and when it happened.')) ?></p>
            </div>
            <div class="field">
                <label for="report-evidence"><?= $view->e($view->t('Evidence images (optional)')) ?></label>
                <input id="report-evidence" type="file" accept="image/jpeg,image/png,image/webp" multiple data-user-report-files>
                <p class="field-hint"><?= $view->e($view->t('Up to 3 JPEG, PNG or WebP images, 5 MB each. Location and other hidden data are removed.')) ?></p>
                <div class="report-evidence-previews" data-user-report-previews></div>
            </div>
            <div class="form-actions">
                <button class="button button-primary" type="submit"><?= $view->e($view->t('Send report')) ?></button>
                <span class="save-status" data-user-report-status role="status"></span>
            </div>
        </form>
    </div>
    <div class="settings-panel">
        <h2><?= $view->e($view->t('Your reports')) ?></h2>
        <div class="planning-list" data-user-report-list aria-live="polite"></div>
    </div>
</section>
