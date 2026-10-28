<section class="settings-page" data-password-settings aria-labelledby="settings-title">
    <header class="settings-header">
        <div>
            <p class="eyebrow"><?= $view->e($view->t('Account')) ?></p>
            <h1 id="settings-title"><?= $view->e($view->t('Security')) ?></h1>
            <p><?= $view->e($view->t('Change your password and protect sign-in with two-step verification.')) ?></p>
        </div>
        <a class="button button-quiet" href="/"><?= $view->e($view->t('← Back to notes')) ?></a>
    </header>
    <div class="settings-panel settings-panel-narrow">
        <h2><?= $view->e($view->t('Change password')) ?></h2>
        <p class="subtle-copy"><?= $view->e($view->t('Changing your password signs out your other active sessions.')) ?></p>
        <form class="settings-form" data-password-form>
            <input type="hidden" id="password-username" autocomplete="username" value="<?= $view->e($user['email']) ?>">
            <div class="field">
                <label for="current-password"><?= $view->e($view->t('Current password')) ?></label>
                <input id="current-password" name="current_password" type="password" autocomplete="current-password" required>
            </div>
            <div class="field">
                <label for="new-password"><?= $view->e($view->t('New password')) ?></label>
                <input id="new-password" name="password" type="password" autocomplete="new-password" required>
                <p class="field-hint"><?= $view->e($view->t('At least 10 characters and at most 72 bytes.')) ?></p>
                <p class="field-error is-hidden" data-password-error></p>
            </div>
            <div class="field">
                <label for="new-password-confirmation"><?= $view->e($view->t('Confirm new password')) ?></label>
                <input id="new-password-confirmation" name="password_confirmation" type="password" autocomplete="new-password" required>
            </div>
            <div class="form-actions">
                <button class="button button-primary" type="submit"><?= $view->e($view->t('Change password')) ?></button>
                <span class="save-status" data-password-status role="status"></span>
            </div>
        </form>
    </div>
    <div class="settings-panel settings-panel-narrow" data-two-factor-settings data-method="<?= $view->e((string) ($user['two_factor_method'] ?? '')) ?>">
        <h2><?= $view->e($view->t('Two-step verification')) ?></h2>
        <p class="subtle-copy" data-two-factor-summary></p>
        <div class="action-row" data-two-factor-choices>
            <button class="button button-quiet" type="button" data-two-factor-start="email"><?= $view->e($view->t('Use email codes')) ?></button>
            <button class="button button-quiet" type="button" data-two-factor-start="totp"><?= $view->e($view->t('Use an authenticator app')) ?></button>
        </div>
        <form class="settings-form" data-two-factor-confirm hidden>
            <div data-totp-setup hidden>
                <p><?= $view->e($view->t('Add this key to Google Authenticator, Microsoft Authenticator or a similar app, then enter the code it shows.')) ?></p>
                <p><code class="secret-key" data-totp-secret></code></p>
                <p><a data-totp-link href="#"><?= $view->e($view->t('Open in authenticator app')) ?></a></p>
            </div>
            <p data-email-setup hidden><?= $view->e($view->t('We sent a six-digit code to your email address.')) ?></p>
            <div class="field">
                <label for="two-factor-code"><?= $view->e($view->t('Verification code')) ?></label>
                <input id="two-factor-code" name="code" inputmode="numeric" autocomplete="one-time-code" maxlength="7" required>
            </div>
            <div class="form-actions">
                <button class="button button-primary" type="submit"><?= $view->e($view->t('Turn on')) ?></button>
                <button class="button button-quiet" type="button" data-two-factor-cancel><?= $view->e($view->t('Cancel')) ?></button>
            </div>
        </form>
        <form class="settings-form" data-two-factor-disable hidden>
            <div class="field">
                <label for="two-factor-password"><?= $view->e($view->t('Current password')) ?></label>
                <input id="two-factor-password" name="password" type="password" autocomplete="current-password" required>
            </div>
            <button class="button button-quiet" type="submit"><?= $view->e($view->t('Turn off two-step verification')) ?></button>
        </form>
        <p class="save-status" data-two-factor-status role="status"></p>
    </div>
</section>
