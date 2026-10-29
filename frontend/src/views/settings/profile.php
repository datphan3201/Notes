<section class="settings-page" data-profile-settings aria-labelledby="settings-title">
    <header class="settings-header">
        <div>
            <p class="eyebrow"><?= $view->e($view->t('Account')) ?></p>
            <h1 id="settings-title"><?= $view->e($view->t('Profile')) ?></h1>
            <p><?= $view->e($view->t('Information shown in your planning workspace.')) ?></p>
        </div>
        <a class="button button-quiet" href="/dashboard"><?= $view->e($view->t('← Back to Dashboard')) ?></a>
    </header>
    <div class="settings-panel">
        <div class="profile-avatar-row">
            <span class="avatar avatar-large" data-profile-avatar><?= $view->e($view->initial($user['display_name'])) ?></span>
            <div>
                <strong><?= $view->e($view->t('Profile picture')) ?></strong>
                <p class="subtle-copy"><?= $view->e($view->t('JPEG, PNG, or WebP, up to 2 MB.')) ?></p>
                <div class="inline-actions">
                    <label class="button button-quiet">
                        <?= $view->e($view->t('Choose image')) ?>
                        <input type="file" hidden accept=".jpg,.jpeg,.png,.webp" data-avatar-input>
                    </label>
                    <button class="text-button" type="button" data-avatar-remove><?= $view->e($view->t('Remove image')) ?></button>
                </div>
            </div>
        </div>
        <form class="settings-form" data-profile-form>
            <div class="field">
                <label for="profile-email"><?= $view->e($view->t('Email')) ?></label>
                <input id="profile-email" type="email" value="<?= $view->e($user['email']) ?>" readonly data-profile-email>
                <p class="field-hint" data-email-state role="status"></p>
                <button class="text-button" type="button" data-email-verify hidden><?= $view->e($view->t('Send verification email')) ?></button>
            </div>
            <div class="field">
                <label for="profile-display-name"><?= $view->e($view->t('Display name')) ?></label>
                <input id="profile-display-name" name="display_name" type="text" value="<?= $view->e($user['display_name']) ?>" maxlength="80" required data-profile-name>
                <p class="field-error is-hidden" data-profile-error></p>
            </div>
            <div class="field">
                <label for="profile-biography"><?= $view->e($view->t('Biography')) ?></label>
                <textarea id="profile-biography" name="biography" rows="3" maxlength="2000" data-profile-biography><?= $view->e($user['biography']) ?></textarea>
                <p class="field-hint"><?= $view->e($view->t('Shown to members of your Teamwork goals.')) ?></p>
            </div>
            <div class="form-actions">
                <button class="button button-primary" type="submit"><?= $view->e($view->t('Save changes')) ?></button>
                <span class="save-status" data-profile-status role="status"></span>
            </div>
        </form>
        <details class="capture-details email-change">
            <summary><?= $view->e($view->t('Change email')) ?></summary>
            <form class="settings-form" data-email-change-form>
                <p class="subtle-copy"><?= $view->e($view->t('We send a confirmation link to the new address. Your current email keeps working until you open it.')) ?></p>
                <div class="field">
                    <label for="email-change-new"><?= $view->e($view->t('New email')) ?></label>
                    <input id="email-change-new" name="email" type="email" autocomplete="email" maxlength="254" required>
                </div>
                <div class="field">
                    <label for="email-change-password"><?= $view->e($view->t('Current password')) ?></label>
                    <input id="email-change-password" name="current_password" type="password" autocomplete="current-password" required>
                </div>
                <div class="form-actions">
                    <button class="button button-primary" type="submit"><?= $view->e($view->t('Send confirmation link')) ?></button>
                    <span class="save-status" data-email-change-status role="status"></span>
                </div>
            </form>
        </details>
    </div>
</section>
