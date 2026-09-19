<section class="planning-page" data-goal-detail data-goal-id="<?= $view->e($goal_id) ?>" aria-labelledby="goal-detail-title">
    <header class="workspace-header">
        <div><p class="eyebrow"><a href="/goals">Goals</a> / Details</p><h1 id="goal-detail-title" data-goal-name>Loading…</h1></div>
    </header>
    <div class="planning-grid">
        <article class="planning-panel">
            <h2>Definition of success</h2>
            <dl class="detail-list">
                <div><dt>Description</dt><dd data-goal-description>—</dd></div>
                <div><dt>Expected result</dt><dd data-goal-result>—</dd></div>
                <div><dt>Completion criteria</dt><dd data-goal-criteria>—</dd></div>
                <div><dt>Importance</dt><dd data-goal-importance>—</dd></div>
                <div><dt>Calculated progress</dt><dd><span data-goal-progress>0</span>%</dd></div>
            </dl>
        </article>
        <article class="planning-panel">
            <h2>Direct child goals</h2>
            <div data-goal-children aria-live="polite"><p class="subtle-copy">Loading…</p></div>
        </article>
        <article class="planning-panel">
            <div class="section-heading"><h2>Milestones</h2><span class="subtle-copy">Prerequisites block milestone completion only.</span></div>
            <div data-goal-milestones aria-live="polite"></div>
            <form class="inline-form" data-milestone-create-form><label class="sr-only" for="milestone-name">New milestone</label><input id="milestone-name" name="name" maxlength="200" placeholder="New milestone" required><button class="button button-quiet" type="submit">Add</button></form>
        </article>
        <article class="planning-panel">
            <h2>Direct tasks</h2>
            <div data-goal-tasks aria-live="polite"></div>
            <form class="inline-form" data-goal-task-create-form><label class="sr-only" for="goal-task-name">New task</label><input id="goal-task-name" name="name" maxlength="200" placeholder="New task" required><button class="button button-quiet" type="submit">Add</button></form>
        </article>
        <article class="planning-panel"><h2>Primary habits</h2><div data-goal-habits></div></article>
        <article class="planning-panel"><h2>Contributions to other goals</h2><div data-goal-contributions></div></article>
    </div>
    <p class="field-error is-hidden" data-planning-error></p>
</section>
