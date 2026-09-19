<section class="planning-page" data-goals-page aria-labelledby="planning-title">
    <header class="workspace-header">
        <div><h1 id="planning-title">Goals</h1><p>Give your ambitions a direction. Break them into steps that fit your life.</p></div>
        <a class="button button-quiet" href="#goal-name"><svg class="ui-icon" aria-hidden="true"><use href="#icon-plus"/></svg>New goal</a>
    </header>
    <div class="collection-layout">
        <div class="collection-main">
            <section class="planning-panel" aria-labelledby="goal-tree-title">
                <div class="section-heading"><h2 id="goal-tree-title"><svg class="ui-icon" aria-hidden="true"><use href="#icon-goals"/></svg>Your goals</h2><button class="icon-button" type="button" data-planning-retry aria-label="Refresh goals"><svg class="ui-icon" aria-hidden="true"><use href="#icon-refresh"/></svg></button></div>
                <div data-goal-tree aria-live="polite"><p class="loading-copy">Loading goals…</p></div>
            </section>
            <details class="planning-panel area-settings">
                <summary>Organize your areas<span class="subtle-copy">Rename to fit your life</span></summary>
                <p class="panel-description">Areas give your goals a home. Two to four is a good place to start.</p>
                <div data-area-list aria-live="polite"><p class="loading-copy">Loading areas…</p></div>
            </details>
        </div>
        <section class="planning-panel creation-panel" aria-labelledby="new-goal-title">
            <span class="panel-symbol"><svg class="ui-icon" aria-hidden="true"><use href="#icon-goals"/></svg></span>
            <h2 id="new-goal-title">Start with a goal</h2><p class="panel-description">What would you like to work toward?</p>
            <form class="stack-form" data-goal-create-form>
                <div class="field"><label for="goal-name">Goal name</label><input id="goal-name" name="name" maxlength="200" placeholder="Something worth working toward" required></div>
                <div class="field"><label for="goal-area">Area</label><select id="goal-area" name="area_id" required data-goal-area></select></div>
                <div class="field"><label for="goal-result">Desired outcome</label><textarea id="goal-result" name="expected_result" rows="3" maxlength="10000" placeholder="What will be different?"></textarea></div>
                <div class="field"><label for="goal-criteria">Completion criteria</label><textarea id="goal-criteria" name="completion_criteria" rows="3" maxlength="10000" placeholder="How will you know you've succeeded?"></textarea></div>
                <button class="button button-primary" type="submit"><svg class="ui-icon" aria-hidden="true"><use href="#icon-plus"/></svg>Create goal</button>
                <p class="field-error is-hidden" data-planning-error role="alert"></p>
            </form>
        </section>
    </div>
</section>
