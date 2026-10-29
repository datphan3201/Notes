<?php

declare(strict_types=1);

namespace Planner\Application\Account;

use PDOException;
use Planner\Domain\Account\UserRecord;
use Planner\Http\HttpException;
use Planner\Http\Security\RateLimiter;
use Planner\Http\ValidationException;
use Planner\Infrastructure\Database\TransactionManager;
use Planner\Infrastructure\Persistence\Pdo\Account\PdoAccountRepository;
use Planner\Infrastructure\Persistence\Pdo\Planning\PdoPlanningRepository;
use Planner\Infrastructure\Session\SessionManager;
use Planner\Support\Clock;
use Planner\Support\UuidGenerator;

final readonly class AuthService
{
    private const GENERIC_CREDENTIAL_ERROR = 'The email or password is incorrect.';

    private string $dummyHash;

    public function __construct(
        private PdoAccountRepository $accounts,
        private TransactionManager $transactions,
        private SessionManager $session,
        private RateLimiter $rateLimiter,
        private Clock $clock,
        private PdoPlanningRepository $planning,
        private UuidGenerator $uuid,
    ) {
        $this->dummyHash = password_hash('dummy password used only to equalize login timing', PASSWORD_BCRYPT);
    }

    public function register(string $email, string $displayName, string $password, string $locale = 'en'): UserRecord
    {
        $locale = in_array($locale, ['en', 'vi'], true) ? $locale : 'en';
        try {
            $user = $this->transactions->run(function () use ($email, $displayName, $password, $locale): UserRecord {
                $timestamp = $this->timestamp();
                $user = $this->accounts->insertUser(
                    $email,
                    $displayName,
                    password_hash($password, PASSWORD_BCRYPT),
                    $timestamp,
                );
                // Placeholder Areas follow the language chosen before sign-up and stay editable.
                $areaName = $locale === 'vi' ? 'Lĩnh vực' : 'Area';
                $this->planning->insertDefaultAreas($user->id, [
                    ['id' => $this->uuid->generate(), 'name' => "$areaName 1", 'position' => 0],
                    ['id' => $this->uuid->generate(), 'name' => "$areaName 2", 'position' => 1],
                    ['id' => $this->uuid->generate(), 'name' => "$areaName 3", 'position' => 2],
                ], $timestamp);
                if ($locale !== 'en') {
                    $this->accounts->updatePreferences($user->id, ['locale' => $locale], $timestamp);
                }

                return $user;
            });
        } catch (PDOException $exception) {
            if ((string) $exception->getCode() === '23000') {
                throw new ValidationException(['email' => ['This email address is already registered.']]);
            }

            throw $exception;
        }

        $this->session->login($user->id, $user->authVersion);

        return $user;
    }

    /** @return 'failed'|'authenticated'|'two_factor' */
    public function attempt(string $email, string $password, string $ipAddress): string
    {
        $identity = strtolower($email).'|'.$ipAddress;
        $this->rateLimiter->assertAvailable('login-account', $identity, 5);
        $this->rateLimiter->assertAvailable('login-ip', $ipAddress, 20);
        $user = $this->accounts->findByEmail($email);
        $hash = $user?->passwordHash ?? $this->dummyHash;
        $valid = password_verify($password, $hash) && $user !== null;

        if (! $valid) {
            $this->rateLimiter->hit('login-account', $identity, 60);
            $this->rateLimiter->hit('login-ip', $ipAddress, 60);

            return 'failed';
        }

        $this->rateLimiter->clear('login-account', $identity);

        if ($user->lockedAt !== null) {
            throw new ValidationException(['email' => ['This account has been locked by an administrator.']]);
        }

        if (password_needs_rehash($user->passwordHash, PASSWORD_BCRYPT)) {
            $this->transactions->run(function () use ($user, $password): void {
                $locked = $this->accounts->findById($user->id, true) ?? throw new \RuntimeException('User disappeared.');
                $this->accounts->updatePasswordAndVersion(
                    $locked->id,
                    password_hash($password, PASSWORD_BCRYPT),
                    $locked->authVersion,
                    $this->timestamp(),
                );
            });
        }

        if ($user->twoFactorMethod !== null) {
            $this->session->beginTwoFactor($user->id, $user->authVersion);

            return 'two_factor';
        }

        $this->session->login($user->id, $user->authVersion);

        return 'authenticated';
    }

    /** The password-verified account awaiting its second factor, if still valid. */
    public function pendingTwoFactorUser(): ?UserRecord
    {
        $pending = $this->session->pendingTwoFactor();
        if ($pending === null) {
            return null;
        }
        $user = $this->accounts->findById($pending['user_id']);

        return $user !== null && $user->lockedAt === null && $user->authVersion === $pending['auth_version'] && $user->twoFactorMethod !== null
            ? $user
            : null;
    }

    public function completeTwoFactor(UserRecord $user): void
    {
        $this->session->clearTwoFactor();
        $this->session->login($user->id, $user->authVersion);
    }

    public function currentUser(): ?UserRecord
    {
        $userId = $this->session->userId();

        if ($userId === null) {
            return null;
        }

        $user = $this->accounts->findById($userId);

        if ($user === null || $user->lockedAt !== null || $this->session->authVersion() !== $user->authVersion) {
            $this->session->invalidate();

            return null;
        }

        return $user;
    }

    public function requireUser(): UserRecord
    {
        return $this->currentUser()
            ?? throw new HttpException(401, 'AUTH_REQUIRED', 'You must sign in to continue.');
    }

    /** Non-admins receive 404 so the admin surface is not disclosed. */
    public function requireAdmin(): UserRecord
    {
        $user = $this->requireUser();
        if (! $user->isAdmin()) {
            throw new HttpException(404, 'NOT_FOUND', 'The requested resource was not found.');
        }

        return $user;
    }

    public function logout(): void
    {
        $this->session->invalidate();
    }

    public function changePassword(UserRecord $user, string $currentPassword, string $newPassword): void
    {
        $this->transactions->run(function () use ($user, $currentPassword, $newPassword): void {
            $locked = $this->accounts->findById($user->id, true)
                ?? throw new HttpException(404, 'NOT_FOUND', 'The account was not found.');

            if (! password_verify($currentPassword, $locked->passwordHash)) {
                throw new ValidationException(['current_password' => ['The current password is incorrect.']]);
            }

            $this->accounts->updatePasswordAndVersion(
                $locked->id,
                password_hash($newPassword, PASSWORD_BCRYPT),
                $locked->authVersion + 1,
                $this->timestamp(),
            );
            $this->accounts->deleteSessions($locked->id);
        });

        $this->session->invalidate();
    }

    private function timestamp(): string
    {
        return $this->clock->now()->format('Y-m-d H:i:s.u');
    }
}
