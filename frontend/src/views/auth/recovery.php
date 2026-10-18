<section class="auth-card" id="main-content" aria-labelledby="auth-title">
    <h1 id="auth-title"><?= $reset ? 'Reset password' : 'Forgot password?' ?></h1>
    <p><?= $reset ? 'Choose a new password. You will need to sign in again on every device.' : 'Enter your account email to request a reset link.' ?></p>
    <?php if ($notice !== ''): ?><p class="notice" role="status"><?= $view->e($notice) ?></p><?php endif; ?>
    <?php foreach ($errors as $messages): ?>
        <?php foreach ($messages as $message): ?><p class="field-error" role="alert"><?= $view->e($message) ?></p><?php endforeach; ?>
    <?php endforeach; ?>
    <form class="stack-form" method="post" action="<?= $reset ? '/reset-password' : '/forgot-password' ?>">
        <input type="hidden" name="_token" value="<?= $view->e($csrf_token) ?>">
        <label><?= $view->e($view->t('Email')) ?> <input name="email" type="email" autocomplete="email" value="<?= $view->e($email) ?>" required></label>
        <?php if ($reset): ?>
            <input type="hidden" name="token" value="<?= $view->e($token) ?>">
            <label><?= $view->e($view->t('New password')) ?> <input id="reset-password" type="password" name="password" autocomplete="new-password" minlength="10" required></label>
            <label><?= $view->e($view->t('Confirm password')) ?> <input id="reset-password-confirmation" type="password" name="password_confirmation" autocomplete="new-password" minlength="10" required></label>
        <?php endif; ?>
        <button class="button button-primary" type="submit"><?= $reset ? 'Reset password' : 'Send reset link' ?></button>
    </form>
    <a href="/login"><?= $view->e($view->t('Back to sign in')) ?></a>
</section>
