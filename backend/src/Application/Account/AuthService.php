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

    public function register(string $email, string $displayName, string $password): UserRecord
    {
        try {
            $user = $this->transactions->run(function () use ($email, $displayName, $password): UserRecord {
                $timestamp = $this->timestamp();
                $user = $this->accounts->insertUser(
                    $email,
                    $displayName,
                    password_hash($password, PASSWORD_BCRYPT),
                    $timestamp,
                );
                $this->planning->insertDefaultAreas($user->id, [
                    ['id' => $this->uuid->generate(), 'name' => 'Area 1', 'position' => 0],
                    ['id' => $this->uuid->generate(), 'name' => 'Area 2', 'position' => 1],
                    ['id' => $this->uuid->generate(), 'name' => 'Area 3', 'position' => 2],
                ], $timestamp);

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

    public function attempt(string $email, string $password, string $ipAddress): bool
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

            return false;
        }

        $this->rateLimiter->clear('login-account', $identity);

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

        $this->session->login($user->id, $user->authVersion);

        return true;
    }

    public function currentUser(): ?UserRecord
    {
        $userId = $this->session->userId();

        if ($userId === null) {
            return null;
        }

        $user = $this->accounts->findById($userId);

        if ($user === null || $this->session->authVersion() !== $user->authVersion) {
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
