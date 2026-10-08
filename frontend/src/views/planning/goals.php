<section class="planning-page" data-goals-page aria-labelledby="planning-title">
    <header class="workspace-header scene-header">
        <div><h1 id="planning-title">Goals</h1><p>Give your ambitions a direction.</p></div>
        <div class="action-row"><button class="button button-primary" type="button" data-open-dialog="new-goal-dialog"><svg class="ui-icon" aria-hidden="true"><use href="#icon-plus"/></svg>New goal</button><button class="button button-quiet" type="button" data-open-dialog="areas-dialog">Manage areas</button></div>
    </header>
    <p class="field-error is-hidden" data-planning-error role="alert"></p><button class="button button-quiet" type="button" data-planning-retry><svg class="ui-icon" aria-hidden="true"><use href="#icon-refresh"/></svg>Retry loading goals</button>
    <div data-main-goal></div><div class="task-view-menu" role="group" aria-label="Goal views"><button type="button" data-goals-view="areas" aria-pressed="true">Areas</button><button type="button" data-goals-view="timeline" aria-pressed="false">Timeline</button><button type="button" data-goals-expand>Expand all</button></div><div class="planning-panel" data-goal-timeline hidden></div><div class="collection-layout collection-focused" data-goal-areas-view>
        <div class="collection-main">
            <section class="planning-panel" aria-labelledby="goal-tree-title">
                <h2 id="goal-tree-title" class="sr-only">Your goals</h2>
                <div data-goal-tree aria-live="polite"><p class="loading-copy">Loading goals…</p></div>
            </section>

        </div>

    </div>
    <button class="button add-area-reference" type="button" data-open-dialog="areas-dialog"><svg class="ui-icon" aria-hidden="true"><use href="#icon-plus"/></svg>Add another life area</button>
<dialog id="new-goal-dialog" class="workspace-dialog" aria-labelledby="new-goal-dialog-title" data-workspace-dialog><header class="section-heading"><h2 id="new-goal-dialog-title">New goal</h2><button class="icon-button" type="button" data-close-dialog aria-label="Close new goal">×</button></header><form class="stack-form" data-goal-create-form>
                <div class="field"><label for="goal-name">Goal name</label><input id="goal-name" name="name" maxlength="200" placeholder="Something worth working toward" required></div>
                <div class="field"><label for="goal-area">Area</label><select id="goal-area" name="area_id" required data-goal-area></select></div>
                <details class="capture-details"><summary>Add details (optional)</summary><div class="field"><label for="goal-result">Desired outcome</label><textarea id="goal-result" name="expected_result" rows="3" maxlength="10000" placeholder="What will be different?"></textarea></div>
                <div class="field"><label for="goal-criteria">Completion criteria</label><textarea id="goal-criteria" name="completion_criteria" rows="3" maxlength="10000" placeholder="How will you know you've succeeded?"></textarea></div>
</details>                <button class="button button-primary" type="submit"><svg class="ui-icon" aria-hidden="true"><use href="#icon-plus"/></svg>Create goal</button>

            </form>
        <p class="field-error is-hidden" data-dialog-error role="alert"></p></dialog>
    <dialog id="areas-dialog" class="workspace-dialog" aria-labelledby="areas-dialog-title" data-workspace-dialog><header class="section-heading"><h2 id="areas-dialog-title">Manage areas</h2><button class="icon-button" type="button" data-close-dialog aria-label="Close manage areas">×</button></header><p class="panel-description">Areas give your goals a home. Two to four is a good place to start.</p>
                <div data-area-list aria-live="polite"><p class="loading-copy">Loading areas…</p></div>
            <form class="inline-form" data-area-create-form><label class="sr-only" for="area-name">New area name</label><input id="area-name" name="name" maxlength="80" placeholder="Another life area" required><button class="button button-primary" type="submit">Add area</button></form><p class="field-error is-hidden" data-dialog-error role="alert"></p></dialog>
</section>
