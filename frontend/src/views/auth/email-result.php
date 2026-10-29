<section class="auth-card" id="main-content" aria-labelledby="auth-title">
    <h1 id="auth-title"><?= $view->e($view->t($title)) ?></h1>
    <p class="<?= $success ? 'notice' : 'field-error' ?>" role="<?= $success ? 'status' : 'alert' ?>"><?= $view->e($view->t($message)) ?></p>
    <?php if ($signed_in): ?>
    <a class="button button-primary" href="<?= $success ? '/dashboard' : '/settings/profile' ?>"><?= $view->e($view->t($success ? 'Continue to Planner' : 'Open your profile')) ?></a>
    <?php else: ?>
    <a class="button button-primary" href="/login"><?= $view->e($view->t('Sign in')) ?></a>
    <?php endif; ?>
</section>
