<section class="planning-page" data-habits-page aria-labelledby="habits-title">
    <header class="workspace-header">
        <div><h1 id="habits-title">Habits</h1><p>Build a rhythm you can come back to, one day at a time.</p></div>
    </header>
    <p class="field-error is-hidden" data-planning-error role="alert"></p>
    <div class="planning-grid habits-grid">
        <section class="planning-panel habit-today-panel">
            <div class="section-heading"><h2>Today</h2><button class="button button-quiet" type="button" data-planning-retry>Refresh</button></div>
            <div data-habit-list aria-live="polite"><p class="subtle-copy">Loading…</p></div>
        </section>
        <section class="planning-panel creation-panel habit-create-panel">
            <h2>New habit</h2>
            <form class="stack-form" data-habit-create-form>
                <div class="field"><label for="habit-name">Name</label><input id="habit-name" name="name" maxlength="200" required></div>
                <div class="field"><label for="habit-period">Period</label><select id="habit-period" name="period"><option value="daily">Daily</option><option value="weekly">Weekly</option></select></div>
                <div class="field"><label for="habit-target">Target days</label><input id="habit-target" name="target_frequency" type="number" min="1" max="7" value="1" required></div>
                <button class="button button-primary" type="submit">Create habit</button>
            </form>
        </section>
        <section class="planning-panel series-list-panel"><h2>Recurring tasks</h2><p class="panel-description">Keep a regular place for repeatable work.</p><div data-series-list aria-live="polite"><p class="subtle-copy">Loading…</p></div></section>
        <section class="planning-panel creation-panel series-create-panel">
            <h2>New recurring task</h2>
            <form class="stack-form" data-series-create-form>
                <div class="field"><label for="series-name">Name</label><input id="series-name" name="name" maxlength="200" required></div>
                <div class="field"><label for="series-start">Start date</label><input id="series-start" name="start_date" type="date" required></div>
                <div class="field"><label for="series-frequency">Frequency</label><select id="series-frequency" name="frequency"><option value="daily">Daily</option><option value="weekly">Weekly</option></select></div>
                <div class="field"><label for="series-interval">Every</label><input id="series-interval" name="interval_count" type="number" min="1" max="52" value="1" required></div>
                <fieldset data-series-weekdays class="is-hidden"><legend>Days of the week</legend><div class="weekday-picker"><label><input type="checkbox" name="weekdays" value="1">Mon</label><label><input type="checkbox" name="weekdays" value="2">Tue</label><label><input type="checkbox" name="weekdays" value="3">Wed</label><label><input type="checkbox" name="weekdays" value="4">Thu</label><label><input type="checkbox" name="weekdays" value="5">Fri</label><label><input type="checkbox" name="weekdays" value="6">Sat</label><label><input type="checkbox" name="weekdays" value="7">Sun</label></div></fieldset>
                <div class="field"><label for="series-end">End date (optional)</label><input id="series-end" name="end_date" type="date"></div>
                <div class="field"><label for="series-time">Local time (optional)</label><input id="series-time" name="local_time" type="time"></div>
                <div class="action-row"><button class="button button-quiet" type="button" data-series-preview>Preview</button><button class="button button-primary" type="submit">Create series</button></div>
                <p class="subtle-copy" data-series-preview-output aria-live="polite"></p>
            </form>
        </section>
    </div>
</section>
