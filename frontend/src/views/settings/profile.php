<section class="settings-page" data-profile-settings aria-labelledby="settings-title">
    <header class="settings-header">
        <div>
            <p class="eyebrow"><?= $view->e($view->t('Account')) ?></p>
            <h1 id="settings-title"><?= $view->e($view->t('Profile')) ?></h1>
            <p><?= $view->e($view->t('Information shown in your planning workspace.')) ?></p>
        </div>
        <a class="button button-quiet" href="/"><?= $view->e($view->t('← Back to notes')) ?></a>
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
                <input id="profile-email" type="email" value="<?= $view->e($user['email']) ?>" readonly>
                <p class="field-hint"><?= $view->e($view->t('Email cannot be changed in this release.')) ?></p>
            </div>
            <div class="field">
                <label for="profile-display-name"><?= $view->e($view->t('Display name')) ?></label>
                <input id="profile-display-name" name="display_name" type="text" value="<?= $view->e($user['display_name']) ?>" maxlength="80" required data-profile-name>
                <p class="field-error is-hidden" data-profile-error></p>
            </div>
            <div class="field">
                <label for="profile-biography"><?= $view->e($view->t('Biography')) ?></label>
                <textarea id="profile-biography" name="biography" rows="3" maxlength="2000" data-profile-biography><?= $view->e($user['biography']) ?></textarea>
            </div>
            <div class="form-actions">
                <button class="button button-primary" type="submit"><?= $view->e($view->t('Save changes')) ?></button>
                <span class="save-status" data-profile-status role="status"></span>
            </div>
        </form>
    </div>
</section>
