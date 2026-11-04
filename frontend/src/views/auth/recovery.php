<section class="auth-card" id="main-content" aria-labelledby="auth-title">
    <h1 id="auth-title"><?= $view->e($view->t($reset ? 'Reset password' : 'Forgot password?')) ?></h1>
    <p><?= $view->e($view->t($reset ? 'Choose a new password. You will need to sign in again on every device.' : 'Enter your account email to request a reset link.')) ?></p>
    <?php if ($notice !== ''): ?><p class="notice" role="status"><?= $view->e($view->t($notice)) ?></p><?php endif; ?>
    <?php foreach ($errors as $messages): ?>
        <?php foreach ($messages as $message): ?><p class="field-error" role="alert"><?= $view->e($view->t($message)) ?></p><?php endforeach; ?>
    <?php endforeach; ?>
    <form class="stack-form" method="post" action="<?= $reset ? '/reset-password' : '/forgot-password' ?>">
        <input type="hidden" name="_token" value="<?= $view->e($csrf_token) ?>">
        <label><?= $view->e($view->t('Email')) ?> <input name="email" type="email" autocomplete="email" value="<?= $view->e($email) ?>" required></label>
        <?php if ($reset): ?>
            <input type="hidden" name="token" value="<?= $view->e($token) ?>">
            <label><?= $view->e($view->t('New password')) ?> <input id="reset-password" type="password" name="password" autocomplete="new-password" minlength="10" required></label>
            <label><?= $view->e($view->t('Confirm password')) ?> <input id="reset-password-confirmation" type="password" name="password_confirmation" autocomplete="new-password" minlength="10" required></label>
        <?php endif; ?>
        <button class="button button-primary" type="submit"><?= $view->e($view->t($reset ? 'Reset password' : 'Send reset link')) ?></button>
        </form>
    <?php if (! $reset): ?>
        <div class="auth-divider" role="presentation"><span><?= $view->e($view->t('or')) ?></span></div>
        <form class="stack-form" method="post" action="/forgot-password/code" aria-labelledby="code-title">
            <h2 id="code-title" class="auth-subtitle"><?= $view->e($view->t('Have a code from the email?')) ?></h2>
            <input type="hidden" name="_token" value="<?= $view->e($csrf_token) ?>">
            <label><?= $view->e($view->t('Email')) ?> <input name="email" type="email" autocomplete="email" value="<?= $view->e($code_email ?? '') ?>" required></label>
            <label><?= $view->e($view->t('6-digit code')) ?> <input name="code" inputmode="numeric" autocomplete="one-time-code" pattern="[0-9 ]{6,7}" maxlength="7" required<?= ($code_email ?? '') !== '' ? ' autofocus' : '' ?>></label>
            <button class="button button-quiet" type="submit"><?= $view->e($view->t('Continue with code')) ?></button>
        </form>
    <?php endif; ?>
        <a href="/login"><?= $view->e($view->t('Back to sign in')) ?></a>
    </section>
