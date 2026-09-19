<section class="settings-page" data-profile-settings aria-labelledby="settings-title">
    <header class="settings-header">
        <div><p class="eyebrow">Account</p><h1 id="settings-title">Profile</h1><p>Information shown in your planning workspace.</p></div>
        <a class="button button-quiet" href="/">← Back to notes</a>
    </header>
    <div class="settings-panel">
        <div class="profile-avatar-row">
            <span class="avatar avatar-large" data-profile-avatar><?= $view->e($view->initial($user['display_name'])) ?></span>
            <div><strong>Profile picture</strong><p class="subtle-copy">JPEG, PNG, or WebP, up to 2 MB.</p>
                <div class="inline-actions">
                    <label class="button button-quiet">Choose image<input type="file" hidden accept=".jpg,.jpeg,.png,.webp" data-avatar-input></label>
                    <button class="text-button" type="button" data-avatar-remove>Remove image</button>
                </div>
            </div>
        </div>
        <form class="settings-form" data-profile-form>
            <div class="field"><label for="profile-email">Email</label><input id="profile-email" type="email" value="<?= $view->e($user['email']) ?>" readonly><p class="field-hint">Email cannot be changed in this release.</p></div>
            <div class="field"><label for="profile-display-name">Display name</label><input id="profile-display-name" name="display_name" type="text" value="<?= $view->e($user['display_name']) ?>" maxlength="80" required data-profile-name><p class="field-error is-hidden" data-profile-error></p></div>
            <div class="form-actions"><button class="button button-primary" type="submit">Save changes</button><span class="save-status" data-profile-status role="status"></span></div>
        </form>
    </div>
</section>
