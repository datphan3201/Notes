<section class="planning-page" data-reviews-page aria-labelledby="reviews-title">
    <header class="workspace-header scene-header">
        <div>
            <h1 id="reviews-title"><?= $view->e($view->t('Reviews')) ?></h1>
            <p><?= $view->e($view->t('Look back. Learn. Move forward.')) ?></p>
        </div>
        <button class="button button-primary" type="button" data-open-dialog="new-review-dialog" data-review-new><?= $view->e($view->t('New review')) ?></button>
    </header>
    <p class="field-error is-hidden" data-planning-error role="alert"></p>
    <section class="planning-panel" data-review-collection>
        <div class="section-heading">
            <h2><?= $view->e($view->t('Your reviews')) ?></h2>
            <div class="field">
                <label for="review-filter"><?= $view->e($view->t('Period')) ?></label>
                <select id="review-filter" data-review-filter>
                    <option value="all"><?= $view->e($view->t('All periods')) ?></option>
                    <option value="Daily"><?= $view->e($view->t('Daily')) ?></option>
                    <option value="Weekly"><?= $view->e($view->t('Weekly')) ?></option>
                    <option value="Monthly"><?= $view->e($view->t('Monthly')) ?></option>
                </select>
            </div>
        </div>
        <div data-review-list aria-live="polite"></div>
        <div class="collection-pagination" data-review-pagination aria-label="Review pages"></div>
    </section>
    <section class="planning-panel" data-review-editor hidden>
        <button class="button button-quiet" type="button" data-review-back><?= $view->e($view->t('← Back to reviews')) ?></button>
        <div class="section-heading review-editor-heading">
            <h2 data-review-heading tabindex="-1"></h2>
            <div class="action-row">
                <button class="button button-quiet" type="button" data-review-refresh><?= $view->e($view->t('Refresh facts')) ?></button>
                <button class="button button-primary" type="button" data-review-finalize><?= $view->e($view->t('Finalize')) ?></button>
                <button class="button button-quiet is-hidden" type="button" data-review-reopen><?= $view->e($view->t('Reopen')) ?></button>
            </div>
        </div>
        <div class="review-period-navigation">
            <button class="icon-button" type="button" data-review-previous aria-label="Previous review">‹</button>
            <span data-review-period></span>
            <button class="icon-button" type="button" data-review-next aria-label="Next review">›</button>
        </div>
        <div class="review-metrics">
            <article class="insight-card">
                <h2><?= $view->e($view->t('Actions')) ?></h2>
                <strong data-review-actions>—</strong>
                <p class="subtle-copy" data-review-change></p>
            </article>
            <article class="insight-card">
                <h2><?= $view->e($view->t('Completion')) ?></h2>
                <div data-review-ring></div>
                <small class="subtle-copy" data-review-task-denominator></small>
            </article>
            <article class="insight-card" data-reference-decoration="trophy">
                <h2><?= $view->e($view->t('Wins')) ?></h2>
                <strong data-review-wins>—</strong>
                <p class="subtle-copy"><?= $view->e($view->t('Tasks and milestones completed')) ?></p>
            </article>
            <article class="insight-card">
                <h2><?= $view->e($view->t('Daily activity')) ?></h2>
                <div class="day-bars" data-review-bars></div>
            </article>
        </div>
        <details class="review-facts">
            <summary data-review-facts><?= $view->e($view->t('Facts for this period')) ?></summary>
            <div data-review-fact-details></div>
        </details>
        <aside class="draft-conflict is-hidden" data-review-conflict role="alert">
            <p><?= $view->e($view->t('This review changed elsewhere. Your draft is preserved. Choose which version to continue with.')) ?></p>
            <div class="action-row">
                <button class="button button-quiet" type="button" data-review-use-saved><?= $view->e($view->t('Use saved version')) ?></button>
                <button class="button button-primary" type="button" data-review-keep-draft><?= $view->e($view->t('Keep my draft')) ?></button>
            </div>
        </aside>
        <form class="stack-form" data-review-edit-form>
            <nav class="workspace-section-menu" role="tablist" aria-label="Reflection sections">
                <button type="button" role="tab" id="reflection-tab-reflection" aria-controls="reflection-panel-reflection" aria-selected="true" tabindex="0" data-workspace-tab="reflection"><?= $view->e($view->t('Reflection')) ?></button>
                <button type="button" role="tab" id="reflection-tab-went_well" aria-controls="reflection-panel-went_well" aria-selected="false" tabindex="-1" data-workspace-tab="went_well"><?= $view->e($view->t('What went well')) ?></button>
                <button type="button" role="tab" id="reflection-tab-went_wrong" aria-controls="reflection-panel-went_wrong" aria-selected="false" tabindex="-1" data-workspace-tab="went_wrong"><?= $view->e($view->t('What went wrong')) ?></button>
                <button type="button" role="tab" id="reflection-tab-change_next" aria-controls="reflection-panel-change_next" aria-selected="false" tabindex="-1" data-workspace-tab="change_next"><?= $view->e($view->t('What to change next')) ?></button>
            </nav>
            <section id="reflection-panel-reflection" class="" role="tabpanel" aria-labelledby="reflection-tab-reflection" data-workspace-panel="reflection">
                <div class="field">
                    <label for="review-reflection"><?= $view->e($view->t('Reflection')) ?></label>
                    <textarea id="review-reflection" name="reflection" maxlength="20000" rows="7"></textarea>
                </div>
            </section>
            <section id="reflection-panel-went_well" class="" role="tabpanel" aria-labelledby="reflection-tab-went_well" data-workspace-panel="went_well" hidden>
                <div class="field">
                    <label for="review-went_well"><?= $view->e($view->t('What went well')) ?></label>
                    <textarea id="review-went_well" name="went_well" maxlength="20000" rows="7"></textarea>
                </div>
            </section>
            <section id="reflection-panel-went_wrong" class="" role="tabpanel" aria-labelledby="reflection-tab-went_wrong" data-workspace-panel="went_wrong" hidden>
                <div class="field">
                    <label for="review-went_wrong"><?= $view->e($view->t('What went wrong')) ?></label>
                    <textarea id="review-went_wrong" name="went_wrong" maxlength="20000" rows="7"></textarea>
                </div>
            </section>
            <section id="reflection-panel-change_next" class="" role="tabpanel" aria-labelledby="reflection-tab-change_next" data-workspace-panel="change_next" hidden>
                <div class="field">
                    <label for="review-change_next"><?= $view->e($view->t('What to change next')) ?></label>
                    <textarea id="review-change_next" name="change_next" maxlength="20000" rows="7"></textarea>
                </div>
            </section>
            <div class="action-row">
                <button class="button button-primary" type="submit"><?= $view->e($view->t('Save reflections')) ?></button>
                <span data-review-state aria-live="polite"></span>
            </div>
        </form>
    </section>
    <dialog id="new-review-dialog" class="workspace-dialog" aria-labelledby="new-review-dialog-title" data-workspace-dialog>
        <header class="section-heading">
            <h2 id="new-review-dialog-title"><?= $view->e($view->t('New review')) ?></h2>
            <button class="icon-button" type="button" data-close-dialog aria-label="Close new review">×</button>
        </header>
        <form class="stack-form" data-review-create-form>
            <div class="field">
                <label for="review-kind"><?= $view->e($view->t('Period')) ?></label>
                <select id="review-kind" name="kind">
                    <option value="Daily"><?= $view->e($view->t('Daily')) ?></option>
                    <option value="Weekly"><?= $view->e($view->t('Weekly')) ?></option>
                    <option value="Monthly"><?= $view->e($view->t('Monthly')) ?></option>
                </select>
            </div>
            <div class="field">
                <label for="review-date"><?= $view->e($view->t('Date within the period')) ?></label>
                <input id="review-date" name="date" type="date" required>
            </div>
            <button class="button button-primary" type="submit"><?= $view->e($view->t('Create draft')) ?></button>
        </form>
        <p class="field-error is-hidden" data-dialog-error role="alert"></p>
    </dialog>
</section>
