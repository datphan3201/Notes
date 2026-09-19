<section class="auth-card" id="main-content" aria-labelledby="auth-title">
    <p class="eyebrow">Your personal workspace</p>
    <h1 id="auth-title">Welcome back</h1>
    <p class="auth-intro">Sign in to continue with the things you are keeping track of.</p>
    <form class="stack-form" action="/login" method="post">
        <input type="hidden" name="_token" value="<?= $view->e($csrf_token) ?>">
        <div class="field">
            <label for="email">Email</label>
            <input id="email" name="email" type="email" value="<?= $view->e($view->old($old, 'email')) ?>" autocomplete="email" required autofocus>
            <?php if ($message = $view->error($errors, 'email')): ?><p class="field-error"><?= $view->e($message) ?></p><?php endif; ?>
        </div>
        <div class="field">
            <label for="password">Password</label>
            <input id="password" name="password" type="password" autocomplete="current-password" required>
            <?php if ($message = $view->error($errors, 'password')): ?><p class="field-error"><?= $view->e($message) ?></p><?php endif; ?>
        </div>
        <button class="button button-primary button-wide" type="submit">Sign in</button>
    </form>
    <p class="auth-switch">New here? <a href="/register">Create an account</a></p>
</section>
