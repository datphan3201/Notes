<section class="settings-page" data-password-settings aria-labelledby="settings-title">
    <header class="settings-header">
        <div><p class="eyebrow">Account</p><h1 id="settings-title">Change password</h1><p>Changing your password signs out your other active sessions.</p></div>
        <a class="button button-quiet" href="/">← Back to notes</a>
    </header>
    <div class="settings-panel settings-panel-narrow">
        <form class="settings-form" data-password-form>
            <input type="hidden" id="password-username" autocomplete="username" value="<?= $view->e($user['email']) ?>">
            <div class="field"><label for="current-password">Current password</label><input id="current-password" name="current_password" type="password" autocomplete="current-password" required></div>
            <div class="field"><label for="new-password">New password</label><input id="new-password" name="password" type="password" autocomplete="new-password" required><p class="field-hint">At least 10 characters and at most 72 bytes.</p><p class="field-error is-hidden" data-password-error></p></div>
            <div class="field"><label for="new-password-confirmation">Confirm new password</label><input id="new-password-confirmation" name="password_confirmation" type="password" autocomplete="new-password" required></div>
            <div class="form-actions"><button class="button button-primary" type="submit">Change password</button><span class="save-status" data-password-status role="status"></span></div>
        </form>
    </div>
</section>
