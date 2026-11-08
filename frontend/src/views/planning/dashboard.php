<section class="planning-page dashboard-page" data-dashboard-page aria-labelledby="dashboard-title">
    <header class="workspace-header scene-header">
        <div>
            <p class="dashboard-date"><span data-dashboard-date></span> · <span class="dashboard-timezone" data-dashboard-timezone title="<?= $view->e($view->t('Your time zone')) ?>"></span></p>
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
    <article class="planning-panel dashboard-roadmap" aria-labelledby="dashboard-roadmap-title">
        <div class="section-heading">
            <?php /* The roadmap picker is the visible card title; the hidden heading names the card without reading every option. */ ?>
            <h2 class="sr-only" id="dashboard-roadmap-title"><?= $view->e($view->t('Roadmap')) ?></h2>
            <label class="sr-only" for="dashboard-roadmap-select"><?= $view->e($view->t('Choose a roadmap')) ?></label>
            <span class="roadmap-title-picker">
                <select id="dashboard-roadmap-select" data-dashboard-roadmap-select disabled>
                    <option value=""><?= $view->e($view->t('Choose a roadmap')) ?></option>
                </select>
            </span>
            <a class="section-link" data-dashboard-roadmap-link href="/goals"><?= $view->e($view->t('View goals →')) ?></a>
        </div>
        <div class="roadmap-preview" data-dashboard-roadmap><p><?= $view->e($view->t('Choose a roadmap to display here.')) ?></p></div>
    </article>
    <p class="field-error is-hidden" data-planning-error role="alert"></p>
    <nav class="workspace-section-menu" role="tablist" aria-label="<?= $view->e($view->t('Dashboard sections')) ?>">
        <button type="button" role="tab" id="dashboard-tab-today" aria-controls="dashboard-panel-today" aria-selected="true" tabindex="0" data-workspace-tab="today"><?= $view->e($view->t('Daily')) ?></button>
        <button type="button" role="tab" id="dashboard-tab-week" aria-controls="dashboard-panel-week" aria-selected="false" tabindex="-1" data-workspace-tab="week"><?= $view->e($view->t('Weekly')) ?></button>
        <button type="button" role="tab" id="dashboard-tab-activity" aria-controls="dashboard-panel-activity" aria-selected="false" tabindex="-1" data-workspace-tab="activity"><?= $view->e($view->t('Activity')) ?></button>
    </nav>
    <section id="dashboard-panel-today" role="tabpanel" aria-labelledby="dashboard-tab-today" data-workspace-panel="today">
        <div class="dashboard-split-layout">
            <div class="dashboard-split-main">
                <section class="planning-panel today-panel" aria-labelledby="today-title">
                    <div class="today-panel-header">
                        <div class="today-panel-overview">
                            <div class="week-summary dashboard-task-summary">
                                <div data-today-ring></div>
                                <div class="dashboard-task-summary-copy">
                                    <strong data-today-completed>—</strong>
                                    <small><?= $view->e($view->t('tasks completed today')) ?></small>
                                </div>
                            </div>
                            <div class="section-heading">
                                <h2 id="today-title">
                                    <svg class="ui-icon" aria-hidden="true"><use href="#icon-tasks"/></svg>
                                    <?= $view->e($view->t('Daily tasks')) ?>
                                    <span class="count-badge" data-today-count hidden>—</span>
                                </h2>
                                <button class="button button-quiet" type="button" data-dashboard-add-today>
                                    <svg class="ui-icon" aria-hidden="true"><use href="#icon-plus"/></svg>
                                    <?= $view->e($view->t('Add task')) ?>
                                </button>
                            </div>
                        </div>
                        <div class="dashboard-week-filters dashboard-today-filters">
                            <label class="field" for="dashboard-today-sort">
                                <span><?= $view->e($view->t('Sort by')) ?></span>
                                <select id="dashboard-today-sort" data-dashboard-today-sort>
                                    <option value="importance"><?= $view->e($view->t('Importance')) ?></option>
                                    <option value="scheduled"><?= $view->e($view->t('Scheduled time')) ?></option>
                                </select>
                            </label>
                            <label class="field" for="dashboard-today-status">
                                <span><?= $view->e($view->t('Status')) ?></span>
                                <select id="dashboard-today-status" data-dashboard-today-status>
                                    <option value="all"><?= $view->e($view->t('All tasks')) ?></option>
                                    <option value="NotStarted"><?= $view->e($view->t('Not started')) ?></option>
                                    <option value="InProgress"><?= $view->e($view->t('In progress')) ?></option>
                                    <option value="Blocked"><?= $view->e($view->t('Blocked')) ?></option>
                                    <option value="Done"><?= $view->e($view->t('Completed')) ?></option>
                                </select>
                            </label>
                        </div>
                    </div>
                    <div data-today-tasks aria-live="polite">
                        <p class="loading-copy"><?= $view->e($view->t('Loading today\'s tasks…')) ?></p>
                    </div>
                    <p class="dashboard-overdue-reminder" data-overdue-reminder aria-live="polite" hidden></p>
                </section>
            </div>
            <div class="dashboard-split-side">
                <article class="planning-panel dashboard-habits-panel" aria-labelledby="dashboard-habits-title">
                    <div class="section-heading">
                        <h2 id="dashboard-habits-title">
                            <?= $view->e($view->t('Habits')) ?>
                            <span class="count-badge" data-habits-today-count>—</span>
                        </h2>
                        <a class="section-link" href="/habits"><?= $view->e($view->t('Manage habits')) ?> →</a>
                    </div>
                    <div data-habit-streak></div>
                    <div class="dashboard-habit-list" data-habits-today aria-live="polite">
                        <p class="loading-copy"><?= $view->e($view->t('Loading habits…')) ?></p>
                    </div>
                </article>
                <article class="planning-panel dashboard-recent-panel">
                    <div class="section-heading">
                        <h2><?= $view->e($view->t('Activity')) ?></h2>
                        <small><?= $view->e($view->t('Last 30 days')) ?></small>
                    </div>
                    <div class="recent-activity-section">
                        <div class="recent-activity-overview">
                            <div class="recent-activity-stats-summary">
                                <strong data-recent-activity-total>—</strong>
                                <span data-recent-activity-unit><?= $view->e($view->t('contributions')) ?></span>
                                <small data-recent-activity-days></small>
                            </div>
                            <div class="recent-activity-calendar">
                                <div class="recent-activity-weekdays" aria-hidden="true">
                                    <?php foreach (['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'] as $weekday): ?>
                                        <span><?= $view->e($view->t($weekday)) ?></span>
                                    <?php endforeach; ?>
                                </div>
                                <div data-recent-activity-grid role="group" aria-label="<?= $view->e($view->t('Activity for the last 30 days')) ?>"></div>
                            </div>
                        </div>
                        <div class="recent-activity-footer">
                            <div class="activity-legend" aria-hidden="true">
                                <span><?= $view->e($view->t('Less')) ?></span>
                                <?php foreach (range(0, 4) as $level): ?>
                                    <i data-level="<?= $level ?>"></i>
                                <?php endforeach; ?>
                                <span><?= $view->e($view->t('More')) ?></span>
                            </div>
                            <button class="text-button" type="button" data-dashboard-open-activity><?= $view->e($view->t('View activity →')) ?></button>
                        </div>
                        <p class="subtle-copy recent-activity-detail" data-recent-activity-detail aria-live="polite"><?= $view->e($view->t('Select a day to see its activity.')) ?></p>
                    </div>
                </article>
            </div>
        </div>
    </section>
    <section id="dashboard-panel-week" role="tabpanel" aria-labelledby="dashboard-tab-week" data-workspace-panel="week" hidden>
        <div class="dashboard-split-layout">
            <div class="dashboard-split-main">
                <section class="planning-panel dashboard-week-tasks" aria-labelledby="dashboard-week-tasks-title">
                    <div class="today-panel-header">
                        <div class="today-panel-overview">
                            <div class="week-summary dashboard-task-summary">
                                <div data-week-ring></div>
                                <div class="dashboard-task-summary-copy">
                                    <strong data-week-completed>—</strong>
                                    <small><?= $view->e($view->t('selected tasks completed')) ?></small>
                                    <small data-week-change></small>
                                </div>
                            </div>
                            <div class="section-heading">
                                <h2 id="dashboard-week-tasks-title">
                                    <svg class="ui-icon" aria-hidden="true"><use href="#icon-tasks"/></svg>
                                    <?= $view->e($view->t('Weekly tasks')) ?>
                                    <span class="count-badge" data-weekly-task-count>—</span>
                                </h2>
                                <a class="section-link" href="/tasks?view=all"><?= $view->e($view->t('Select tasks')) ?> →</a>
                            </div>
                        </div>
                        <div class="dashboard-week-filters">
                            <label class="field" for="dashboard-week-sort">
                                <span><?= $view->e($view->t('Sort by')) ?></span>
                                <select id="dashboard-week-sort" data-dashboard-week-sort>
                                    <option value="importance"><?= $view->e($view->t('Importance')) ?></option>
                                    <option value="scheduled"><?= $view->e($view->t('Scheduled time')) ?></option>
                                </select>
                            </label>
                            <label class="field" for="dashboard-week-status">
                                <span><?= $view->e($view->t('Status')) ?></span>
                                <select id="dashboard-week-status" data-dashboard-week-status>
                                    <option value="all"><?= $view->e($view->t('All tasks')) ?></option>
                                    <option value="NotStarted"><?= $view->e($view->t('Not started')) ?></option>
                                    <option value="InProgress"><?= $view->e($view->t('In progress')) ?></option>
                                    <option value="Blocked"><?= $view->e($view->t('Blocked')) ?></option>
                                    <option value="Done"><?= $view->e($view->t('Completed')) ?></option>
                                </select>
                            </label>
                        </div>
                    </div>
                    <div data-weekly-tasks aria-live="polite">
                        <p class="loading-copy"><?= $view->e($view->t('Loading tasks…')) ?></p>
                    </div>
                </section>
            </div>
            <div class="dashboard-split-side">
                <article class="planning-panel dashboard-week-side">
                    <div class="section-heading">
                        <h2>
                            <svg class="ui-icon" aria-hidden="true"><use href="#icon-goals"/></svg>
                            <?= $view->e($view->t('Milestones')) ?>
                            <span class="count-badge" data-weekly-milestone-count>—</span>
                        </h2>
                    </div>
                    <div data-weekly-milestones aria-live="polite">
                        <p class="loading-copy"><?= $view->e($view->t('Loading milestones…')) ?></p>
                    </div>
                    <div class="section-heading dashboard-habit-targets-heading">
                        <h3>
                            <svg class="ui-icon" aria-hidden="true"><use href="#icon-habits"/></svg>
                            <?= $view->e($view->t('Habit targets')) ?>
                        </h3>
                        <a class="section-link" href="/habits"><?= $view->e($view->t('View all')) ?></a>
                    </div>
                    <div data-dashboard-habits aria-live="polite">
                        <p class="loading-copy"><?= $view->e($view->t('Loading habits…')) ?></p>
                    </div>
                </article>
                <article class="planning-panel dashboard-week-panel" aria-labelledby="dashboard-week-title">
                    <div class="section-heading">
                        <h2 id="dashboard-week-title"><?= $view->e($view->t('Weekly')) ?></h2>
                        <small data-week-range></small>
                    </div>
                    <p class="dashboard-week-activity-summary">
                        <strong data-week-activity-total>—</strong>
                        <span data-week-activity-unit><?= $view->e($view->t('contributions')) ?></span>
                    </p>
                    <div class="dashboard-week-bars-wrapper">
                        <div class="day-bars" data-week-bars role="group" aria-labelledby="dashboard-week-title"></div>
                    </div>
                </article>
            </div>
        </div>
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
                <div class="activity-legend" aria-label="<?= $view->e($view->t('Activity intensity from less to more')) ?>">
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
    <dialog class="workspace-dialog" id="dashboard-today-dialog" aria-labelledby="dashboard-today-dialog-title" data-workspace-dialog>
        <header class="section-heading">
            <h2 id="dashboard-today-dialog-title"><?= $view->e($view->t('Add for today')) ?></h2>
            <button class="icon-button" type="button" data-close-dialog aria-label="<?= $view->e($view->t('Close')) ?>">×</button>
        </header>
        <p class="field-error is-hidden" data-today-dialog-error role="alert"></p>
        <form class="stack-form" data-today-select-form>
            <div class="field">
                <label for="dashboard-today-task"><?= $view->e($view->t('Select task')) ?></label>
                <select id="dashboard-today-task" name="id" required></select>
            </div>
            <div class="dialog-footer"><button class="button button-primary" type="submit"><?= $view->e($view->t('Add for today')) ?></button></div>
        </form>
        <form class="stack-form" data-today-create-form>
            <div class="field">
                <label for="dashboard-today-name"><?= $view->e($view->t('New task')) ?></label>
                <input id="dashboard-today-name" name="name" maxlength="200" required placeholder="<?= $view->e($view->t('What needs to get done?')) ?>">
            </div>
            <div class="dialog-footer"><button class="button button-primary" type="submit"><?= $view->e($view->t('Create task')) ?></button></div>
        </form>
    </dialog>
</section>
