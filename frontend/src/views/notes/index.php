<div class="workspace" data-notes-workspace>
    <header class="workspace-header scene-header">
        <div class="workspace-heading">
            <div>
                <h1><?= $view->e($view->t('Notes')) ?></h1>
                <p><?= $view->e($view->t('A home for your ideas, research, and things worth keeping.')) ?></p>
            </div>
        </div>
        <div class="workspace-header-actions">
            <span class="save-status" data-global-status role="status"></span>
            <button class="button button-quiet mobile-tags-button" type="button" data-open-label-manager><?= $view->e($view->t('Manage tags')) ?></button>
            <details class="note-preferences" data-note-preferences>
                <summary class="button button-quiet">
                    <svg class="ui-icon" aria-hidden="true"><use href="#icon-settings"/></svg>
                    <span><?= $view->e($view->t('Preferences')) ?></span>
                </summary>
                <div class="note-preferences-panel">
                    <section class="preference-section">
                        <div>
                            <h2><?= $view->e($view->t('Note text size')) ?></h2>
                            <p class="subtle-copy"><?= $view->e($view->t('Applies to note content and previews.')) ?></p>
                        </div>
                        <div class="segmented-control" role="group" aria-label="<?= $view->e($view->t('Text size')) ?>">
                            <button class="segment-button" type="button" data-pref="note_font_size" data-value="14"><?= $view->e($view->t('Small')) ?></button>
                            <button class="segment-button" type="button" data-pref="note_font_size" data-value="16"><?= $view->e($view->t('Medium')) ?></button>
                            <button class="segment-button" type="button" data-pref="note_font_size" data-value="18"><?= $view->e($view->t('Large')) ?></button>
                        </div>
                    </section>
                    <section class="preference-section">
                        <div>
                            <h2><?= $view->e($view->t('New note color')) ?></h2>
                            <p class="subtle-copy"><?= $view->e($view->t('Applies only to notes created after this selection.')) ?></p>
                        </div>
                        <div class="preference-color-options" role="group" aria-label="<?= $view->e($view->t('Default note color')) ?>">
                            <button class="preference-color color-neutral" type="button" data-pref="default_note_color" data-value="neutral" aria-label="<?= $view->e($view->t('Default')) ?>"></button>
                            <button class="preference-color color-lemon" type="button" data-pref="default_note_color" data-value="lemon" aria-label="<?= $view->e($view->t('Light yellow')) ?>"></button>
                            <button class="preference-color color-mint" type="button" data-pref="default_note_color" data-value="mint" aria-label="<?= $view->e($view->t('Light green')) ?>"></button>
                            <button class="preference-color color-sky" type="button" data-pref="default_note_color" data-value="sky" aria-label="<?= $view->e($view->t('Light blue')) ?>"></button>
                            <button class="preference-color color-rose" type="button" data-pref="default_note_color" data-value="rose" aria-label="<?= $view->e($view->t('Light pink')) ?>"></button>
                        </div>
                    </section>
                    <p role="status" data-note-preference-status></p>
                </div>
            </details>
            <button class="button button-quiet" type="button" data-open-ask-ai>
                <svg class="ui-icon" aria-hidden="true"><use href="#icon-ai"/></svg>
                <span><?= $view->e($view->t('Ask AI')) ?></span>
            </button>
            <button class="button button-primary" type="button" data-new-note disabled>
                <svg class="ui-icon" aria-hidden="true"><use href="#icon-plus"/></svg>
                <span><?= $view->e($view->t('New note')) ?></span>
            </button>
        </div>
    </header>
    <div class="workspace-layout">
        <aside class="notes-filter-panel" aria-label="<?= $view->e($view->t('Note filters')) ?>">
            <button class="filter-all is-active" type="button" data-filter-all>
                <svg class="ui-icon filter-icon" aria-hidden="true"><use href="#icon-notes"/></svg>
                <span><?= $view->e($view->t('All notes')) ?></span>
                <span class="filter-count" data-note-total>0</span>
            </button>
            <button class="filter-all" type="button" data-filter-shared aria-pressed="false">
                <svg class="ui-icon filter-icon" aria-hidden="true"><use href="#icon-share"/></svg>
                <span><?= $view->e($view->t('Shared with me')) ?></span>
                <span class="filter-count" data-shared-total>0</span>
            </button>
            <div class="filter-divider"></div>
            <div class="filter-heading">
                <span><?= $view->e($view->t('Tags')) ?></span>
                <button class="text-button" type="button" data-open-label-manager><?= $view->e($view->t('Manage')) ?></button>
            </div>
            <div class="label-filter-list" data-label-filter-list>
                <p class="subtle-copy"><?= $view->e($view->t('Loading tags…')) ?></p>
            </div>
        </aside>
        <section class="notes-column" aria-labelledby="notes-heading">
            <div class="notes-toolbar">
                <div class="search-field">
                    <svg class="ui-icon" aria-hidden="true"><use href="#icon-search"/></svg>
                    <label class="sr-only" for="notes-search"><?= $view->e($view->t('Search notes')) ?></label>
                    <input id="notes-search" type="search" placeholder="<?= $view->e($view->t('Search titles and content…')) ?>" autocomplete="off" data-notes-search>
                    <button class="search-clear icon-button is-hidden" type="button" data-clear-search aria-label="<?= $view->e($view->t('Clear search')) ?>">×</button>
                </div>
                <button class="view-button" type="button" data-view-toggle aria-label="<?= $view->e($view->t('View')) ?>" title="<?= $view->e($view->t('View')) ?>">▦</button>
                <label class="note-sort">
                    <span class="sr-only"><?= $view->e($view->t('Sort by')) ?></span>
                    <select data-note-sort aria-label="<?= $view->e($view->t('Sort by')) ?>">
                        <option value="updated:desc"><?= $view->e($view->t('Date modified · newest')) ?></option>
                        <option value="updated:asc"><?= $view->e($view->t('Date modified · oldest')) ?></option>
                        <option value="title:asc"><?= $view->e($view->t('Title · A to Z')) ?></option>
                        <option value="title:desc"><?= $view->e($view->t('Title · Z to A')) ?></option>
                        <option value="created:desc"><?= $view->e($view->t('Date created · newest')) ?></option>
                        <option value="created:asc"><?= $view->e($view->t('Date created · oldest')) ?></option>
                    </select>
                </label>
            </div>
            <div class="offline-banner is-hidden" data-offline-banner role="status">
                <svg class="ui-icon" aria-hidden="true" viewBox="0 0 24 24"><path d="M2 8.8a15 15 0 0 1 4.2-2.7M22 8.8A15 15 0 0 0 10.6 5M5.5 12.4a10 10 0 0 1 3-1.8M18.5 12.4a10 10 0 0 0-3.1-1.9M8.9 15.9a5 5 0 0 1 6.2 0M12 19.5h.01M3 3l18 18" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round"/></svg>
                <span data-offline-message><?= $view->e($view->t('You are offline. Notes saved on this device are shown, and your changes will sync when you reconnect.')) ?></span>
            </div>
            <section class="shared-invitations is-hidden" data-share-invitations aria-label="<?= $view->e($view->t('Share invitations')) ?>"></section>
            <div class="active-filter-row is-hidden" data-active-filter-row>
                <span class="active-filter-copy" data-active-filter-copy></span>
                <button class="text-button" type="button" data-clear-filters><?= $view->e($view->t('Clear filters')) ?></button>
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
            <p class="eyebrow" data-editor-eyebrow><?= $view->e($view->t('New note')) ?></p>
            <h2 id="editor-heading" data-editor-heading><?= $view->e($view->t('Write down what matters')) ?></h2>
            <p class="sr-only" id="editor-description"><?= $view->e($view->t('Content is saved automatically after the server confirms it.')) ?></p>
        </div>
        <button class="icon-button" type="button" data-close-editor aria-label="<?= $view->e($view->t('Close editor')) ?>">×</button>
    </div>
    <div class="editor-status-row">
        <span class="save-status" data-editor-status role="status"></span>
        <span class="editor-meta" data-editor-meta></span>
        <button type="button" class="text-button is-hidden" data-retry-save><?= $view->e($view->t('Retry')) ?></button>
        <div class="presence-strip is-hidden" data-editor-presence aria-label="<?= $view->e($view->t('People editing this note')) ?>"></div>
    </div>
    <div class="is-hidden" data-session-recovery>
        <a href="/login" target="_blank" rel="noopener"><?= $view->e($view->t('Sign in in another window')) ?></a>
        <button type="button" class="button button-quiet" data-recheck-session><?= $view->e($view->t('Check again')) ?></button>
    </div>
    <form class="editor-form" data-editor-form>
        <div class="field editor-title-field">
            <label for="editor-title"><?= $view->e($view->t('Title')) ?></label>
            <input id="editor-title" class="editor-title-input" type="text" maxlength="200" placeholder="<?= $view->e($view->t('Title')) ?>" autocomplete="off" data-editor-title>
            <p class="field-error is-hidden" data-editor-title-error></p>
        </div>
        <div class="field editor-body-field">
            <label for="editor-content"><?= $view->e($view->t('Content')) ?></label>
            <textarea id="editor-content" class="editor-content-input" maxlength="50000" placeholder="<?= $view->e($view->t('Start writing…')) ?>" data-editor-content></textarea>
            <p class="field-error is-hidden" data-editor-content-error></p>
        </div>
        <section class="ai-summary is-hidden" data-ai-summary aria-label="<?= $view->e($view->t('AI summary')) ?>">
            <div class="ai-summary-head">
                <h3><svg class="ui-icon" aria-hidden="true"><use href="#icon-ai"/></svg> <?= $view->e($view->t('AI summary')) ?></h3>
                <span class="status-badge is-warning is-hidden" data-ai-summary-stale><?= $view->e($view->t('Out of date')) ?></span>
                <button class="button button-quiet button-small" type="button" data-ai-summary-run><?= $view->e($view->t('Summarize')) ?></button>
            </div>
            <div class="ai-summary-body" data-ai-summary-text aria-live="polite"></div>
            <p class="subtle-copy ai-summary-meta" data-ai-summary-meta></p>
        </section>
        <div class="editor-controls">
            <div class="editor-control-group">
                <span class="control-label"><?= $view->e($view->t('Note color')) ?></span>
                <div class="color-options" role="group" aria-label="<?= $view->e($view->t('Note color')) ?>" data-editor-colors>
                    <button type="button" class="color-swatch color-neutral is-selected" data-color="neutral" aria-label="<?= $view->e($view->t('Default')) ?>" aria-pressed="true"></button>
                    <button type="button" class="color-swatch color-lemon" data-color="lemon" aria-label="<?= $view->e($view->t('Light yellow')) ?>" aria-pressed="false"></button>
                    <button type="button" class="color-swatch color-mint" data-color="mint" aria-label="<?= $view->e($view->t('Light green')) ?>" aria-pressed="false"></button>
                    <button type="button" class="color-swatch color-sky" data-color="sky" aria-label="<?= $view->e($view->t('Light blue')) ?>" aria-pressed="false"></button>
                    <button type="button" class="color-swatch color-rose" data-color="rose" aria-label="<?= $view->e($view->t('Light pink')) ?>" aria-pressed="false"></button>
                    <label class="color-swatch color-custom" title="<?= $view->e($view->t('Any RGB color')) ?>">
                        <span class="sr-only"><?= $view->e($view->t('Any RGB color')) ?></span>
                        <input type="color" value="#fde68a" data-color-custom>
                    </label>
                </div>
                <label class="note-link-picker">
                    <span class="control-label"><?= $view->e($view->t('Linked to')) ?></span>
                    <select data-note-link>
                        <option value=""><?= $view->e($view->t('Not linked')) ?></option>
                    </select>
                </label>
                <label class="note-background-picker is-hidden" data-note-background-field>
                    <span class="control-label"><?= $view->e($view->t('Background image')) ?></span>
                    <select data-note-background>
                        <option value=""><?= $view->e($view->t('None')) ?></option>
                    </select>
                </label>
            </div>
            <div class="editor-actions">
                <button class="button button-quiet" type="button" data-editor-pin aria-pressed="false">
                    <svg class="ui-icon" aria-hidden="true" viewBox="0 0 24 24"><path d="M9 4h6l-1 6 3 3v2H7v-2l3-3-1-6Z M12 15v6"/></svg>
                    <span data-pin-label><?= $view->e($view->t('Pin')) ?></span>
                </button>
                <button class="button button-quiet" type="button" data-editor-labels>
                    <svg class="ui-icon" aria-hidden="true"><use href="#icon-tag"/></svg>
                    <?= $view->e($view->t('Tags')) ?>
                </button>
                <button class="button button-quiet is-hidden" type="button" data-editor-lock aria-haspopup="dialog">
                    <svg class="ui-icon" aria-hidden="true"><use href="#icon-lock"/></svg>
                    <span data-lock-label><?= $view->e($view->t('Password')) ?></span>
                </button>
                <button class="button button-quiet is-hidden" type="button" data-editor-share>
                    <svg class="ui-icon" aria-hidden="true"><use href="#icon-share"/></svg>
                    <?= $view->e($view->t('Share')) ?>
                </button>
                <button class="button button-danger-quiet is-hidden" type="button" data-editor-delete><?= $view->e($view->t('Delete')) ?></button>
                <button class="button button-primary" type="button" data-editor-save><?= $view->e($view->t('Save and close')) ?></button>
            </div>
        </div>
        <div class="editor-label-popover is-hidden" data-editor-label-popover>
            <div class="popover-heading">
                <strong><?= $view->e($view->t('Assign tags')) ?></strong>
                <span data-label-selection-count>0/20</span>
            </div>
            <div data-editor-label-list></div>
            <button class="text-button" type="button" data-open-label-manager><?= $view->e($view->t('Create or manage tags')) ?></button>
        </div>
        <div class="attachments-section is-hidden" data-attachments-section>
            <div class="section-heading">
                <span><?= $view->e($view->t('Attachments')) ?></span>
                <span class="subtle-copy" data-attachment-count></span>
            </div>
            <div class="attachment-list" data-attachment-list></div>
            <label class="button button-quiet attachment-picker">
                <span aria-hidden="true">＋</span>
                <?= $view->e($view->t('Add files')) ?>
                <input type="file" hidden multiple accept=".jpg,.jpeg,.png,.webp,.mp4,.webm,.pdf,.txt,.md,.csv,.zip,.docx,.xlsx,.pptx" data-attachment-input>
            </label>
        </div>
    </form>
</section>
<div class="modal-backdrop is-hidden" data-label-dialog-backdrop></div>
<section class="modal compact-modal is-hidden" data-label-dialog role="dialog" aria-modal="true" aria-labelledby="label-dialog-heading">
    <div class="modal-header">
        <div>
            <p class="eyebrow"><?= $view->e($view->t('Keep things organized')) ?></p>
            <h2 id="label-dialog-heading"><?= $view->e($view->t('Manage tags')) ?></h2>
        </div>
        <button class="icon-button" type="button" data-close-label-manager aria-label="<?= $view->e($view->t('Close tag manager')) ?>">×</button>
    </div>
    <form class="inline-add-form" data-label-create-form>
        <label class="sr-only" for="new-label-name"><?= $view->e($view->t('Tag name')) ?></label>
        <input id="new-label-name" type="text" maxlength="40" placeholder="<?= $view->e($view->t('Tag name')) ?>" data-label-create-input>
        <button class="button button-primary" type="submit"><?= $view->e($view->t('Add tag')) ?></button>
    </form>
    <p class="field-error is-hidden" data-label-create-error></p>
    <div class="managed-label-list" data-managed-label-list></div>
</section>
<div class="modal-backdrop is-hidden" data-conflict-dialog-backdrop></div>
<section class="modal conflict-modal is-hidden" data-conflict-dialog role="dialog" aria-modal="true" aria-labelledby="conflict-heading">
    <div class="modal-header">
        <div>
            <p class="eyebrow"><?= $view->e($view->t('Your decision is needed')) ?></p>
            <h2 id="conflict-heading"><?= $view->e($view->t('This note has changed')) ?></h2>
        </div>
        <button class="icon-button" type="button" data-close-conflict aria-label="<?= $view->e($view->t('Close conflict dialog')) ?>">×</button>
    </div>
    <p class="modal-intro"><?= $view->e($view->t('This note changed in another window. Choose which version to continue with.')) ?></p>
    <div class="conflict-compare">
        <article>
            <h3><?= $view->e($view->t('Server version')) ?></h3>
            <strong data-conflict-server-title></strong>
            <pre data-conflict-server-content></pre>
        </article>
        <article>
            <h3><?= $view->e($view->t('Your draft')) ?></h3>
            <strong data-conflict-local-title></strong>
            <pre data-conflict-local-content></pre>
        </article>
    </div>
    <p class="subtle-copy" data-conflict-note></p>
    <div class="modal-actions">
        <button class="button button-quiet" type="button" data-close-conflict><?= $view->e($view->t('Go back')) ?></button>
        <button class="button button-quiet" type="button" data-use-server><?= $view->e($view->t('Use server version')) ?></button>
        <button class="button button-primary" type="button" data-keep-local><?= $view->e($view->t('Keep my draft')) ?></button>
    </div>
</section>
<dialog class="workspace-dialog compact-dialog confirm-dialog" data-confirm-dialog aria-labelledby="confirm-heading" aria-describedby="confirm-message">
    <div class="modal-header">
        <div>
            <p class="eyebrow"><?= $view->e($view->t('Confirm')) ?></p>
            <h2 id="confirm-heading" data-confirm-title><?= $view->e($view->t('Are you sure?')) ?></h2>
        </div>
    </div>
    <p class="modal-intro" id="confirm-message" data-confirm-message></p>
    <div class="modal-actions">
        <button class="button button-quiet" type="button" data-confirm-cancel><?= $view->e($view->t('Cancel')) ?></button>
        <button class="button button-danger" type="button" data-confirm-accept><?= $view->e($view->t('Continue')) ?></button>
    </div>
</dialog>
<div class="modal-backdrop is-hidden" data-recovery-dialog-backdrop></div>
<section class="modal compact-modal is-hidden" data-recovery-dialog role="dialog" aria-modal="true" aria-labelledby="recovery-heading">
    <div class="modal-header">
        <div>
            <p class="eyebrow"><?= $view->e($view->t('Recovery')) ?></p>
            <h2 id="recovery-heading"><?= $view->e($view->t('Unsaved draft found')) ?></h2>
        </div>
    </div>
    <p class="modal-intro"><?= $view->e($view->t('This window contains an unsaved draft. What would you like to do with it?')) ?></p>
    <p class="recovery-preview" data-recovery-preview></p>
    <div class="modal-actions">
        <button class="button button-quiet" type="button" data-recovery-discard><?= $view->e($view->t('Discard draft')) ?></button>
        <button class="button button-primary" type="button" data-recovery-accept><?= $view->e($view->t('Recover draft')) ?></button>
    </div>
</section>
<dialog class="workspace-dialog share-dialog" data-share-dialog aria-labelledby="share-dialog-title">
    <header class="section-heading">
        <h2 id="share-dialog-title"><?= $view->e($view->t('Share note')) ?></h2>
        <button class="icon-button" type="button" data-share-close aria-label="<?= $view->e($view->t('Close')) ?>">×</button>
    </header>
    <p class="subtle-copy"><?= $view->e($view->t('People you invite see this note after they accept. You can change their permission or remove them at any time.')) ?></p>
    <form class="share-form" data-share-form novalidate>
        <label class="sr-only" for="share-email"><?= $view->e($view->t('Email addresses')) ?></label>
        <input id="share-email" name="emails" type="text" inputmode="email" autocomplete="off" required list="share-contacts" placeholder="<?= $view->e($view->t('Emails, separated by commas')) ?>" aria-describedby="share-email-hint share-error">
        <select name="permission" aria-label="<?= $view->e($view->t('Permission')) ?>">
            <option value="view"><?= $view->e($view->t('Can view')) ?></option>
            <option value="edit"><?= $view->e($view->t('Can view and edit')) ?></option>
        </select>
        <button class="button button-primary" type="submit"><?= $view->e($view->t('Invite')) ?></button>
    </form>
    <p class="subtle-copy share-hint" id="share-email-hint"><?= $view->e($view->t('Only people with a Planner account can be invited. They get a notification and an email.')) ?></p>
    <p class="field-error is-hidden" id="share-error" data-share-error role="alert"></p>
    <h3 class="share-list-heading"><?= $view->e($view->t('People with access')) ?></h3>
    <datalist id="share-contacts" data-share-contacts></datalist>
    <div class="share-list" data-share-list aria-live="polite"></div>
    <p class="save-status" data-share-status role="status"></p>
</dialog>
<dialog class="workspace-dialog shared-note-dialog" data-shared-note-dialog aria-labelledby="shared-note-heading">
    <header class="section-heading shared-note-header">
        <div>
            <p class="eyebrow" data-shared-note-owner></p>
            <h2 id="shared-note-heading" data-shared-note-heading><?= $view->e($view->t('Shared note')) ?></h2>
            <p class="subtle-copy shared-note-meta" data-shared-note-meta></p>
        </div>
        <button class="icon-button" type="button" data-shared-note-close aria-label="<?= $view->e($view->t('Close')) ?>">×</button>
    </header>
    <div class="editor-status-row">
        <span class="save-status" data-shared-note-status role="status"></span>
        <div class="presence-strip is-hidden" data-shared-presence aria-label="<?= $view->e($view->t('People editing this note')) ?>"></div>
    </div>
    <form class="stack-form shared-note-form" data-shared-note-form>
        <div class="field">
            <label for="shared-note-title"><?= $view->e($view->t('Title')) ?></label>
            <input id="shared-note-title" name="title" maxlength="200" autocomplete="off" required>
        </div>
        <div class="field editor-body-field">
            <label for="shared-note-content"><?= $view->e($view->t('Content')) ?></label>
            <textarea id="shared-note-content" name="content" maxlength="50000" required></textarea>
        </div>
    </form>
    <section class="ai-summary" data-shared-ai-summary aria-label="<?= $view->e($view->t('AI summary')) ?>">
        <div class="ai-summary-head">
            <h3><svg class="ui-icon" aria-hidden="true"><use href="#icon-ai"/></svg> <?= $view->e($view->t('AI summary')) ?></h3>
            <span class="status-badge is-warning is-hidden" data-ai-summary-stale><?= $view->e($view->t('Out of date')) ?></span>
            <button class="button button-quiet button-small" type="button" data-ai-summary-run><?= $view->e($view->t('Summarize')) ?></button>
        </div>
        <div class="ai-summary-body" data-ai-summary-text aria-live="polite"></div>
        <p class="subtle-copy ai-summary-meta" data-ai-summary-meta></p>
    </section>
    <div class="action-row shared-note-actions">
        <button class="button button-danger-quiet" type="button" data-shared-note-report><?= $view->e($view->t('Report')) ?></button>
        <button class="button button-quiet" type="button" data-shared-note-leave><?= $view->e($view->t('Leave shared note')) ?></button>
        <button class="button button-primary" type="button" data-shared-note-done><?= $view->e($view->t('Done')) ?></button>
    </div>
</dialog>
<dialog class="workspace-dialog compact-dialog" data-unlock-dialog aria-labelledby="unlock-heading">
    <form method="dialog" class="stack-form" data-unlock-form novalidate>
        <header class="section-heading">
            <div>
                <p class="eyebrow"><svg class="ui-icon" aria-hidden="true"><use href="#icon-lock"/></svg> <?= $view->e($view->t('Password protected')) ?></p>
                <h2 id="unlock-heading" data-unlock-title><?= $view->e($view->t('Enter this note\'s password')) ?></h2>
            </div>
            <button class="icon-button" type="button" data-unlock-cancel aria-label="<?= $view->e($view->t('Close')) ?>">×</button>
        </header>
        <p class="subtle-copy" data-unlock-copy><?= $view->e($view->t('This note is locked. Enter its password to view, edit or delete it.')) ?></p>
        <div class="field">
            <label for="unlock-password"><?= $view->e($view->t('Note password')) ?></label>
            <input id="unlock-password" name="password" type="password" autocomplete="off" required>
            <p class="field-error is-hidden" data-unlock-error role="alert"></p>
        </div>
        <div class="modal-actions">
            <button class="button button-quiet" type="button" data-unlock-cancel><?= $view->e($view->t('Cancel')) ?></button>
            <button class="button button-primary" type="submit" data-unlock-submit><?= $view->e($view->t('Unlock')) ?></button>
        </div>
    </form>
</dialog>
<dialog class="workspace-dialog compact-dialog" data-lock-dialog aria-labelledby="lock-heading">
    <form method="dialog" class="stack-form" data-lock-form novalidate>
        <header class="section-heading">
            <div>
                <p class="eyebrow"><svg class="ui-icon" aria-hidden="true"><use href="#icon-lock"/></svg> <?= $view->e($view->t('Note password')) ?></p>
                <h2 id="lock-heading" data-lock-heading><?= $view->e($view->t('Protect this note')) ?></h2>
            </div>
            <button class="icon-button" type="button" data-lock-close aria-label="<?= $view->e($view->t('Close')) ?>">×</button>
        </header>
        <p class="subtle-copy" data-lock-copy></p>
        <div class="segmented-control lock-mode" role="group" aria-label="<?= $view->e($view->t('Choose an action')) ?>" data-lock-modes>
            <button class="segment-button" type="button" data-lock-mode="change" aria-pressed="true"><?= $view->e($view->t('Change password')) ?></button>
            <button class="segment-button" type="button" data-lock-mode="disable" aria-pressed="false"><?= $view->e($view->t('Remove password')) ?></button>
        </div>
        <div class="field" data-lock-field="current">
            <label for="lock-current"><?= $view->e($view->t('Current password')) ?></label>
            <input id="lock-current" name="current_password" type="password" autocomplete="off">
            <p class="field-error is-hidden" data-lock-error="current_password" role="alert"></p>
        </div>
        <div class="field" data-lock-field="password">
            <label for="lock-password"><?= $view->e($view->t('New password')) ?></label>
            <input id="lock-password" name="password" type="password" autocomplete="new-password" minlength="4" aria-describedby="lock-password-hint">
            <p class="subtle-copy" id="lock-password-hint"><?= $view->e($view->t('At least 4 characters. This password is only for this note.')) ?></p>
            <p class="field-error is-hidden" data-lock-error="password" role="alert"></p>
        </div>
        <div class="field" data-lock-field="password_confirmation">
            <label for="lock-confirmation"><?= $view->e($view->t('Type the new password again')) ?></label>
            <input id="lock-confirmation" name="password_confirmation" type="password" autocomplete="new-password">
            <p class="field-error is-hidden" data-lock-error="password_confirmation" role="alert"></p>
        </div>
        <div class="modal-actions">
            <button class="button button-quiet" type="button" data-lock-close><?= $view->e($view->t('Cancel')) ?></button>
            <button class="button button-primary" type="submit" data-lock-submit><?= $view->e($view->t('Save')) ?></button>
        </div>
    </form>
</dialog>
<dialog class="workspace-dialog ask-dialog" data-ask-dialog aria-labelledby="ask-heading">
    <header class="section-heading">
        <div>
            <p class="eyebrow"><svg class="ui-icon" aria-hidden="true"><use href="#icon-ai"/></svg> <?= $view->e($view->t('AI questions')) ?></p>
            <h2 id="ask-heading"><?= $view->e($view->t('Ask about your notes')) ?></h2>
        </div>
        <button class="icon-button" type="button" data-ask-close aria-label="<?= $view->e($view->t('Close')) ?>">×</button>
    </header>
    <form class="ask-form" data-ask-form novalidate>
        <label class="sr-only" for="ask-question"><?= $view->e($view->t('Question')) ?></label>
        <textarea id="ask-question" name="question" rows="2" maxlength="500" required placeholder="<?= $view->e($view->t('For example: What did I decide about the trip?')) ?>"></textarea>
        <button class="button button-primary" type="submit" data-ask-submit><?= $view->e($view->t('Ask')) ?></button>
    </form>
    <div class="ask-suggestions" data-ask-suggestions>
        <button class="chip-button" type="button" data-ask-suggestion><?= $view->e($view->t('Summarize what I wrote this week')) ?></button>
        <button class="chip-button" type="button" data-ask-suggestion><?= $view->e($view->t('What tasks did I note down?')) ?></button>
        <button class="chip-button" type="button" data-ask-suggestion><?= $view->e($view->t('Which notes mention a deadline?')) ?></button>
    </div>
    <div class="ask-result" data-ask-result aria-live="polite"></div>
    <p class="subtle-copy ask-footnote"><?= $view->e($view->t('Answers come only from your unlocked notes and notes shared with you. Locked notes are never read.')) ?></p>
</dialog>
<dialog class="workspace-dialog compact-dialog" data-prompt-dialog aria-labelledby="prompt-heading">
    <form method="dialog" class="stack-form" data-prompt-form novalidate>
        <header class="section-heading">
            <h2 id="prompt-heading" data-prompt-title></h2>
            <button class="icon-button" type="button" data-prompt-cancel aria-label="<?= $view->e($view->t('Close')) ?>">×</button>
        </header>
        <div class="field">
            <label for="prompt-input" data-prompt-label></label>
            <textarea id="prompt-input" rows="1" data-prompt-input></textarea>
            <p class="field-error is-hidden" data-prompt-error role="alert"></p>
        </div>
        <div class="modal-actions">
            <button class="button button-quiet" type="button" data-prompt-cancel><?= $view->e($view->t('Cancel')) ?></button>
            <button class="button button-primary" type="submit" data-prompt-submit><?= $view->e($view->t('Save')) ?></button>
        </div>
    </form>
</dialog>
