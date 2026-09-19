<section class="auth-card" id="main-content" aria-labelledby="auth-title">
    <p class="eyebrow">Start simply</p>
    <h1 id="auth-title">Create an account</h1>
    <p class="auth-intro">Four details are all you need for a private planning workspace.</p>
    <form class="stack-form" action="/register" method="post">
        <input type="hidden" name="_token" value="<?= $view->e($csrf_token) ?>">
        <div class="field">
            <label for="display_name">Display name</label>
            <input id="display_name" name="display_name" type="text" value="<?= $view->e($view->old($old, 'display_name')) ?>" autocomplete="name" maxlength="80" required autofocus>
            <?php if ($message = $view->error($errors, 'display_name')): ?><p class="field-error"><?= $view->e($message) ?></p><?php endif; ?>
        </div>
        <div class="field">
            <label for="email">Email</label>
            <input id="email" name="email" type="email" value="<?= $view->e($view->old($old, 'email')) ?>" autocomplete="email" maxlength="254" required>
            <?php if ($message = $view->error($errors, 'email')): ?><p class="field-error"><?= $view->e($message) ?></p><?php endif; ?>
        </div>
        <div class="field">
            <label for="password">Password</label>
            <input id="password" name="password" type="password" autocomplete="new-password" required>
            <p class="field-hint">At least 10 characters and at most 72 bytes.</p>
            <?php if ($message = $view->error($errors, 'password')): ?><p class="field-error"><?= $view->e($message) ?></p><?php endif; ?>
        </div>
        <div class="field">
            <label for="password_confirmation">Confirm password</label>
            <input id="password_confirmation" name="password_confirmation" type="password" autocomplete="new-password" required>
            <?php if ($message = $view->error($errors, 'password_confirmation')): ?><p class="field-error"><?= $view->e($message) ?></p><?php endif; ?>
        </div>
        <button class="button button-primary button-wide" type="submit">Create account</button>
    </form>
    <p class="auth-switch">Already have an account? <a href="/login">Sign in</a></p>
</section>
