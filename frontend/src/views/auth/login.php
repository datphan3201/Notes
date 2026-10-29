<section class="auth-card" id="main-content" aria-labelledby="auth-title">
    <p class="eyebrow"><?= $view->e($view->t('Your personal workspace')) ?></p>
    <h1 id="auth-title"><?= $view->e($view->t('Welcome back')) ?></h1>
    <p class="auth-intro"><?= $view->e($view->t('Sign in to continue with the things you are keeping track of.')) ?></p>
    <form class="stack-form" action="/login" method="post">
        <input type="hidden" name="_token" value="<?= $view->e($csrf_token) ?>">
        <div class="field">
            <label for="email"><?= $view->e($view->t('Email')) ?></label>
            <input id="email" name="email" type="email" value="<?= $view->e($view->old($old, 'email')) ?>" autocomplete="email" required autofocus>
            <?php if ($message = $view->error($errors, 'email')): ?>
            <p class="field-error"><?= $view->e($view->t($message)) ?></p>
            <?php endif; ?>
        </div>
        <div class="field">
            <label for="password"><?= $view->e($view->t('Password')) ?></label>
            <input id="password" name="password" type="password" autocomplete="current-password" required>
            <?php if ($message = $view->error($errors, 'password')): ?>
            <p class="field-error"><?= $view->e($view->t($message)) ?></p>
            <?php endif; ?>
        </div>
        <button class="button button-primary button-wide" type="submit"><?= $view->e($view->t('Sign in')) ?></button>
    </form>
    <p><a href="/forgot-password"><?= $view->e($view->t('Forgot password?')) ?></a></p>
    <p class="auth-switch">
        <?= $view->e($view->t('New here?')) ?>
        <a href="/register"><?= $view->e($view->t('Create an account')) ?></a>
    </p>
</section>
