<?php

declare(strict_types=1);

namespace Planner\Infrastructure\Session;

use Planner\Http\Request;

final class SessionManager
{
    private bool $started = false;

    public function __construct(
        private readonly PdoSessionHandler $handler,
        private readonly bool $secure,
        private readonly int $lifetimeMinutes,
    ) {
    }

    public function start(Request $request): void
    {
        if ($this->started) {
            return;
        }

        if (session_status() === PHP_SESSION_ACTIVE) {
            session_write_close();
        }

        session_name('planner_session');
        ini_set('session.use_strict_mode', '1');
        ini_set('session.use_only_cookies', '1');
        ini_set('session.use_cookies', '1');
        session_set_cookie_params([
            'lifetime' => $this->lifetimeMinutes * 60,
            'path' => '/',
            'domain' => '',
            'secure' => $this->secure,
            'httponly' => true,
            'samesite' => 'Lax',
        ]);
        $this->handler->setRequestMetadata($request->clientIp(), $request->header('user-agent') ?? '');
        session_set_save_handler($this->handler, true);
        session_id('');

        $requestedId = $request->cookies['planner_session'] ?? null;

        if (is_string($requestedId) && preg_match('/^[a-f0-9]{64}$/', $requestedId) === 1) {
            session_id($requestedId);
        }

        session_start();
        $this->started = true;
        $this->handler->setUserId($this->userId());

        if (! isset($_SESSION['_csrf']) || ! is_string($_SESSION['_csrf'])) {
            $_SESSION['_csrf'] = bin2hex(random_bytes(32));
        }
    }

    public function id(): string
    {
        return session_id();
    }

    public function csrfToken(): string
    {
        return (string) ($_SESSION['_csrf'] ?? '');
    }

    public function userId(): ?int
    {
        $value = $_SESSION['user_id'] ?? null;

        return is_int($value) ? $value : null;
    }

    public function authVersion(): ?int
    {
        $value = $_SESSION['auth_version'] ?? null;

        return is_int($value) ? $value : null;
    }

    public function login(int $userId, int $authVersion): void
    {
        session_regenerate_id(true);
        $_SESSION['user_id'] = $userId;
        $_SESSION['auth_version'] = $authVersion;
        $_SESSION['_csrf'] = bin2hex(random_bytes(32));
        $this->handler->setUserId($userId);
    }

    public function invalidate(): void
    {
        $_SESSION = [];
        $this->handler->setUserId(null);

        if (session_status() === PHP_SESSION_ACTIVE) {
            session_destroy();
        }

        setcookie('planner_session', '', [
            'expires' => time() - 3600,
            'path' => '/',
            'secure' => $this->secure,
            'httponly' => true,
            'samesite' => 'Lax',
        ]);
        $this->started = false;
    }

    /**
     * A password-verified login awaiting its second factor. It never sets
     * user_id, so the session stays unauthenticated until the code is checked.
     */
    public function beginTwoFactor(int $userId, int $authVersion): void
    {
        session_regenerate_id(true);
        $_SESSION['two_factor'] = ['user_id' => $userId, 'auth_version' => $authVersion, 'started' => time()];
    }

    /** @return array{user_id:int,auth_version:int}|null pending for at most 10 minutes */
    public function pendingTwoFactor(): ?array
    {
        $pending = $_SESSION['two_factor'] ?? null;
        if (! is_array($pending) || ! is_int($pending['user_id'] ?? null) || time() - (int) ($pending['started'] ?? 0) > 600) {
            return null;
        }

        return ['user_id' => $pending['user_id'], 'auth_version' => (int) $pending['auth_version']];
    }

    public function clearTwoFactor(): void
    {
        unset($_SESSION['two_factor']);
    }

    public function put(string $key, mixed $value): void
    {
        $_SESSION[$key] = $value;
    }

    public function get(string $key, mixed $default = null): mixed
    {
        return $_SESSION[$key] ?? $default;
    }

    public function forget(string $key): void
    {
        unset($_SESSION[$key]);
    }

    public function flash(string $key, mixed $value): void
    {
        $_SESSION['_flash'][$key] = $value;
    }

    public function pullFlash(string $key, mixed $default = null): mixed
    {
        $value = $_SESSION['_flash'][$key] ?? $default;
        unset($_SESSION['_flash'][$key]);

        return $value;
    }

    public function close(): void
    {
        if ($this->started && session_status() === PHP_SESSION_ACTIVE) {
            session_write_close();
        }

        $this->started = false;
    }
}
