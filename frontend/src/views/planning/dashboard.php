<section class="planning-page dashboard-page" data-dashboard-page aria-labelledby="dashboard-title">
    <header class="workspace-header scene-header" data-reference-decoration="landscape">
        <div>
            <p class="dashboard-date" data-dashboard-date></p>
            <h1 id="dashboard-title" data-dashboard-greeting><?= $view->e($view->t('Dashboard')) ?></h1>
            <p><?= $view->e($view->t('You’re making steady progress.')) ?></p>
        </div>
        <blockquote class="theme-quote" data-theme-quote></blockquote>
        <div class="workspace-header-actions">
            <button class="button button-quiet" type="button" data-planning-retry>
                <svg class="ui-icon" aria-hidden="true"><use href="#icon-refresh"/></svg>
                <?= $view->e($view->t('Refresh')) ?>
            </button>
            <a class="button button-primary" href="/tasks#task-name">
                <svg class="ui-icon" aria-hidden="true"><use href="#icon-plus"/></svg>
                <?= $view->e($view->t('New task')) ?>
            </a>
        </div>
    </header>
    <p class="field-error is-hidden" data-planning-error role="alert"></p>
    <nav class="workspace-section-menu" role="tablist" aria-label="Dashboard sections">
        <button type="button" role="tab" id="dashboard-tab-today" aria-controls="dashboard-panel-today" aria-selected="true" tabindex="0" data-workspace-tab="today"><?= $view->e($view->t('Today')) ?></button>
        <button type="button" role="tab" id="dashboard-tab-week" aria-controls="dashboard-panel-week" aria-selected="false" tabindex="-1" data-workspace-tab="week"><?= $view->e($view->t('This week')) ?></button>
        <button type="button" role="tab" id="dashboard-tab-activity" aria-controls="dashboard-panel-activity" aria-selected="false" tabindex="-1" data-workspace-tab="activity"><?= $view->e($view->t('Activity')) ?></button>
    </nav>
    <section id="dashboard-panel-today" role="tabpanel" aria-labelledby="dashboard-tab-today" data-workspace-panel="today">
        <div class="dashboard-summary-grid">
            <article class="planning-panel">
                <h2><?= $view->e($view->t('This week')) ?></h2>
                <div class="week-summary">
                    <div data-week-ring></div>
                    <div>
                        <strong data-week-completed>—</strong>
                        <small><?= $view->e($view->t('selected tasks completed')) ?></small>
                        <small data-week-change></small>
                    </div>
                </div>
                <div class="day-bars" data-week-bars></div>
            </article>
            <article class="planning-panel">
                <h2><?= $view->e($view->t('Current focus')) ?></h2>
                <div data-current-focus>
                    <p class="loading-copy"><?= $view->e($view->t('Finding your next step…')) ?></p>
                </div>
            </article>
            <article class="planning-panel">
                <h2><?= $view->e($view->t('Habit streak')) ?></h2>
                <div data-habit-streak></div>
            </article>
        </div>
        <article class="planning-panel dashboard-roadmap">
            <div class="section-heading">
                <h2><?= $view->e($view->t('Your roadmap')) ?></h2>
                <a class="section-link" data-dashboard-roadmap-link href="/goals"><?= $view->e($view->t('View goals →')) ?></a>
            </div>
            <div class="roadmap-preview" data-dashboard-roadmap></div>
        </article>
        <div class="dashboard-focus-grid">
            <section class="planning-panel today-panel" aria-labelledby="today-title">
                <div class="section-heading">
                    <h2 id="today-title">
                        <svg class="ui-icon" aria-hidden="true"><use href="#icon-tasks"/></svg>
                        <?= $view->e($view->t('Today')) ?>
                        <span class="count-badge" data-today-count>—</span>
                    </h2>
                    <a class="section-link" href="/tasks?view=all">
                        <?= $view->e($view->t('All tasks')) ?>
                        <svg class="ui-icon" aria-hidden="true"><use href="#icon-arrow"/></svg>
                    </a>
                </div>
                <div data-today-tasks aria-live="polite">
                    <p class="loading-copy"><?= $view->e($view->t('Loading today\'s tasks…')) ?></p>
                </div>
            </section>
            <div class="planning-panel overdue-section">
                <div class="section-heading">
                    <h3><?= $view->e($view->t('Needs attention')) ?></h3>
                    <a class="section-link" href="/tasks?view=all"><?= $view->e($view->t('View all →')) ?></a>
                </div>
                <div data-overdue-tasks aria-live="polite">
                    <p class="loading-copy"><?= $view->e($view->t('Checking deadlines…')) ?></p>
                </div>
            </div>
        </div>
    </section>
    <section id="dashboard-panel-week" class="" role="tabpanel" aria-labelledby="dashboard-tab-week" data-workspace-panel="week" hidden>
        <div class="weekly-heading">
            <div>
                <h2><?= $view->e($view->t('This week')) ?></h2>
                <p><?= $view->e($view->t('Make space for the work you want to move forward.')) ?></p>
            </div>
            <svg class="ui-icon" aria-hidden="true"><use href="#icon-calendar"/></svg>
        </div>
        <div class="dashboard-weekly-grid">
            <section class="planning-panel">
                <div class="section-heading">
                    <h2><?= $view->e($view->t('Selected tasks')) ?></h2>
                    <span class="count-badge" data-weekly-task-count>—</span>
                </div>
                <div data-weekly-tasks aria-live="polite">
                    <p class="loading-copy"><?= $view->e($view->t('Loading tasks…')) ?></p>
                </div>
            </section>
            <section class="planning-panel">
                <div class="section-heading">
                    <h2><?= $view->e($view->t('Milestones')) ?></h2>
                    <span class="count-badge" data-weekly-milestone-count>—</span>
                </div>
                <div data-weekly-milestones aria-live="polite">
                    <p class="loading-copy"><?= $view->e($view->t('Loading milestones…')) ?></p>
                </div>
            </section>
        </div>
        <section class="planning-panel habits-panel">
            <div class="section-heading">
                <h2>
                    <svg class="ui-icon" aria-hidden="true"><use href="#icon-habits"/></svg>
                    <?= $view->e($view->t('Habits')) ?>
                </h2>
                <a class="section-link" href="/habits"><?= $view->e($view->t('View all')) ?></a>
            </div>
            <p class="panel-description"><?= $view->e($view->t('Small steps toward your goals.')) ?></p>
            <div data-dashboard-habits aria-live="polite">
                <p class="loading-copy"><?= $view->e($view->t('Loading habits…')) ?></p>
            </div>
        </section>
        <a class="review-prompt" href="/reviews">
            <span class="review-prompt-icon">
                <svg class="ui-icon" aria-hidden="true"><use href="#icon-reviews"/></svg>
            </span>
            <span>
                <strong><?= $view->e($view->t('A little reflection goes a long way.')) ?></strong>
                <small><?= $view->e($view->t('Review what worked and decide what comes next.')) ?></small>
            </span>
            <svg class="ui-icon" aria-hidden="true"><use href="#icon-arrow"/></svg>
        </a>
    </section>
    <section id="dashboard-panel-activity" class="activity-focus" role="tabpanel" aria-labelledby="dashboard-tab-activity" data-workspace-panel="activity" hidden>
        <section class="planning-panel activity-panel" aria-labelledby="activity-title">
            <div class="section-heading">
                <h2 id="activity-title"><?= $view->e($view->t('Your activity')) ?></h2>
                <span class="subtle-copy"><?= $view->e($view->t('Yearly')) ?></span>
            </div>
            <div class="activity-totals">
                <strong data-activity-total>—</strong>
                <span>
                    <span data-activity-unit><?= $view->e($view->t('contributions')) ?></span>
                    <br>
                    <small data-activity-days><?= $view->e($view->t('Loading activity…')) ?></small>
                </span>
            </div>
            <p class="sr-only" data-activity-summary aria-live="polite"><?= $view->e($view->t('Loading activity…')) ?></p>
            <div class="activity-year-layout">
                <div class="activity-scroll" tabindex="0" aria-label="<?= $view->e($view->t('Yearly contribution calendar. Scroll horizontally when needed.')) ?>">
                    <div class="activity-grid" data-activity-grid role="group" aria-label="<?= $view->e($view->t('Daily contributions')) ?>"></div>
                </div>
                <div class="activity-year-list" aria-label="<?= $view->e($view->t('Activity year')) ?>">
                    <button class="activity-month-button" type="button" data-activity-previous aria-label="<?= $view->e($view->t('Newer year')) ?>" disabled>⌃</button>
                    <div data-activity-years role="group"></div>
                    <button class="activity-month-button" type="button" data-activity-next aria-label="<?= $view->e($view->t('Older year')) ?>" disabled>⌄</button>
                </div>
            </div>
            <div class="activity-footer">
                <div class="activity-legend" aria-label="Activity intensity from less to more">
                    <span><?= $view->e($view->t('Less')) ?></span>
                    <i data-level="0"></i>
                    <i data-level="1"></i>
                    <i data-level="2"></i>
                    <i data-level="3"></i>
                    <i data-level="4"></i>
                    <span><?= $view->e($view->t('More')) ?></span>
                </div>
            </div>
            <p class="activity-explanation"><?= $view->e($view->t('Every completed task, checklist item, habit, and milestone counts.')) ?></p>
            <div class="activity-tooltip is-hidden" data-activity-tooltip role="tooltip" id="activity-tooltip"></div>
        </section>
    </section>
    <p class="dashboard-timezone">
        <svg class="ui-icon" aria-hidden="true"><use href="#icon-calendar"/></svg>
        <span data-dashboard-timezone></span>
    </p>
</section>
