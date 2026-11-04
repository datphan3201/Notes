<?php

declare(strict_types=1);

namespace Planner\Application\Admin;

use Planner\Domain\Account\UserRecord;
use Planner\Http\HttpException;
use Planner\Http\ValidationException;
use Planner\Infrastructure\Database\TransactionManager;
use Planner\Infrastructure\Persistence\Pdo\Account\PdoAccountRepository;
use Planner\Support\Clock;
use Planner\Support\Timestamp;

/**
 * Locking signs the account out everywhere and hides its shared Notes from recipients until it
 * is unlocked. Administrators cannot be locked here: their role is granted and removed only
 * through the server console, so one administrator cannot shut another out.
 */
final readonly class AccountLockService
{
    public function __construct(
        private PdoAccountRepository $accounts,
        private AdminActionLog $log,
        private TransactionManager $transactions,
        private Clock $clock,
    ) {
    }

    public function lock(int $adminId, int $userId, ?string $reason): void
    {
        $this->guard($adminId, $userId);
        $this->transactions->run(function () use ($adminId, $userId, $reason): void {
            $user = $this->target($userId);
            if ($user->isAdmin()) {
                throw new ValidationException(['user' => ['Administrators cannot be locked here. Remove the admin role with the server console first.']]);
            }
            if ($user->lockedAt !== null) {
                return;
            }
            $now = Timestamp::database($this->clock->now());
            $this->accounts->setLocked($userId, $now, $reason, $now, $adminId);
            $this->accounts->deleteSessions($userId);
            $this->log->record($adminId, 'account.lock', 'user', (string) $userId, $user->email.($reason === null ? '' : ' — '.$reason));
        });
    }

    public function unlock(int $adminId, int $userId): void
    {
        $this->guard($adminId, $userId);
        $this->transactions->run(function () use ($adminId, $userId): void {
            $user = $this->target($userId);
            if ($user->lockedAt === null) {
                return;
            }
            $now = Timestamp::database($this->clock->now());
            $this->accounts->setLocked($userId, null, null, $now);
            $this->log->record($adminId, 'account.unlock', 'user', (string) $userId, $user->email);
        });
    }

    public function isLocked(int $userId): bool
    {
        return $this->accounts->findById($userId)?->lockedAt !== null;
    }

    private function guard(int $adminId, int $userId): void
    {
        if ($adminId === $userId) {
            throw new ValidationException(['user' => ['You cannot lock your own account.']]);
        }
    }

    private function target(int $userId): UserRecord
    {
        return $this->accounts->findById($userId, true) ?? throw new HttpException(404, 'NOT_FOUND', 'The requested resource was not found.');
    }
}
