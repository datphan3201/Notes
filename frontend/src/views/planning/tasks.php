<section class="planning-page" data-tasks-page aria-labelledby="tasks-title">
    <header class="workspace-header scene-header" data-reference-decoration="corner">
        <div><h1 id="tasks-title">Tasks</h1><p>A place for the next step, and the one after that.</p></div>
        <button class="button button-primary" type="button" data-open-dialog="new-task-dialog"><svg class="ui-icon" aria-hidden="true"><use href="#icon-plus"/></svg>New task</button>
    </header>
    <p class="field-error is-hidden" data-planning-error role="alert"></p>
    <div class="collection-layout collection-focused">
        <section class="planning-panel collection-main">
            <div class="section-heading"><h2><svg class="ui-icon" aria-hidden="true"><use href="#icon-tasks"/></svg>Tasks</h2><button class="icon-button" type="button" data-planning-retry aria-label="Refresh tasks"><svg class="ui-icon" aria-hidden="true"><use href="#icon-refresh"/></svg></button></div>
<div class="task-view-menu" role="group" aria-label="Task time filters"><button type="button" data-task-view="today" aria-pressed="true">Today<span class="count-badge" data-task-view-count="today">—</span></button><button type="button" data-task-view="next" aria-pressed="false">Next<span class="count-badge" data-task-view-count="next">—</span></button><button type="button" data-task-view="week" aria-pressed="false">This week<span class="count-badge" data-task-view-count="week">—</span></button><button type="button" data-task-view="backlog" aria-pressed="false">Backlog<span class="count-badge" data-task-view-count="backlog">—</span></button><button type="button" data-task-view="all" aria-pressed="false">All<span class="count-badge" data-task-view-count="all">—</span></button></div><details class="task-filter-details"><summary>Filter and search</summary><div class="collection-controls"><div class="field"><label for="task-search">Find a task</label><input id="task-search" type="search" placeholder="Search task names" data-task-search></div>
        <div class="field"><label for="task-status">Status</label><select id="task-status" data-task-status><option value="open">Open tasks</option><option value="all">All tasks</option><option value="Done">Completed</option><option value="NotStarted">Not started</option><option value="InProgress">In progress</option><option value="Blocked">Blocked</option></select></div></div></details>
            <div data-task-list aria-live="polite"><p class="loading-copy">Loading tasks…</p></div>
            <div class="collection-pagination" data-task-pagination aria-label="Task pages"></div>
        </section>

    </div>
<dialog id="new-task-dialog" class="workspace-dialog" aria-labelledby="new-task-dialog-title" data-workspace-dialog><header class="section-heading"><h2 id="new-task-dialog-title">New task</h2><button class="icon-button" type="button" data-close-dialog aria-label="Close new task">×</button></header><form class="stack-form" data-task-create-form>
                <div class="field"><label for="task-parent">Add to</label><select id="task-parent" name="parent" data-task-parent><option value="">Inbox · organize later</option></select><small data-task-parent-context></small></div><div class="field"><label for="task-name">Task name</label><input id="task-name" name="name" autofocus maxlength="200" placeholder="What needs to get done?" required></div>
                <div class="capture-suggestions" data-capture-suggestions="name"><button type="button">Build a minimal example</button><button type="button">Read and summarize</button><button type="button">Write an explanation</button></div><div class="field"><label for="task-criteria">Completion criteria</label><textarea id="task-criteria" name="completion_criteria" rows="3" maxlength="10000" placeholder="What does done look like?"></textarea><div class="capture-suggestions" data-capture-suggestions="completion_criteria"><button type="button">Works end-to-end</button><button type="button">Tested</button><button type="button">Explain in my own words</button></div><span class="field-hint">Optional. Describe the result in your own words.</span></div>
<div class="dialog-footer"><button class="button button-quiet" type="button" data-close-dialog>Cancel</button><button class="button button-primary" type="submit"><svg class="ui-icon" aria-hidden="true"><use href="#icon-plus"/></svg>Create task</button></div>

            </form>
        <p class="field-error is-hidden" data-dialog-error role="alert"></p></dialog>
</section>
