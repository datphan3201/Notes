<section class="planning-page dashboard-page" data-dashboard-page aria-labelledby="dashboard-title">
    <header class="workspace-header">
        <div><p class="dashboard-date" data-dashboard-date></p><h1 id="dashboard-title">Dashboard</h1><p>A clear view of today and the week ahead.</p></div>
        <div class="workspace-header-actions">
            <button class="button button-quiet" type="button" data-planning-retry><svg class="ui-icon" aria-hidden="true"><use href="#icon-refresh"/></svg>Refresh</button>
            <a class="button button-primary" href="/tasks#task-name"><svg class="ui-icon" aria-hidden="true"><use href="#icon-plus"/></svg>New task</a>
        </div>
    </header>
    <p class="field-error is-hidden" data-planning-error role="alert"></p>
    <div class="dashboard-layout">
        <div class="dashboard-main-column">
            <section class="planning-panel today-panel" aria-labelledby="today-title">
                <div class="section-heading"><h2 id="today-title"><svg class="ui-icon" aria-hidden="true"><use href="#icon-tasks"/></svg>Today <span class="count-badge" data-today-count>—</span></h2><a class="section-link" href="/tasks">All tasks<svg class="ui-icon" aria-hidden="true"><use href="#icon-arrow"/></svg></a></div>
                <div data-today-tasks aria-live="polite"><p class="loading-copy">Loading today's tasks…</p></div>
                <div class="overdue-section">
                    <div class="section-heading"><h3>Needs attention</h3><span class="subtle-copy">Overdue</span></div>
                    <div data-overdue-tasks aria-live="polite"><p class="loading-copy">Checking deadlines…</p></div>
                </div>
            </section>
            <div class="weekly-heading"><div><h2>This week</h2><p>Make space for the work you want to move forward.</p></div><svg class="ui-icon" aria-hidden="true"><use href="#icon-calendar"/></svg></div>
            <div class="dashboard-weekly-grid">
                <section class="planning-panel"><div class="section-heading"><h2>Selected tasks</h2><span class="count-badge" data-weekly-task-count>—</span></div><div data-weekly-tasks aria-live="polite"><p class="loading-copy">Loading tasks…</p></div></section>
                <section class="planning-panel"><div class="section-heading"><h2>Milestones</h2><span class="count-badge" data-weekly-milestone-count>—</span></div><div data-weekly-milestones aria-live="polite"><p class="loading-copy">Loading milestones…</p></div></section>
            </div>
            <a class="review-prompt" href="/reviews"><span class="review-prompt-icon"><svg class="ui-icon" aria-hidden="true"><use href="#icon-reviews"/></svg></span><span><strong>A little reflection goes a long way.</strong><small>Review what worked and decide what comes next.</small></span><svg class="ui-icon" aria-hidden="true"><use href="#icon-arrow"/></svg></a>
        </div>
        <div class="dashboard-side-column">
            <section class="planning-panel activity-panel" aria-labelledby="activity-title">
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
            <section class="planning-panel habits-panel"><div class="section-heading"><h2><svg class="ui-icon" aria-hidden="true"><use href="#icon-habits"/></svg>Habits</h2><a class="section-link" href="/habits">View all</a></div><p class="panel-description">Small steps toward your goals.</p><div data-dashboard-habits aria-live="polite"><p class="loading-copy">Loading habits…</p></div></section>
            <p class="dashboard-timezone"><svg class="ui-icon" aria-hidden="true"><use href="#icon-calendar"/></svg><span data-dashboard-timezone></span></p>
        </div>
    </div>
</section>
