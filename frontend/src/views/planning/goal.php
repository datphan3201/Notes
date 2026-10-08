<section class="planning-page" data-goal-detail data-goal-id="<?= $view->e($goal_id) ?>" aria-labelledby="goal-detail-title">
    <header class="workspace-header scene-header" data-reference-decoration="corner">
        <div><p class="eyebrow"><a href="/goals">Goals</a> / Roadmap</p><h1 id="goal-detail-title" data-goal-name>Loading…</h1><p data-goal-meta aria-live="polite"></p></div>
        <div class="action-row"><button class="button button-quiet" type="button" data-goal-refresh>Refresh</button><button class="button button-quiet" type="button" data-goal-transition disabled>Complete goal</button></div>
    </header>
    <p class="field-error is-hidden" data-planning-error role="alert"></p>
    <section aria-label="Goal roadmap">
        <div data-roadmap-overview>
            <div class="section-heading"><div><h2>Your roadmap</h2><p class="subtle-copy">Select the Goal name for its information, or a milestone for its tasks.</p></div><button class="button button-quiet" type="button" data-open-milestone-create data-open-dialog="new-milestone-dialog" disabled>Add milestone</button></div>
            <div class="goal-roadmap" data-roadmap-map aria-busy="true"><p class="loading-copy">Loading roadmap…</p></div>

        </div>
        <div class="planning-panel" data-milestone-focus hidden>
            <button class="button button-quiet" type="button" data-roadmap-back>← Back to roadmap</button>
            <div class="workspace-header milestone-focus-header"><div><h2 data-milestone-title tabindex="-1"></h2><p data-milestone-meta></p></div>
        <div class="action-row"><button class="button button-quiet" type="button" data-milestone-week>Select for week</button><button class="button button-primary" type="button" data-milestone-transition></button></div></div>
            <p class="roadmap-criteria" data-milestone-criteria></p>
            <div class="goal-section-menu" role="tablist" aria-label="Milestone task types">
                <button type="button" role="tab" id="finite-task-tab" aria-controls="finite-task-panel" aria-selected="true" data-milestone-task-tab="finite">Tasks</button>
                <button type="button" role="tab" id="recurring-task-tab" aria-controls="recurring-task-panel" aria-selected="false" tabindex="-1" data-milestone-task-tab="recurring">Recurring work</button>
            </div>
            <div id="finite-task-panel" role="tabpanel" aria-labelledby="finite-task-tab" data-milestone-task-panel="finite">
                <div data-milestone-tasks></div>
<button class="button button-primary" type="button" data-open-dialog="new-milestone-task-dialog">Add task</button>
            </div>
            <div id="recurring-task-panel" role="tabpanel" aria-labelledby="recurring-task-tab" data-milestone-task-panel="recurring" hidden><p class="subtle-copy">Recurring work does not count toward finite task progress.</p><div data-milestone-recurring></div></div>
        </div>
    </section>
    <dialog id="goal-information-dialog" class="workspace-dialog goal-information-dialog" aria-labelledby="goal-information-title" data-workspace-dialog data-wait-for-data>
        <div class="section-heading"><div><p class="eyebrow">Goal information</p><h2 id="goal-information-title" data-goal-information-name tabindex="-1" autofocus></h2><p class="subtle-copy" data-goal-information-meta></p></div><button class="icon-button" type="button" data-close-dialog aria-label="Close goal information">×</button></div>
        <div class="goal-information-content">
            <p data-goal-information-description></p>
            <dl class="detail-list">
                <div data-goal-information-outcome-row hidden><dt>Desired outcome</dt><dd data-goal-information-outcome></dd></div>
                <div data-goal-information-criteria-row hidden><dt>Completion criteria</dt><dd data-goal-information-criteria></dd></div>
            </dl>
        </div>
    <details name="goal-information-sections" class="goal-information-section"><summary>Edit goal <span data-details-state aria-live="polite"></span></summary>
        <h2>Definition of success</h2>
        <form class="stack-form" data-goal-details-form>
            <div class="field"><label for="goal-edit-name">Goal name</label><input id="goal-edit-name" name="name" maxlength="200" required></div>
            <div class="field"><label for="goal-description">Description</label><textarea id="goal-description" name="description" rows="3" maxlength="10000"></textarea></div>
            <div class="field"><label for="goal-result">Desired outcome</label><textarea id="goal-result" name="expected_result" rows="3" maxlength="10000"></textarea></div>
            <div class="field"><label for="goal-criteria">Completion criteria</label><textarea id="goal-criteria" name="completion_criteria" rows="3" maxlength="10000"></textarea></div>
            <div class="planning-grid"><div class="field"><label for="goal-importance">Importance</label><select id="goal-importance" name="importance"><?php for ($importance = 1; $importance <= 5; $importance++): ?><option value="<?= $importance ?>"><?= $importance ?></option><?php endfor; ?></select></div>
        <div class="field"><label for="goal-deadline">Deadline</label><input id="goal-deadline" name="deadline" type="date"></div></div>
            <div class="action-row"><button class="button button-primary" type="submit" disabled>Save goal details</button></div>
        </form>
    </details>
    <details name="goal-information-sections" class="goal-information-section"><summary>Strategy <span data-strategy-state aria-live="polite"></span></summary>
        <div class="section-heading"><div><h2>Strategy throughout the roadmap</h2><p class="subtle-copy">Methods, learning cycles, resources, and principles. These notes do not affect progress.</p></div></div>
        <form class="stack-form" data-goal-strategy-form>
            <div class="field"><label for="goal-strategy">Strategy notes</label><textarea id="goal-strategy" name="strategy_notes" rows="9" maxlength="20000" placeholder="Diagnostic → Mental model → Theory → Build → Debug → Explain…" disabled></textarea></div>
            <button class="button button-primary" type="submit" disabled>Save strategy</button>
        </form>
    </details>
    <details name="goal-information-sections" class="goal-information-section"><summary>Related work</summary>
        <div class="section-heading"><h2>Related work</h2><div class="field"><label for="goal-related-kind">Show</label><select id="goal-related-kind" data-goal-related-kind><option value="child_goals">Child goals</option><option value="direct_tasks">Direct tasks</option><option value="recurring_tasks">Recurring work</option><option value="habits">Habits</option><option value="contributions">Contributions</option></select></div></div>
        <div data-goal-related-list></div>
        <form class="inline-form" data-goal-task-create-form hidden><label class="sr-only" for="goal-task-name">Direct task name</label><input id="goal-task-name" name="name" maxlength="200" placeholder="New direct task" required><button class="button button-quiet" type="submit">Add task</button></form>
    </details>
        <p class="field-error is-hidden" data-dialog-error role="alert"></p>
    </dialog>
    <dialog class="workspace-dialog draft-conflict" aria-labelledby="goal-conflict-title" data-goal-conflict data-workspace-dialog>
        <div class="section-heading"><h2 id="goal-conflict-title">The goal changed while you were editing</h2><button class="icon-button" type="button" data-close-dialog aria-label="Close goal conflict">×</button></div><p>Your draft is still here. Choose how to reconcile it with the latest saved version.</p><dl class="detail-list" data-goal-conflict-server></dl>
        <div class="action-row"><button class="button button-quiet" type="button" data-conflict-server>Use saved version</button><button class="button button-primary" type="button" data-conflict-draft>Keep my draft</button></div>
    </dialog>
<dialog id="new-milestone-dialog" class="workspace-dialog" aria-labelledby="new-milestone-title" data-workspace-dialog><div class="section-heading"><h2 id="new-milestone-title">New milestone</h2><button class="icon-button" type="button" data-close-dialog aria-label="Close new milestone">×</button></div>            <form class="stack-form" data-milestone-create-form>
                <div class="field"><label for="milestone-name">Milestone name</label><input id="milestone-name" name="name" maxlength="200" required></div>
                <div class="field"><label for="milestone-criteria">Completion criteria</label><textarea id="milestone-criteria" name="completion_criteria" rows="3" maxlength="10000"></textarea></div>
                <div class="action-row"><button class="button button-primary" type="submit">Create milestone</button><button class="button button-quiet" type="button" data-cancel-milestone data-close-dialog>Create later</button></div>
            </form>
        <p class="field-error is-hidden" data-dialog-error role="alert"></p></dialog><dialog id="new-milestone-task-dialog" class="workspace-dialog" aria-labelledby="new-milestone-task-title" data-workspace-dialog><div class="section-heading"><h2 id="new-milestone-task-title">New task for this milestone</h2><button class="icon-button" type="button" data-close-dialog aria-label="Close new milestone task">×</button></div>                <p class="context-chip" data-milestone-task-context></p><form class="stack-form roadmap-task-form" data-milestone-task-create-form>
                    <div class="field"><label for="milestone-task-name">Add a task to this milestone</label><input id="milestone-task-name" name="name" maxlength="200" placeholder="A concrete next step" required></div>
                    <div class="capture-suggestions" data-capture-suggestions="name"><button type="button">Build a minimal example</button><button type="button">Read and summarize</button></div><div class="field"><label for="milestone-task-criteria">Completion criteria</label><textarea id="milestone-task-criteria" name="completion_criteria" maxlength="10000" rows="2" placeholder="What will show this step is done?"></textarea></div>
                    <div class="capture-suggestions" data-capture-suggestions="completion_criteria"><button type="button">Works end-to-end</button><button type="button">Tested</button><button type="button">Explain in my own words</button></div><button class="button button-primary" type="submit">Create task</button>
                </form>
        <p class="field-error is-hidden" data-dialog-error role="alert"></p></dialog>
</section>
