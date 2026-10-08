<section class="planning-page" data-habits-page aria-labelledby="habits-title">
    <header class="workspace-header scene-header">
        <div><h1 id="habits-title">Habits</h1><p>Small steps, big consistency.</p></div><button class="button button-primary" type="button" data-open-dialog="new-habit-dialog"><svg class="ui-icon" aria-hidden="true"><use href="#icon-plus"/></svg>New habit</button>
    </header>
    <p class="field-error is-hidden" data-planning-error role="alert"></p>





<nav class="workspace-section-menu" role="tablist" aria-label="Habits sections"><button type="button" role="tab" id="habits-tab-checkins" aria-controls="habits-panel-checkins" aria-selected="true" tabindex="0" data-workspace-tab="checkins">Check-ins</button><button type="button" role="tab" id="habits-tab-recurring" aria-controls="habits-panel-recurring" aria-selected="false" tabindex="-1" data-workspace-tab="recurring">Recurring tasks</button></nav>
    <section id="habits-panel-checkins" class="" role="tabpanel" aria-labelledby="habits-tab-checkins" data-workspace-panel="checkins"><div class="habit-summary"><article class="planning-panel"><h2>Your streak</h2><div data-habit-streak></div></article><article class="planning-panel scene-card quote-scene-card" data-reference-decoration="plant"><blockquote class="theme-quote" data-theme-quote></blockquote></article></div>        <section class="planning-panel habit-today-panel">
            <div class="section-heading"><h2>Today</h2><div class="action-row"><button class="button button-quiet" type="button" data-planning-retry>Refresh</button></div></div>
            <div data-habit-list aria-live="polite"><p class="subtle-copy">Loading…</p></div>
        </section></section>
    <section id="habits-panel-recurring" class="" role="tabpanel" aria-labelledby="habits-tab-recurring" data-workspace-panel="recurring" hidden>        <section class="planning-panel series-list-panel"><div class="section-heading"><h2>Recurring tasks</h2><button class="button button-primary" type="button" data-open-dialog="new-series-dialog">New recurring task</button></div><p class="panel-description">Keep a regular place for repeatable work.</p><div data-series-list aria-live="polite"><p class="subtle-copy">Loading…</p></div></section></section>
    <dialog id="new-habit-dialog" class="workspace-dialog" aria-labelledby="new-habit-dialog-title" data-workspace-dialog><header class="section-heading"><h2 id="new-habit-dialog-title">New habit</h2><button class="icon-button" type="button" data-close-dialog aria-label="Close new habit">×</button></header><form class="stack-form" data-habit-create-form>
                <div class="field"><label for="habit-name">Name</label><input id="habit-name" name="name" maxlength="200" required></div>
                <div class="field"><label for="habit-period">Period</label><select id="habit-period" name="period"><option value="daily">Daily</option><option value="weekly">Weekly</option></select></div>
                <div class="field"><label for="habit-target">Target days</label><input id="habit-target" name="target_frequency" type="number" min="1" max="7" value="1" required></div>
                <button class="button button-primary" type="submit">Create habit</button>
            </form>
        <p class="field-error is-hidden" data-dialog-error role="alert"></p></dialog><dialog id="new-series-dialog" class="workspace-dialog" aria-labelledby="new-series-dialog-title" data-workspace-dialog><header class="section-heading"><h2 id="new-series-dialog-title">New recurring task</h2><button class="icon-button" type="button" data-close-dialog aria-label="Close new recurring task">×</button></header><form class="stack-form" data-series-create-form>
                <div class="field"><label for="series-name">Name</label><input id="series-name" name="name" maxlength="200" required></div>
                <div class="field"><label for="series-start">Start date</label><input id="series-start" name="start_date" type="date" required></div>
                <div class="field"><label for="series-frequency">Frequency</label><select id="series-frequency" name="frequency"><option value="daily">Daily</option><option value="weekly">Weekly</option></select></div>
                <div class="field"><label for="series-interval">Every</label><input id="series-interval" name="interval_count" type="number" min="1" max="52" value="1" required></div>
                <fieldset data-series-weekdays class="is-hidden"><legend>Days of the week</legend><div class="weekday-picker"><label><input type="checkbox" name="weekdays" value="1">Mon</label><label><input type="checkbox" name="weekdays" value="2">Tue</label><label><input type="checkbox" name="weekdays" value="3">Wed</label><label><input type="checkbox" name="weekdays" value="4">Thu</label><label><input type="checkbox" name="weekdays" value="5">Fri</label><label><input type="checkbox" name="weekdays" value="6">Sat</label><label><input type="checkbox" name="weekdays" value="7">Sun</label></div></fieldset>
                <details class="capture-details"><summary>End date and time (optional)</summary><div class="field"><label for="series-end">End date (optional)</label><input id="series-end" name="end_date" type="date"></div>
                <div class="field"><label for="series-time">Local time (optional)</label><input id="series-time" name="local_time" type="time"></div>
</details>                <div class="action-row"><button class="button button-quiet" type="button" data-series-preview>Preview</button><button class="button button-primary" type="submit">Create series</button></div>
                <p class="subtle-copy" data-series-preview-output aria-live="polite"></p>
            </form>
        <p class="field-error is-hidden" data-dialog-error role="alert"></p></dialog>
</section>
