<section class="planning-page" data-ai-page aria-labelledby="ai-title">
    <header class="workspace-header">
        <div>
            <h1 id="ai-title"><?= $view->e($view->t('AI assistant')) ?></h1>
            <p><?= $view->e($view->t('A thinking partner for your next steps. You review every change before it\'s saved.')) ?></p>
        </div>
        <span class="permission-badge">
            <svg class="ui-icon" aria-hidden="true"><use href="#icon-lock"/></svg>
            <?= $view->e($view->t('You\'re in control')) ?>
        </span>
    </header>
    <p class="field-error is-hidden" data-planning-error role="alert"></p>
    <div class="planning-grid">
        <section class="planning-panel">
            <h2><?= $view->e($view->t('Request a proposal')) ?></h2>
            <form class="stack-form" data-ai-form>
                <div class="field">
                    <label for="ai-capability"><?= $view->e($view->t('Capability')) ?></label>
                    <select id="ai-capability" name="capability">
                        <option value="help_plan"><?= $view->e($view->t('Help me plan')) ?></option>
                        <option value="suggest_goals"><?= $view->e($view->t('Suggest goals')) ?></option>
                        <option value="suggest_milestones"><?= $view->e($view->t('Suggest milestones')) ?></option>
                        <option value="suggest_tasks"><?= $view->e($view->t('Suggest tasks')) ?></option>
                        <option value="review_goal"><?= $view->e($view->t('Review a goal')) ?></option>
                        <option value="review_task"><?= $view->e($view->t('Review a task')) ?></option>
                        <option value="break_down_goal"><?= $view->e($view->t('Break a goal into a plan')) ?></option>
                        <option value="draft_review"><?= $view->e($view->t('Draft review reflections')) ?></option>
                    </select>
                </div>
                <fieldset class="context-picker">
                    <legend><?= $view->e($view->t('Context allowed to be sent')) ?></legend>
                    <p class="subtle-copy"><?= $view->e($view->t('Only items you select may be referenced by AI or used when applying the proposal.')) ?></p>
                    <div data-ai-context aria-live="polite">
                        <p><?= $view->e($view->t('Loading available context…')) ?></p>
                    </div>
                    <p data-ai-context-summary><?= $view->e($view->t('No context selected.')) ?></p>
                </fieldset>
                <div class="field">
                    <label for="ai-instruction"><?= $view->e($view->t('Instructions')) ?></label>
                    <textarea id="ai-instruction" name="instruction" maxlength="5000" required></textarea>
                </div>
                <label class="check-row">
                    <input type="checkbox" name="consent" required>
                    <span><?= $view->e($view->t('I agree to send my instructions and selected context to Google Gemini. The free tier may use data to improve products; Notes and files are not sent by default.')) ?></span>
                </label>
                <button class="button button-primary" type="submit"><?= $view->e($view->t('Generate proposal')) ?></button>
            </form>
        </section>
        <section class="planning-panel">
            <h2><?= $view->e($view->t('Proposal awaiting review')) ?></h2>
            <div data-ai-proposal>
                <p><?= $view->e($view->t('No proposal yet.')) ?></p>
            </div>
            <div class="section-heading is-hidden" data-ai-actions>
                <button class="button button-primary" type="button" data-ai-apply><?= $view->e($view->t('Apply')) ?></button>
                <button class="button button-quiet" type="button" data-ai-reject><?= $view->e($view->t('Reject')) ?></button>
            </div>
        </section>
    </div>
</section>
