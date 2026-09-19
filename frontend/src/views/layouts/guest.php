<!doctype html>
<html lang="en">
    <head>
        <meta charset="utf-8">
        <meta name="viewport" content="width=device-width, initial-scale=1">
        <meta name="csrf-token" content="<?= $view->e($csrf_token) ?>">
        <title><?= $view->e($title ?? 'Planner') ?> · Planner</title>
        <?= $view->assets() ?>
    </head>
    <body class="guest-page">
        <?php require __DIR__.'/icons.php'; ?>
        <a class="skip-link" href="#main-content">Skip to content</a>
        <main class="guest-shell">
            <section class="guest-story" aria-labelledby="guest-heading">
                <div class="sidebar-brand"><span class="brand-symbol" aria-hidden="true"><span></span><i></i></span><span>Planner</span></div>
                <div class="guest-story-content">
                    <h2 id="guest-heading">Big intentions.<br>Small, steady steps.</h2>
                    <p>Give your goals a direction, your tasks a place, and your progress a little perspective.</p>
                    <div class="guest-path" aria-label="From goals to daily progress">
                        <div><svg class="ui-icon" aria-hidden="true"><use href="#icon-goals"/></svg><span><strong>Find your direction</strong><small>Goals that matter to you.</small></span></div>
                        <div><svg class="ui-icon" aria-hidden="true"><use href="#icon-tasks"/></svg><span><strong>Take the next step</strong><small>Milestones, tasks, and daily habits.</small></span></div>
                        <div><svg class="ui-icon" aria-hidden="true"><use href="#icon-reviews"/></svg><span><strong>See how far you've come</strong><small>Activity and space to reflect.</small></span></div>
                    </div>
                </div>
                <p class="guest-footnote">Your plans. Your pace.</p>
            </section>
            <div class="guest-form-region"><?= $content ?></div>
        </main>
    </body>
</html>
