<div class="workspace" data-notes-workspace>
    <header class="workspace-header">
        <div class="workspace-heading">
            <div>
                <h1>Notes</h1>
                <p>A home for your ideas, research, and things worth keeping.</p>
            </div>
        </div>
        <div class="workspace-header-actions">
            <span class="save-status" data-global-status role="status"></span>
            <button class="button button-quiet mobile-tags-button" type="button" data-open-label-manager>Manage tags</button>
            <button class="button button-primary" type="button" data-new-note disabled>
                <span aria-hidden="true">＋</span><span>New note</span>
            </button>
        </div>
    </header>

    <div class="workspace-layout">
        <aside class="notes-filter-panel" aria-label="Note filters">
            <button class="filter-all is-active" type="button" data-filter-all>
                <span class="filter-icon" aria-hidden="true">▦</span>
                <span>All notes</span>
                <span class="filter-count" data-note-total>0</span>
            </button>
            <div class="filter-divider"></div>
            <div class="filter-heading">
                <span>Tags</span>
                <button class="text-button" type="button" data-open-label-manager>Manage</button>
            </div>
            <div class="label-filter-list" data-label-filter-list>
                <p class="subtle-copy">Loading tags…</p>
            </div>
            <button class="label-add-link" type="button" data-open-label-manager><span aria-hidden="true">＋</span> Add tag</button>
        </aside>

        <section class="notes-column" aria-labelledby="notes-heading">
            <div class="notes-toolbar">
                <div class="search-field">
                    <span aria-hidden="true">⌕</span>
                    <label class="sr-only" for="notes-search">Search notes</label>
                    <input id="notes-search" type="search" placeholder="Search titles and content…" autocomplete="off" data-notes-search>
                    <button class="search-clear icon-button is-hidden" type="button" data-clear-search aria-label="Clear search">×</button>
                </div>
                <div class="view-switch" role="group" aria-label="Note layout">
                    <button class="view-button is-active" type="button" data-view="grid" aria-label="Show grid view" aria-pressed="true">▦</button>
                    <button class="view-button" type="button" data-view="list" aria-label="Show list view" aria-pressed="false">☷</button>
                </div>
            </div>
            <div class="active-filter-row is-hidden" data-active-filter-row>
                <span class="active-filter-copy" data-active-filter-copy></span>
                <button class="text-button" type="button" data-clear-filters>Clear filters</button>
            </div>
            <div class="notes-feedback" data-notes-feedback role="status"></div>
            <div class="notes-grid" data-notes-grid aria-live="polite"></div>
            <div class="notes-list is-hidden" data-notes-list aria-live="polite"></div>
            <div class="pagination" data-pagination></div>
        </section>
    </div>
</div>

<div class="modal-backdrop is-hidden" data-editor-dialog-backdrop></div>
<section class="modal editor-modal is-hidden" data-editor-dialog role="dialog" aria-modal="true" aria-labelledby="editor-heading" aria-describedby="editor-description">
    <div class="modal-header">
        <div>
            <p class="eyebrow" data-editor-eyebrow>New note</p>
            <h2 id="editor-heading" data-editor-heading>Write down what matters</h2>
            <p class="sr-only" id="editor-description">Content is saved automatically after the server confirms it.</p>
        </div>
        <button class="icon-button" type="button" data-close-editor aria-label="Close editor">×</button>
    </div>
    <div class="editor-status-row">
        <span class="save-status" data-editor-status role="status"></span>
        <span class="editor-meta" data-editor-meta></span>
        <button type="button" class="text-button is-hidden" data-retry-save>Retry</button>
    </div>
    <div class="is-hidden" data-session-recovery>
        <a href="/login" target="_blank" rel="noopener">Sign in in another window</a>
        <button type="button" class="button button-quiet" data-recheck-session>Check again</button>
    </div>
    <form class="editor-form" data-editor-form>
        <div class="field editor-title-field">
            <label for="editor-title">Title</label>
            <input id="editor-title" class="editor-title-input" type="text" maxlength="200" placeholder="Title" autocomplete="off" data-editor-title>
            <p class="field-error is-hidden" data-editor-title-error></p>
        </div>
        <div class="field editor-body-field">
            <label for="editor-content">Content</label>
            <textarea id="editor-content" class="editor-content-input" maxlength="50000" placeholder="Start writing…" data-editor-content></textarea>
            <p class="field-error is-hidden" data-editor-content-error></p>
        </div>
        <div class="editor-controls">
            <div class="editor-control-group">
                <span class="control-label">Note color</span>
                <div class="color-options" role="group" aria-label="Note color" data-editor-colors>
                    <button type="button" class="color-swatch color-neutral is-selected" data-color="neutral" aria-label="Default" aria-pressed="true"></button>
                    <button type="button" class="color-swatch color-lemon" data-color="lemon" aria-label="Light yellow" aria-pressed="false"></button>
                    <button type="button" class="color-swatch color-mint" data-color="mint" aria-label="Light green" aria-pressed="false"></button>
                    <button type="button" class="color-swatch color-sky" data-color="sky" aria-label="Light blue" aria-pressed="false"></button>
                    <button type="button" class="color-swatch color-rose" data-color="rose" aria-label="Light pink" aria-pressed="false"></button>
                </div>
            </div>
            <div class="editor-actions">
                <button class="button button-quiet" type="button" data-editor-pin aria-pressed="false"><span aria-hidden="true">♢</span> <span data-pin-label>Pin</span></button>
                <button class="button button-quiet" type="button" data-editor-labels><span aria-hidden="true">⌑</span> Tags</button>
                <button class="button button-danger-quiet is-hidden" type="button" data-editor-delete>Delete</button>
            </div>
        </div>
        <div class="editor-label-popover is-hidden" data-editor-label-popover>
            <div class="popover-heading"><strong>Assign tags</strong><span data-label-selection-count>0/20</span></div>
            <div data-editor-label-list></div>
            <button class="text-button" type="button" data-open-label-manager>Create or manage tags</button>
        </div>
        <div class="attachments-section is-hidden" data-attachments-section>
            <div class="section-heading"><span>Attachments</span><span class="subtle-copy" data-attachment-count></span></div>
            <div class="attachment-list" data-attachment-list></div>
            <label class="button button-quiet attachment-picker">
                <span aria-hidden="true">＋</span> Add files
                <input type="file" hidden multiple accept=".jpg,.jpeg,.png,.webp,.mp4,.webm,.pdf,.txt,.md,.csv,.zip,.docx,.xlsx,.pptx" data-attachment-input>
            </label>
        </div>
    </form>
</section>

<div class="modal-backdrop is-hidden" data-label-dialog-backdrop></div>
<section class="modal compact-modal is-hidden" data-label-dialog role="dialog" aria-modal="true" aria-labelledby="label-dialog-heading">
    <div class="modal-header">
        <div><p class="eyebrow">Keep things organized</p><h2 id="label-dialog-heading">Manage tags</h2></div>
        <button class="icon-button" type="button" data-close-label-manager aria-label="Close tag manager">×</button>
    </div>
    <form class="inline-add-form" data-label-create-form>
        <label class="sr-only" for="new-label-name">Tag name</label>
        <input id="new-label-name" type="text" maxlength="40" placeholder="Tag name" data-label-create-input>
        <button class="button button-primary" type="submit">Add tag</button>
    </form>
    <p class="field-error is-hidden" data-label-create-error></p>
    <div class="managed-label-list" data-managed-label-list></div>
</section>

<div class="modal-backdrop is-hidden" data-conflict-dialog-backdrop></div>
<section class="modal conflict-modal is-hidden" data-conflict-dialog role="dialog" aria-modal="true" aria-labelledby="conflict-heading">
    <div class="modal-header">
        <div><p class="eyebrow">Your decision is needed</p><h2 id="conflict-heading">This note has changed</h2></div>
        <button class="icon-button" type="button" data-close-conflict aria-label="Close conflict dialog">×</button>
    </div>
    <p class="modal-intro">This note changed in another window. Choose which version to continue with.</p>
    <div class="conflict-compare">
        <article><h3>Server version</h3><strong data-conflict-server-title></strong><pre data-conflict-server-content></pre></article>
        <article><h3>Your draft</h3><strong data-conflict-local-title></strong><pre data-conflict-local-content></pre></article>
    </div>
    <p class="subtle-copy" data-conflict-note></p>
    <div class="modal-actions">
        <button class="button button-quiet" type="button" data-close-conflict>Go back</button>
        <button class="button button-quiet" type="button" data-use-server>Use server version</button>
        <button class="button button-primary" type="button" data-keep-local>Keep my draft</button>
    </div>
</section>

<div class="modal-backdrop is-hidden" data-confirm-dialog-backdrop></div>
<section class="modal compact-modal confirm-modal is-hidden" data-confirm-dialog role="dialog" aria-modal="true" aria-labelledby="confirm-heading">
    <div class="modal-header"><div><p class="eyebrow">Confirm</p><h2 id="confirm-heading" data-confirm-title>Are you sure?</h2></div></div>
    <p class="modal-intro" data-confirm-message></p>
    <div class="modal-actions">
        <button class="button button-quiet" type="button" data-confirm-cancel>Cancel</button>
        <button class="button button-danger" type="button" data-confirm-accept>Continue</button>
    </div>
</section>

<div class="modal-backdrop is-hidden" data-recovery-dialog-backdrop></div>
<section class="modal compact-modal is-hidden" data-recovery-dialog role="dialog" aria-modal="true" aria-labelledby="recovery-heading">
    <div class="modal-header"><div><p class="eyebrow">Recovery</p><h2 id="recovery-heading">Unsaved draft found</h2></div></div>
    <p class="modal-intro">This window contains an unsaved draft. What would you like to do with it?</p>
    <p class="recovery-preview" data-recovery-preview></p>
    <div class="modal-actions">
        <button class="button button-quiet" type="button" data-recovery-discard>Discard draft</button>
        <button class="button button-primary" type="button" data-recovery-accept>Recover draft</button>
    </div>
</section>
