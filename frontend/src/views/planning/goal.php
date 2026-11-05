<section class="planning-page" data-goal-detail data-goal-id="<?= $view->e($goal_id) ?>" aria-labelledby="goal-detail-title">
    <header class="workspace-header scene-header">
        <div>
            <p class="eyebrow">
                <a href="/goals"><?= $view->e($view->t('Goals')) ?></a>
                <?= $view->e($view->t('/ Roadmap')) ?>
            </p>
            <div class="entity-title-row">
                <span data-goal-icon></span>
                <h1 id="goal-detail-title" data-goal-name><?= $view->e($view->t('Loading…')) ?></h1>
            </div>
            <p class="entity-meta-row"><span data-goal-meta aria-live="polite"></span><span data-goal-stars></span></p>
        </div>
        <div class="action-row">
            <button class="button button-quiet" type="button" data-open-dialog="goal-information-dialog"><svg class="ui-icon" aria-hidden="true"><use href="#icon-goals"/></svg><?= $view->e($view->t('Goal information')) ?></button>
            <button class="button button-quiet" type="button" data-goal-refresh><svg class="ui-icon" aria-hidden="true"><use href="#icon-refresh"/></svg><?= $view->e($view->t('Refresh')) ?></button>
            <button class="button button-quiet" type="button" data-goal-transition disabled><svg class="ui-icon" aria-hidden="true"><use href="#icon-check"/></svg><span><?= $view->e($view->t('Complete goal')) ?></span></button>
            <button class="button button-primary" type="button" data-open-milestone-create disabled><svg class="ui-icon" aria-hidden="true"><use href="#icon-plus"/></svg><?= $view->e($view->t('Add milestone')) ?></button>
        </div>
    </header>
    <p class="field-error is-hidden" data-planning-error role="alert"></p>
    <section aria-label="<?= $view->e($view->t('Goal roadmap')) ?>">
        <div data-roadmap-overview>
            <div class="section-heading">
                <div>
                    <h2 class="roadmap-heading"><?= $view->e($view->t('Roadmap')) ?></h2>
                    <p class="subtle-copy"><?= $view->e($view->t('Select the Goal name for its information, or a milestone for its tasks.')) ?></p>
                </div>
            </div>
            <div class="goal-roadmap" data-roadmap-map aria-busy="true">
                <p class="loading-copy"><?= $view->e($view->t('Loading roadmap…')) ?></p>
            </div>
        </div>
        <div class="planning-panel" data-milestone-focus hidden>
            <button class="button button-quiet" type="button" data-roadmap-back><svg class="ui-icon" aria-hidden="true"><use href="#icon-arrow-left"/></svg><?= $view->e($view->t('Back to roadmap')) ?></button>
            <div class="workspace-header milestone-focus-header">
                <div>
                    <div class="entity-title-row">
                        <span data-milestone-icon></span>
                        <h2 data-milestone-title tabindex="-1"></h2>
                        <span data-milestone-stars></span>
                    </div>
                    <p data-milestone-meta></p>
                </div>
                <div class="action-row">
                    <button class="icon-button task-row-icon" type="button" data-milestone-week></button>
                    <span data-milestone-menu></span>
                    <button class="button button-primary" type="button" data-milestone-transition></button>
                </div>
            </div>
            <p class="roadmap-criteria" data-milestone-criteria></p>
            <details class="milestone-links">
                <summary><?= $view->e($view->t('Prerequisites and related goals')) ?></summary>
                <h3><?= $view->e($view->t('Finish these milestones first')) ?></h3>
                <div data-milestone-prerequisites></div>
                <h3><?= $view->e($view->t('This milestone also supports')) ?></h3>
                <div data-milestone-contributions></div>
            </details>
            <div class="goal-section-menu" role="tablist" aria-label="<?= $view->e($view->t('Milestone task types')) ?>">
                <button type="button" role="tab" id="finite-task-tab" aria-controls="finite-task-panel" aria-selected="true" data-milestone-task-tab="finite"><?= $view->e($view->t('Tasks')) ?></button>
                <button type="button" role="tab" id="recurring-task-tab" aria-controls="recurring-task-panel" aria-selected="false" tabindex="-1" data-milestone-task-tab="recurring"><?= $view->e($view->t('Recurring work')) ?></button>
            </div>
            <div id="finite-task-panel" role="tabpanel" aria-labelledby="finite-task-tab" data-milestone-task-panel="finite">
                <div data-milestone-tasks></div>
                <button class="button button-quiet milestone-add-task" type="button" data-milestone-task-new><svg class="ui-icon" aria-hidden="true"><use href="#icon-plus"/></svg><?= $view->e($view->t('Add task')) ?></button>
            </div>
            <div id="recurring-task-panel" role="tabpanel" aria-labelledby="recurring-task-tab" data-milestone-task-panel="recurring" hidden>
                <p class="subtle-copy"><?= $view->e($view->t('Recurring work does not count toward finite task progress.')) ?></p>
                <div data-milestone-recurring></div>
            </div>
        </div>
    </section>
    <dialog id="goal-information-dialog" class="workspace-dialog goal-information-dialog" aria-labelledby="goal-information-title" data-workspace-dialog data-wait-for-data>
        <header class="section-heading">
            <div>
                <p class="eyebrow"><?= $view->e($view->t('Goal information')) ?></p>
                <div class="entity-title-row"><span data-goal-information-icon></span><h2 id="goal-information-title" data-goal-information-name tabindex="-1" autofocus></h2></div>
                <p class="subtle-copy" data-goal-information-meta></p>
            </div>
            <button class="icon-button" type="button" data-close-dialog aria-label="<?= $view->e($view->t('Close')) ?>">×</button>
        </header>
        <div class="goal-information-content">
            <p data-goal-information-description></p>
            <dl class="detail-list">
                <div data-goal-information-outcome-row hidden>
                    <dt><?= $view->e($view->t('Desired outcome')) ?></dt>
                    <dd data-goal-information-outcome></dd>
                </div>
                <div data-goal-information-criteria-row hidden>
                    <dt><?= $view->e($view->t('Completion criteria')) ?></dt>
                    <dd data-goal-information-criteria></dd>
                </div>
            </dl>
        </div>
        <div class="action-row">
            <button class="button button-quiet" type="button" data-goal-edit><svg class="ui-icon" aria-hidden="true"><use href="#icon-settings"/></svg><?= $view->e($view->t('Edit goal')) ?></button>
        </div>
        <details name="goal-information-sections" class="goal-information-section">
            <summary>
                <?= $view->e($view->t('Strategy')) ?>
                <span data-strategy-state aria-live="polite"></span>
            </summary>
            <div class="section-heading">
                <div>
                    <h2><?= $view->e($view->t('Strategy throughout the roadmap')) ?></h2>
                    <p class="subtle-copy"><?= $view->e($view->t('Methods, learning cycles, resources, and principles. These notes do not affect progress.')) ?></p>
                </div>
            </div>
            <form class="stack-form" data-goal-strategy-form>
                <div class="field">
                    <label for="goal-strategy"><?= $view->e($view->t('Strategy notes')) ?></label>
                    <textarea id="goal-strategy" name="strategy_notes" rows="9" maxlength="20000" placeholder="<?= $view->e($view->t('Methods, resources and principles you want to follow')) ?>" disabled></textarea>
                </div>
                <div class="dialog-footer"><button class="button button-quiet" type="button" data-close-dialog><?= $view->e($view->t('Cancel')) ?></button><button class="button button-primary" type="submit" disabled><svg class="ui-icon" aria-hidden="true"><use href="#icon-check"/></svg><?= $view->e($view->t('Save strategy')) ?></button></div>
            </form>
        </details>
        <details name="goal-information-sections" class="goal-information-section">
            <summary><?= $view->e($view->t('Related work')) ?></summary>
            <div class="section-heading">
                <h2><?= $view->e($view->t('Related work')) ?></h2>
                <div class="field">
                    <label for="goal-related-kind"><?= $view->e($view->t('Show')) ?></label>
                    <select id="goal-related-kind" data-goal-related-kind>
                        <option value="child_goals"><?= $view->e($view->t('Child goals')) ?></option>
                        <option value="direct_tasks"><?= $view->e($view->t('Direct tasks')) ?></option>
                        <option value="recurring_tasks"><?= $view->e($view->t('Recurring work')) ?></option>
                        <option value="habits"><?= $view->e($view->t('Habits')) ?></option>
                        <option value="contributions"><?= $view->e($view->t('Contributions')) ?></option>
                    </select>
                </div>
            </div>
            <div data-goal-related-list></div>
            <div class="action-row">
                <button class="button button-quiet" type="button" data-goal-child-new hidden><svg class="ui-icon" aria-hidden="true"><use href="#icon-plus"/></svg><?= $view->e($view->t('Add sub-goal')) ?></button>
                <button class="button button-quiet" type="button" data-goal-task-new hidden><svg class="ui-icon" aria-hidden="true"><use href="#icon-plus"/></svg><?= $view->e($view->t('Add task')) ?></button>
            </div>
        </details>
        <details name="goal-information-sections" class="goal-information-section">
            <summary><?= $view->e($view->t('Related notes')) ?></summary>
            <div class="linked-notes" data-linked-notes="goal" data-linked-id="<?= $view->e($goal_id) ?>">
            <div class="section-heading">
                <div>
                    <h2><?= $view->e($view->t('Related notes')) ?></h2>
                    <p class="subtle-copy"><?= $view->e($view->t('Notes linked to this goal from the Notes page.')) ?></p>
                </div>
                <a class="button button-quiet" href="/" data-linked-notes-new>
                    <svg class="ui-icon" aria-hidden="true"><use href="#icon-plus"/></svg>
                    <?= $view->e($view->t('New linked note')) ?>
                </a>
            </div>
            <div class="linked-notes-list" data-linked-notes-list></div>
        </div>
        </details>
        <details name="goal-information-sections" class="goal-information-section">
            <summary><?= $view->e($view->t('Tags')) ?></summary>
            <div data-goal-tags></div>
        </details>
        <section class="danger-zone">
            <p class="subtle-copy"><?= $view->e($view->t('Archiving a goal also archives its sub-goals, milestones and tasks. Their data is retained.')) ?></p>
            <button class="button button-danger-quiet" type="button" data-goal-archive><?= $view->e($view->t('Archive goal')) ?></button>
        </section>
        <p class="field-error is-hidden" data-dialog-error role="alert"></p>
    </dialog>
    <dialog class="workspace-dialog draft-conflict" aria-labelledby="goal-conflict-title" data-goal-conflict data-workspace-dialog>
        <header class="section-heading">
            <h2 id="goal-conflict-title"><?= $view->e($view->t('The goal changed while you were editing')) ?></h2>
            <button class="icon-button" type="button" data-close-dialog aria-label="<?= $view->e($view->t('Close')) ?>">×</button>
        </header>
        <p><?= $view->e($view->t('Your draft is still here. Choose how to reconcile it with the latest saved version.')) ?></p>
        <dl class="detail-list" data-goal-conflict-server></dl>
        <div class="dialog-footer">
            <button class="button button-quiet" type="button" data-conflict-server><?= $view->e($view->t('Use saved version')) ?></button>
            <button class="button button-primary" type="button" data-conflict-draft><?= $view->e($view->t('Keep my draft')) ?></button>
        </div>
    </dialog>
</section>
