<?php
$navigation = [
    ['Dashboard', '/dashboard', 'dashboard', ['planning.dashboard']],
    ['Goals', '/goals', 'goals', ['planning.goals', 'planning.goal']],
    ['Tasks', '/tasks', 'tasks', ['planning.tasks', 'planning.task']],
    ['Habits', '/habits', 'habits', ['planning.habits']],
    ['Notes', '/', 'notes', ['notes.index']],
    ['Reviews', '/reviews', 'reviews', ['planning.reviews']],
    ['Teamwork', '/teamwork', 'profile', ['planning.teamwork']],
];
if (($user['role'] ?? 'user') === 'admin') {
    $navigation[] = ['Administration', '/admin', 'lock', ['admin.index']];
}
$accountNavigation = [
    ['Profile', '/settings/profile', 'profile', ['settings.profile']],
    ['Appearance', '/settings/preferences', 'appearance', ['settings.preferences']],
    ['Security', '/settings/password', 'lock', ['settings.password']],
    ['Notifications', '/settings/notifications', 'calendar', ['settings.notifications']],
    ['Task history', '/settings/history', 'tasks', ['settings.history']],
];
?>
<!doctype html>
<html lang="<?= $view->e($preferences['locale']) ?>" data-theme="<?= $view->e($preferences['theme']) ?>" data-font-size="<?= $view->e($preferences['note_font_size']) ?>" data-visual-theme="<?= $view->e($preferences['visual_theme']) ?>" data-show-background="<?= $preferences['show_background'] ? 'true' : 'false' ?>" data-show-illustrations="<?= $preferences['show_illustrations'] ? 'true' : 'false' ?>" data-show-quote="<?= $preferences['show_quote'] ? 'true' : 'false' ?>">
    <head>
        <meta charset="utf-8">
        <meta name="viewport" content="width=device-width, initial-scale=1">
        <meta name="csrf-token" content="<?= $view->e($csrf_token) ?>">
        <meta id="notes-bootstrap" data-json="<?= $view->jsonAttribute($bootstrap) ?>">
        <title><?= $view->e($view->t($title ?? 'Planner')) ?> · Planner</title>
        <?= $view->assets() ?>
    </head>
    <body class="app-page">
        <?php require __DIR__.'/icons.php'; ?>
        <a class="skip-link" href="#main-content"><?= $view->e($view->t('Skip to content')) ?></a>
        <div class="app-frame">
            <aside class="app-sidebar" id="app-sidebar" aria-label="<?= $view->e($view->t('Primary navigation')) ?>" tabindex="-1">
                <a class="sidebar-brand" href="/dashboard" data-leave-guard>
                    <span class="brand-symbol" aria-hidden="true">
                        <span></span>
                        <i></i>
                    </span>
                    <span>
                        <?= $view->e($view->t('Planner')) ?>
                        <span class="brand-caption"><?= $view->e($view->t('Space to move forward')) ?></span>
                    </span>
                </a>
                <button class="mobile-sidebar-close icon-button" type="button" data-close-sidebar aria-label="<?= $view->e($view->t('Close navigation')) ?>">
                    <svg class="ui-icon" aria-hidden="true"><use href="#icon-close"/></svg>
                </button>
                <nav class="sidebar-nav" aria-label="<?= $view->e($view->t('Planning')) ?>">
                    <div class="sidebar-section-label"><?= $view->e($view->t('Your workspace')) ?></div>
                    <?php foreach ($navigation as [$label, $href, $icon, $routes]): ?>
                        <?php $active = in_array($current_route, $routes, true); ?>
                    <a class="nav-link<?= $active ? ' is-active' : '' ?>" href="<?= $view->e($href) ?>"<?= $active ? ' aria-current="page"' : '' ?> data-leave-guard>
                        <svg class="ui-icon nav-icon" aria-hidden="true"><use href="#icon-<?= $view->e($icon) ?>"/></svg>
                        <span><?= $view->e($view->t($label)) ?></span>
                    </a>
                    <?php endforeach; ?>
                </nav>
                <nav class="sidebar-nav account-nav" aria-label="<?= $view->e($view->t('Account')) ?>">
                    <details class="settings-navigation"<?= str_starts_with($current_route, 'settings.') ? ' open' : '' ?>>
                        <summary class="nav-link"><?= $view->e($view->t('Settings')) ?></summary>
                    <?php foreach ($accountNavigation as [$label, $href, $icon, $routes]): ?>
                        <?php $active = in_array($current_route, $routes, true); ?>
                    <a class="nav-link<?= $active ? ' is-active' : '' ?>" href="<?= $view->e($href) ?>"<?= $active ? ' aria-current="page"' : '' ?> data-leave-guard>
                        <svg class="ui-icon nav-icon" aria-hidden="true"><use href="#icon-<?= $view->e($icon) ?>"/></svg>
                        <span><?= $view->e($view->t($label)) ?></span>
                    </a>
                    <?php endforeach; ?>
                    </details>
                </nav>
                <div class="sidebar-footer">
                    <a class="sidebar-user" href="/settings/profile" data-leave-guard>
                        <span class="avatar avatar-small" data-avatar-fallback><?= $view->e($view->initial($user['display_name'])) ?></span>
                        <span class="sidebar-user-copy">
                            <strong><?= $view->e($user['display_name']) ?></strong>
                            <small><?= $view->e($view->t($user['email_verified'] ? 'Personal account' : 'Verify your email')) ?></small>
                        </span>
                    </a>
                    <form action="/logout" method="post" data-leave-guard-form>
                        <input type="hidden" name="_token" value="<?= $view->e($csrf_token) ?>">
                        <button class="icon-button" type="submit" aria-label="<?= $view->e($view->t('Sign out')) ?>" title="<?= $view->e($view->t('Sign out')) ?>">
                            <svg class="ui-icon" aria-hidden="true"><use href="#icon-logout"/></svg>
                        </button>
                    </form>
                </div>
            </aside>
            <div class="sidebar-scrim" data-close-sidebar></div>
            <div class="app-body" data-app-body>
                <header class="app-topbar">
                    <div class="topbar-location">
                        <button class="mobile-menu-button icon-button" type="button" data-open-sidebar aria-label="<?= $view->e($view->t('Open navigation')) ?>" aria-controls="app-sidebar" aria-expanded="false">
                            <svg class="ui-icon" aria-hidden="true"><use href="#icon-menu"/></svg>
                        </button>
                        <span class="topbar-space"><?= $view->e($view->t('Personal space')) ?></span>
                        <span class="topbar-divider" aria-hidden="true">/</span>
                        <span><?= $view->e($view->t($title ?? 'Planner')) ?></span>
                    </div>
                    <div class="topbar-actions">
                        <div class="notification-menu" data-notifications>
                            <button class="icon-button notification-bell" type="button" data-notifications-toggle aria-expanded="false" aria-controls="notification-panel" aria-label="<?= $view->e($view->t('Notifications')) ?>" title="<?= $view->e($view->t('Notifications')) ?>">
                                <svg class="ui-icon" aria-hidden="true" viewBox="0 0 24 24"><path d="M6 9a6 6 0 1 1 12 0c0 5 2 6.5 2 6.5H4S6 14 6 9Z" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linejoin="round"/><path d="M10 19a2 2 0 0 0 4 0" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round"/></svg>
                                <span class="notification-count" data-notifications-count hidden></span>
                            </button>
                            <section class="notification-panel planning-panel" id="notification-panel" data-notifications-panel hidden aria-label="<?= $view->e($view->t('Notifications')) ?>">
                                <header class="section-heading">
                                    <h2><?= $view->e($view->t('Notifications')) ?></h2>
                                    <button class="text-button" type="button" data-notifications-read-all><?= $view->e($view->t('Mark all read')) ?></button>
                                </header>
                                <div class="notification-list" data-notifications-list role="status"></div>
                            </section>
                        </div>
                        <button class="icon-button" type="button" data-open-walkthrough aria-label="<?= $view->e($view->t('Open walkthrough')) ?>" aria-haspopup="dialog" title="<?= $view->e($view->t('Help and walkthrough')) ?>">?</button>
                        <button class="topbar-settings icon-button" type="button" data-toggle-theme aria-label="<?= $view->e($view->t('Toggle light and dark')) ?>" title="<?= $view->e($view->t('Toggle light and dark')) ?>">
                            <svg class="ui-icon" aria-hidden="true"><use href="#icon-appearance"/></svg>
                        </button>
                    </div>
                </header>
                <main class="app-main" id="main-content" tabindex="-1">
                    <?= $content ?>
                </main>
            </div>
        </div>
        <button class="assistant-launcher" type="button" data-assistant-open aria-haspopup="dialog" aria-label="<?= $view->e($view->t('Ask the AI assistant')) ?>" title="<?= $view->e($view->t('AI assistant')) ?>">
            <svg class="ui-icon" aria-hidden="true"><use href="#icon-ai"/></svg>
        </button>
        <dialog class="workspace-dialog assistant-dialog" data-assistant-dialog aria-labelledby="assistant-title">
            <header class="section-heading">
                <h2 id="assistant-title"><?= $view->e($view->t('AI assistant')) ?></h2>
                <button class="icon-button" type="button" data-assistant-close aria-label="<?= $view->e($view->t('Close')) ?>">×</button>
            </header>
            <p class="subtle-copy" data-assistant-status><?= $view->e($view->t('Ask anything about your goals, tasks and habits. The assistant only reads a summary and never changes your data.')) ?></p>
            <div class="assistant-log" data-assistant-log aria-live="polite"></div>
            <form class="assistant-form" data-assistant-form>
                <label class="sr-only" for="assistant-question"><?= $view->e($view->t('Your question')) ?></label>
                <textarea id="assistant-question" name="question" rows="2" maxlength="2000" required placeholder="<?= $view->e($view->t('What should I focus on this week?')) ?>"></textarea>
                <button class="assistant-send" type="submit" aria-label="<?= $view->e($view->t('Ask')) ?>" title="<?= $view->e($view->t('Ask')) ?>">
                    <svg class="ui-icon" aria-hidden="true"><use href="#icon-arrow"/></svg>
                </button>
            </form>
        </dialog>
        <div class="toast-region" data-toast-region aria-live="polite"></div>
        <?php require __DIR__.'/walkthrough.php'; ?>
    </body>
</html>
