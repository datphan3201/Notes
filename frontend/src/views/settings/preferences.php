<section class="settings-page" data-preference-settings aria-labelledby="settings-title">
    <header class="settings-header">
        <div>
            <p class="eyebrow"><?= $view->e($view->t('Account')) ?></p>
            <h1 id="settings-title"><?= $view->e($view->t('Appearance')) ?></h1>
            <p><?= $view->e($view->t('Choose a workspace that is comfortable to read and use.')) ?></p>
        </div>
        <a class="button button-quiet" href="/"><?= $view->e($view->t('← Back to notes')) ?></a>
    </header>
    <nav class="workspace-section-menu" role="tablist" aria-label="Appearance sections">
        <?php foreach (['themes'=>'Themes', 'decoration'=>'Scenery and quote'] as $key=>$label): ?>
        <button type="button" role="tab" id="appearance-tab-<?= $key ?>" aria-controls="appearance-panel-<?= $key ?>" aria-selected="<?= $key === 'themes' ? 'true' : 'false' ?>" tabindex="<?= $key === 'themes' ? '0' : '-1' ?>" data-workspace-tab="<?= $key ?>"><?= $view->e($view->t($label)) ?></button>
        <?php endforeach; ?>
    </nav>
    <section id="appearance-panel-themes" role="tabpanel" aria-labelledby="appearance-tab-themes" data-workspace-panel="themes" class="settings-panel preference-panel">
        <h2><?= $view->e($view->t('Choose your scenery')) ?></h2>
        <p class="subtle-copy"><?= $view->e($view->t('Five illustrated themes, made for your workspace.')) ?></p>
        <div class="theme-picker" data-theme-picker></div>
        <section class="preference-section">
            <div>
                <h2><?= $view->e($view->t('Theme')) ?></h2>
                <p class="subtle-copy"><?= $view->e($view->t('Change the workspace color scheme.')) ?></p>
            </div>
            <div class="segmented-control" role="group" aria-label="<?= $view->e($view->t('Theme')) ?>">
                <button class="segment-button" type="button" data-pref="theme" data-value="light"><?= $view->e($view->t('Light')) ?></button>
                <button class="segment-button" type="button" data-pref="theme" data-value="dark"><?= $view->e($view->t('Dark')) ?></button>
            </div>
        </section>
    </section>
    <section id="appearance-panel-decoration" role="tabpanel" aria-labelledby="appearance-tab-decoration" data-workspace-panel="decoration" class="settings-panel preference-panel" hidden>
        <div class="theme-preview-region">
            <img class="theme-preview" data-theme-preview width="800" height="320" alt="">
            <blockquote class="theme-quote" data-theme-quote></blockquote>
        </div>
        <div class="decoration-options">
            <?php foreach (['show_background'=>'Page background', 'show_illustrations'=>'Scenery in cards and roadmap', 'show_quote'=>'Quote card'] as $key=>$label): ?>
            <label class="check-row">
                <input type="checkbox" data-pref-toggle="<?= $key ?>">
                <span><?= $view->e($view->t($label)) ?></span>
            </label>
            <?php endforeach; ?>
        </div>
        <form class="stack-form" data-quote-form>
            <div class="field">
                <label for="custom-quote"><?= $view->e($view->t('Your quote (optional)')) ?></label>
                <textarea id="custom-quote" name="custom_quote" maxlength="500" rows="3" placeholder="Leave empty to use the theme’s quote"></textarea>
                <span class="field-hint"><?= $view->e($view->t('Up to 500 characters. Only you see this quote.')) ?></span>
            </div>
            <div class="action-row">
                <button class="button button-primary" type="submit"><?= $view->e($view->t('Save quote')) ?></button>
                <button class="button button-quiet" type="button" data-quote-reset><?= $view->e($view->t('Restore preset')) ?></button>
            </div>
        </form>
    </section>
    <section class="settings-panel">
        <label for="interface-locale"><?= $view->e($view->t('Language')) ?></label>
        <select id="interface-locale" data-interface-locale>
            <option value="en"<?= $preferences['locale'] === 'en' ? ' selected' : '' ?>><?= $view->e($view->t('English')) ?></option>
            <option value="vi"<?= $preferences['locale'] === 'vi' ? ' selected' : '' ?>>Tiếng Việt</option>
        </select>
    </section>
    <p class="save-status" data-preference-status role="status"></p>
    <section class="settings-panel">
        <h2><?= $view->e($view->t('Personal background')) ?></h2>
        <label class="button button-quiet"><?= $view->e($view->t('Upload background')) ?> <input type="file" accept="image/jpeg,image/png,image/webp" data-background-upload></label>
        <p class="subtle-copy"><?= $view->e($view->t('JPEG, PNG or WebP, up to 2 MB and 4096 × 4096 pixels. The image stays private to your account.')) ?></p>
        <form data-background-color-form class="settings-form">
            <label><?= $view->e($view->t('Background color')) ?> <input type="color" name="background_color" value="<?= $view->e($preferences['background_color'] ?: '#eaf4fb') ?>"></label>
            <div class="action-row"><button class="button button-primary" type="submit"><?= $view->e($view->t('Use color')) ?></button><button class="button button-quiet" type="button" data-reset-background><?= $view->e($view->t('Use theme image')) ?></button></div>
        </form>
    </section>

</section>
