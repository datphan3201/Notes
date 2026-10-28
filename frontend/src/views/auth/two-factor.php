<section class="auth-card" id="main-content" aria-labelledby="auth-title">
    <h1 id="auth-title"><?= $view->e($view->t('Two-step verification')) ?></h1>
    <p><?= $view->e($view->t($method === 'totp' ? 'Enter the six-digit code from your authenticator app.' : 'Enter the six-digit code we sent to your email address.')) ?></p>
    <?php if ($status !== null): ?><p class="notice" role="status"><?= $view->e($view->t($status)) ?></p><?php endif; ?>
    <?php foreach ($errors as $messages): ?>
        <?php foreach ($messages as $message): ?><p class="field-error" role="alert"><?= $view->e($view->t($message)) ?></p><?php endforeach; ?>
    <?php endforeach; ?>
    <form class="stack-form" method="post" action="/two-factor">
        <input type="hidden" name="_token" value="<?= $view->e($csrf_token) ?>">
        <label><?= $view->e($view->t('Verification code')) ?> <input name="code" inputmode="numeric" autocomplete="one-time-code" pattern="[0-9 ]{6,7}" maxlength="7" required autofocus></label>
        <button class="button button-primary" type="submit"><?= $view->e($view->t('Verify')) ?></button>
    </form>
    <form method="post" action="/two-factor/email">
        <input type="hidden" name="_token" value="<?= $view->e($csrf_token) ?>">
        <button class="text-button" type="submit"><?= $view->e($view->t($method === 'totp' ? 'Email me a code instead' : 'Send a new code')) ?></button>
    </form>
    <a href="/login"><?= $view->e($view->t('Back to sign in')) ?></a>
</section>
