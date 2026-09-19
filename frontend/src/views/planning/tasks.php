<section class="planning-page" data-tasks-page aria-labelledby="tasks-title">
    <header class="workspace-header">
        <div><h1 id="tasks-title">Tasks</h1><p>A place for the next step, and the one after that.</p></div>
        <a class="button button-quiet" href="#task-name"><svg class="ui-icon" aria-hidden="true"><use href="#icon-plus"/></svg>New task</a>
    </header>
    <div class="collection-layout">
        <section class="planning-panel collection-main">
            <div class="section-heading"><h2><svg class="ui-icon" aria-hidden="true"><use href="#icon-tasks"/></svg>All tasks</h2><button class="icon-button" type="button" data-planning-retry aria-label="Refresh tasks"><svg class="ui-icon" aria-hidden="true"><use href="#icon-refresh"/></svg></button></div>
            <div data-task-list aria-live="polite"><p class="loading-copy">Loading tasks…</p></div>
        </section>
        <section class="planning-panel creation-panel">
            <span class="panel-symbol"><svg class="ui-icon" aria-hidden="true"><use href="#icon-plus"/></svg></span>
            <h2>Add to your inbox</h2><p class="panel-description">Capture it now. Work out the details as you go.</p>
            <form class="stack-form" data-task-create-form>
                <div class="field"><label for="task-name">Task name</label><input id="task-name" name="name" maxlength="200" placeholder="What needs to get done?" required></div>
                <div class="field"><label for="task-criteria">Completion criteria</label><textarea id="task-criteria" name="completion_criteria" rows="4" maxlength="10000" placeholder="What does done look like?"></textarea><span class="field-hint">Optional. Describe the result in your own words.</span></div>
                <button class="button button-primary" type="submit"><svg class="ui-icon" aria-hidden="true"><use href="#icon-plus"/></svg>Create task</button>
                <p class="field-error is-hidden" data-planning-error role="alert"></p>
            </form>
        </section>
    </div>
</section>
