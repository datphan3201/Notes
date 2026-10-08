<section class="settings-page" data-preference-settings aria-labelledby="settings-title">
    <header class="settings-header">
        <div><p class="eyebrow">Account</p><h1 id="settings-title">Appearance</h1><p>Choose a workspace that is comfortable to read and use.</p></div>
        <a class="button button-quiet" href="/">← Back to notes</a>
    </header>
    <nav class="workspace-section-menu" role="tablist" aria-label="Appearance sections">
        <?php foreach (['themes'=>'Themes', 'decoration'=>'Scenery and quote', 'notes'=>'Note preferences'] as $key=>$label): ?>
        <button type="button" role="tab" id="appearance-tab-<?= $key ?>" aria-controls="appearance-panel-<?= $key ?>" aria-selected="<?= $key === 'themes' ? 'true' : 'false' ?>" tabindex="<?= $key === 'themes' ? '0' : '-1' ?>" data-workspace-tab="<?= $key ?>"><?= $label ?></button>
        <?php endforeach; ?>
    </nav>
    <section id="appearance-panel-themes" role="tabpanel" aria-labelledby="appearance-tab-themes" data-workspace-panel="themes" class="settings-panel preference-panel">
        <h2>Choose your scenery</h2><p class="subtle-copy">Five illustrated themes, made for your workspace.</p>
        <div class="theme-picker" data-theme-picker></div>
        <section class="preference-section"><div><h2>Theme</h2><p class="subtle-copy">Change the workspace color scheme.</p></div>
            <div class="segmented-control" role="group" aria-label="Theme"><button class="segment-button" type="button" data-pref="theme" data-value="light">Light</button><button class="segment-button" type="button" data-pref="theme" data-value="dark">Dark</button></div>
        </section>
    </section>
    <section id="appearance-panel-decoration" role="tabpanel" aria-labelledby="appearance-tab-decoration" data-workspace-panel="decoration" class="settings-panel preference-panel" hidden>
        <div class="theme-preview-region"><img class="theme-preview" data-theme-preview width="800" height="320" alt=""><blockquote class="theme-quote" data-theme-quote></blockquote></div>
        <div class="decoration-options">
            <?php foreach (['show_background'=>'Page background', 'show_illustrations'=>'Scenery in cards and roadmap', 'show_quote'=>'Quote card'] as $key=>$label): ?>
                <label class="check-row"><input type="checkbox" data-pref-toggle="<?= $key ?>"><span><?= $label ?></span></label>
            <?php endforeach; ?>
        </div>
        <form class="stack-form" data-quote-form>
            <div class="field"><label for="custom-quote">Your quote (optional)</label><textarea id="custom-quote" name="custom_quote" maxlength="500" rows="3" placeholder="Leave empty to use the theme’s quote"></textarea><span class="field-hint">Up to 500 characters. Only you see this quote.</span></div>
            <div class="action-row"><button class="button button-primary" type="submit">Save quote</button><button class="button button-quiet" type="button" data-quote-reset>Restore preset</button></div>
        </form>
    </section>
    <section id="appearance-panel-notes" role="tabpanel" aria-labelledby="appearance-tab-notes" data-workspace-panel="notes" class="settings-panel preference-panel" hidden>
        <section class="preference-section"><div><h2>Note text size</h2><p class="subtle-copy">Applies to note content and previews.</p></div>
            <div class="segmented-control" role="group" aria-label="Text size"><button class="segment-button" type="button" data-pref="note_font_size" data-value="14">Small</button><button class="segment-button" type="button" data-pref="note_font_size" data-value="16">Medium</button><button class="segment-button" type="button" data-pref="note_font_size" data-value="18">Large</button></div>
        </section>
        <section class="preference-section"><div><h2>New note color</h2><p class="subtle-copy">Applies only to notes created after this selection.</p></div>
            <div class="preference-color-options" role="group" aria-label="Default note color"><button class="preference-color color-neutral" type="button" data-pref="default_note_color" data-value="neutral" aria-label="Default"></button><button class="preference-color color-lemon" type="button" data-pref="default_note_color" data-value="lemon" aria-label="Light yellow"></button><button class="preference-color color-mint" type="button" data-pref="default_note_color" data-value="mint" aria-label="Light green"></button><button class="preference-color color-sky" type="button" data-pref="default_note_color" data-value="sky" aria-label="Light blue"></button><button class="preference-color color-rose" type="button" data-pref="default_note_color" data-value="rose" aria-label="Light pink"></button></div>
        </section>
        <section class="preference-section"><div><h2>Note layout</h2><p class="subtle-copy">Choose how to view your note library.</p></div>
            <div class="segmented-control" role="group" aria-label="Note layout"><button class="segment-button" type="button" data-pref="notes_view" data-value="grid">Grid</button><button class="segment-button" type="button" data-pref="notes_view" data-value="list">List</button></div>
        </section>
    </section>
    <p class="save-status" data-preference-status role="status"></p>
</section>
