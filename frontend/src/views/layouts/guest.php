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
        <a class="skip-link" href="#main-content"><?= $view->e($view->t('Skip to content')) ?></a>
        <main class="guest-shell">
            <section class="guest-story" aria-labelledby="guest-heading">
                <div class="sidebar-brand">
                    <span class="brand-symbol" aria-hidden="true">
                        <span></span>
                        <i></i>
                    </span>
                    <span><?= $view->e($view->t('Planner')) ?></span>
                </div>
                <div class="guest-story-content">
                    <h2 id="guest-heading">
                        <?= $view->e($view->t('Big intentions.')) ?>
                        <br>
                        <?= $view->e($view->t('Small, steady steps.')) ?>
                    </h2>
                    <p><?= $view->e($view->t('Give your goals a direction, your tasks a place, and your progress a little perspective.')) ?></p>
                    <div class="guest-path" aria-label="From goals to daily progress">
                        <div>
                            <svg class="ui-icon" aria-hidden="true"><use href="#icon-goals"/></svg>
                            <span>
                                <strong><?= $view->e($view->t('Find your direction')) ?></strong>
                                <small><?= $view->e($view->t('Goals that matter to you.')) ?></small>
                            </span>
                        </div>
                        <div>
                            <svg class="ui-icon" aria-hidden="true"><use href="#icon-tasks"/></svg>
                            <span>
                                <strong><?= $view->e($view->t('Take the next step')) ?></strong>
                                <small><?= $view->e($view->t('Milestones, tasks, and daily habits.')) ?></small>
                            </span>
                        </div>
                        <div>
                            <svg class="ui-icon" aria-hidden="true"><use href="#icon-reviews"/></svg>
                            <span>
                                <strong><?= $view->e($view->t('See how far you\'ve come')) ?></strong>
                                <small><?= $view->e($view->t('Activity and space to reflect.')) ?></small>
                            </span>
                        </div>
                    </div>
                </div>
                <p class="guest-footnote"><?= $view->e($view->t('Your plans. Your pace.')) ?></p>
            </section>
            <div class="guest-form-region"><?= $content ?></div>
        </main>
    </body>
</html>
