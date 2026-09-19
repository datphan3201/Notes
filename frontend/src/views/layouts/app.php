<?php
$navigation = [
    ['Dashboard', '/dashboard', 'dashboard', ['planning.dashboard']],
    ['Goals', '/goals', 'goals', ['planning.goals', 'planning.goal']],
    ['Tasks', '/tasks', 'tasks', ['planning.tasks', 'planning.task']],
    ['Habits', '/habits', 'habits', ['planning.habits']],
    ['Notes', '/', 'notes', ['notes.index']],
    ['Reviews', '/reviews', 'reviews', ['planning.reviews']],
    ['AI assistant', '/ai', 'ai', ['planning.ai']],
];
$accountNavigation = [
    ['Profile', '/settings/profile', 'profile', ['settings.profile']],
    ['Appearance', '/settings/preferences', 'appearance', ['settings.preferences']],
    ['Password', '/settings/password', 'lock', ['settings.password']],
];
?>
<!doctype html>
<html lang="en" data-theme="<?= $view->e($preferences['theme']) ?>" data-font-size="<?= $view->e($preferences['note_font_size']) ?>">
    <head>
        <meta charset="utf-8">
        <meta name="viewport" content="width=device-width, initial-scale=1">
        <meta name="csrf-token" content="<?= $view->e($csrf_token) ?>">
        <meta id="notes-bootstrap" data-json="<?= $view->jsonAttribute($bootstrap) ?>">
        <title><?= $view->e($title ?? 'Planner') ?> · Planner</title>
        <?= $view->assets() ?>
    </head>
    <body class="app-page">
        <?php require __DIR__.'/icons.php'; ?>
        <a class="skip-link" href="#main-content">Skip to content</a>
        <div class="app-frame">
            <aside class="app-sidebar" id="app-sidebar" aria-label="Primary navigation" tabindex="-1">
                <a class="sidebar-brand" href="/dashboard" data-leave-guard>
                    <span class="brand-symbol" aria-hidden="true"><span></span><i></i></span>
                    <span>Planner<span class="brand-caption">Space to move forward</span></span>
                </a>
                <button class="mobile-sidebar-close icon-button" type="button" data-close-sidebar aria-label="Close navigation"><svg class="ui-icon" aria-hidden="true"><use href="#icon-close"/></svg></button>
                <nav class="sidebar-nav" aria-label="Planning">
                    <div class="sidebar-section-label">Your workspace</div>
                    <?php foreach ($navigation as [$label, $href, $icon, $routes]): ?>
                        <?php $active = in_array($current_route, $routes, true); ?>
                        <a class="nav-link<?= $active ? ' is-active' : '' ?>" href="<?= $view->e($href) ?>"<?= $active ? ' aria-current="page"' : '' ?> data-leave-guard>
                            <svg class="ui-icon nav-icon" aria-hidden="true"><use href="#icon-<?= $view->e($icon) ?>"/></svg><span><?= $view->e($label) ?></span>
                        </a>
                    <?php endforeach; ?>
                </nav>
                <nav class="sidebar-nav account-nav" aria-label="Account">
                    <div class="sidebar-section-label">Account</div>
                    <?php foreach ($accountNavigation as [$label, $href, $icon, $routes]): ?>
                        <?php $active = in_array($current_route, $routes, true); ?>
                        <a class="nav-link<?= $active ? ' is-active' : '' ?>" href="<?= $view->e($href) ?>"<?= $active ? ' aria-current="page"' : '' ?> data-leave-guard>
                            <svg class="ui-icon nav-icon" aria-hidden="true"><use href="#icon-<?= $view->e($icon) ?>"/></svg><span><?= $view->e($label) ?></span>
                        </a>
                    <?php endforeach; ?>
                </nav>
                <div class="sidebar-footer">
                    <a class="sidebar-user" href="/settings/profile" data-leave-guard>
                        <span class="avatar avatar-small" data-avatar-fallback><?= $view->e($view->initial($user['display_name'])) ?></span>
                        <span class="sidebar-user-copy"><strong><?= $view->e($user['display_name']) ?></strong><small>Personal account</small></span>
                    </a>
                    <form action="/logout" method="post" data-leave-guard-form>
                        <input type="hidden" name="_token" value="<?= $view->e($csrf_token) ?>">
                        <button class="icon-button" type="submit" aria-label="Sign out" title="Sign out"><svg class="ui-icon" aria-hidden="true"><use href="#icon-logout"/></svg></button>
                    </form>
                </div>
            </aside>
            <div class="sidebar-scrim" data-close-sidebar></div>
            <div class="app-body" data-app-body>
                <header class="app-topbar">
                    <div class="topbar-location">
                        <button class="mobile-menu-button icon-button" type="button" data-open-sidebar aria-label="Open navigation" aria-controls="app-sidebar" aria-expanded="false"><svg class="ui-icon" aria-hidden="true"><use href="#icon-menu"/></svg></button>
                        <span class="topbar-space">Personal space</span><span class="topbar-divider" aria-hidden="true">/</span><span><?= $view->e($title ?? 'Planner') ?></span>
                    </div>
                    <a class="topbar-settings icon-button" href="/settings/preferences" data-leave-guard aria-label="Appearance settings" title="Appearance settings"><svg class="ui-icon" aria-hidden="true"><use href="#icon-appearance"/></svg></a>
                </header>
                <main class="app-main" id="main-content" tabindex="-1">
                    <?php if (!$user['email_verified']): ?>
                        <div class="notice notice-info account-notice" role="status"><svg class="ui-icon" aria-hidden="true"><use href="#icon-lock"/></svg><span>Your email address has not been verified.</span></div>
                    <?php endif; ?>
                    <?= $content ?>
                </main>
            </div>
        </div>
        <div class="toast-region" data-toast-region aria-live="polite"></div>
    </body>
</html>
