<section class="planning-page dashboard-page" data-dashboard-page aria-labelledby="dashboard-title">
    <header class="workspace-header scene-header" data-reference-decoration="landscape">
        <div><p class="dashboard-date" data-dashboard-date></p><h1 id="dashboard-title" data-dashboard-greeting>Dashboard</h1><p>You’re making steady progress.</p></div>
        <blockquote class="theme-quote" data-theme-quote></blockquote><div class="workspace-header-actions">
            <button class="button button-quiet" type="button" data-planning-retry><svg class="ui-icon" aria-hidden="true"><use href="#icon-refresh"/></svg>Refresh</button>
            <a class="button button-primary" href="/tasks#task-name"><svg class="ui-icon" aria-hidden="true"><use href="#icon-plus"/></svg>New task</a>
        </div>
    </header>
    <p class="field-error is-hidden" data-planning-error role="alert"></p>
<nav class="workspace-section-menu" role="tablist" aria-label="Dashboard sections"><button type="button" role="tab" id="dashboard-tab-today" aria-controls="dashboard-panel-today" aria-selected="true" tabindex="0" data-workspace-tab="today">Today</button><button type="button" role="tab" id="dashboard-tab-week" aria-controls="dashboard-panel-week" aria-selected="false" tabindex="-1" data-workspace-tab="week">This week</button><button type="button" role="tab" id="dashboard-tab-activity" aria-controls="dashboard-panel-activity" aria-selected="false" tabindex="-1" data-workspace-tab="activity">Activity</button></nav>
    <section id="dashboard-panel-today" role="tabpanel" aria-labelledby="dashboard-tab-today" data-workspace-panel="today">
<div class="dashboard-summary-grid"><article class="planning-panel"><h2>This week</h2><div class="week-summary"><div data-week-ring></div><div><strong data-week-completed>—</strong><small>selected tasks completed</small><small data-week-change></small></div></div><div class="day-bars" data-week-bars></div></article><article class="planning-panel"><h2>Current focus</h2><div data-current-focus><p class="loading-copy">Finding your next step…</p></div></article><article class="planning-panel"><h2>Habit streak</h2><div data-habit-streak></div></article></div>
<article class="planning-panel dashboard-roadmap"><div class="section-heading"><h2>Your roadmap</h2><a class="section-link" data-dashboard-roadmap-link href="/goals">View goals →</a></div><div class="roadmap-preview" data-dashboard-roadmap></div></article>
<div class="dashboard-focus-grid">            <section class="planning-panel today-panel" aria-labelledby="today-title">
                <div class="section-heading"><h2 id="today-title"><svg class="ui-icon" aria-hidden="true"><use href="#icon-tasks"/></svg>Today <span class="count-badge" data-today-count>—</span></h2><a class="section-link" href="/tasks?view=all">All tasks<svg class="ui-icon" aria-hidden="true"><use href="#icon-arrow"/></svg></a></div>
                <div data-today-tasks aria-live="polite"><p class="loading-copy">Loading today's tasks…</p></div>

            </section>
                <div class="planning-panel overdue-section">
                    <div class="section-heading"><h3>Needs attention</h3><a class="section-link" href="/tasks?view=all">View all →</a></div>
                    <div data-overdue-tasks aria-live="polite"><p class="loading-copy">Checking deadlines…</p></div>
                </div>
</div></section>
    <section id="dashboard-panel-week" class="" role="tabpanel" aria-labelledby="dashboard-tab-week" data-workspace-panel="week" hidden>            <div class="weekly-heading"><div><h2>This week</h2><p>Make space for the work you want to move forward.</p></div><svg class="ui-icon" aria-hidden="true"><use href="#icon-calendar"/></svg></div>
            <div class="dashboard-weekly-grid">
                <section class="planning-panel"><div class="section-heading"><h2>Selected tasks</h2><span class="count-badge" data-weekly-task-count>—</span></div>
        <div data-weekly-tasks aria-live="polite"><p class="loading-copy">Loading tasks…</p></div></section>
                <section class="planning-panel"><div class="section-heading"><h2>Milestones</h2><span class="count-badge" data-weekly-milestone-count>—</span></div>
        <div data-weekly-milestones aria-live="polite"><p class="loading-copy">Loading milestones…</p></div></section>
            </div>
            <section class="planning-panel habits-panel"><div class="section-heading"><h2><svg class="ui-icon" aria-hidden="true"><use href="#icon-habits"/></svg>Habits</h2><a class="section-link" href="/habits">View all</a></div><p class="panel-description">Small steps toward your goals.</p><div data-dashboard-habits aria-live="polite"><p class="loading-copy">Loading habits…</p></div></section>            <a class="review-prompt" href="/reviews"><span class="review-prompt-icon"><svg class="ui-icon" aria-hidden="true"><use href="#icon-reviews"/></svg></span><span><strong>A little reflection goes a long way.</strong><small>Review what worked and decide what comes next.</small></span><svg class="ui-icon" aria-hidden="true"><use href="#icon-arrow"/></svg></a>
</section>
    <section id="dashboard-panel-activity" class="activity-focus" role="tabpanel" aria-labelledby="dashboard-tab-activity" data-workspace-panel="activity" hidden>            <section class="planning-panel activity-panel" aria-labelledby="activity-title">
                <div class="section-heading"><h2 id="activity-title">Your activity</h2><span class="subtle-copy">Monthly</span></div>
                <div class="activity-totals"><strong data-activity-total>—</strong><span><span data-activity-unit>contributions</span><br><small data-activity-days>Loading activity…</small></span></div>
                <p class="sr-only" data-activity-summary aria-live="polite">Loading activity…</p>
                <div class="activity-month-navigation" aria-label="Activity month">
                    <strong data-activity-month></strong>
                    <button class="activity-month-button" type="button" data-activity-previous aria-label="Previous month" disabled>‹</button>
                    <button class="activity-month-button" type="button" data-activity-next aria-label="Next month" disabled>›</button>
                </div>
                <div class="activity-scroll" tabindex="0" aria-label="Monthly contribution calendar. Scroll horizontally when needed.">
                    <div class="activity-calendar">
                        <div class="activity-weekdays" aria-hidden="true"><span></span><span>Mon</span><span></span><span>Wed</span><span></span><span>Fri</span><span></span></div>
                        <div class="activity-grid" data-activity-grid role="group" aria-label="Daily contributions"></div>
                    </div>
                </div>
                <div class="activity-footer"><div class="activity-legend" aria-label="Activity intensity from less to more"><span>Less</span><i data-level="0"></i><i data-level="1"></i><i data-level="2"></i><i data-level="3"></i><i data-level="4"></i><span>More</span></div></div>
                <p class="activity-explanation">Every completed task, checklist item, habit, and milestone counts.</p>
                <div class="activity-tooltip is-hidden" data-activity-tooltip role="tooltip" id="activity-tooltip"></div>
            </section>
</section>
    <p class="dashboard-timezone"><svg class="ui-icon" aria-hidden="true"><use href="#icon-calendar"/></svg><span data-dashboard-timezone></span></p>
</section>
