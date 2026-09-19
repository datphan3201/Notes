<?php

declare(strict_types=1);

namespace Planner\Application\Account;

use Planner\Domain\Account\UserRecord;
use Planner\Infrastructure\Database\TransactionManager;
use Planner\Infrastructure\Persistence\Pdo\Account\PdoAccountRepository;
use Planner\Support\Clock;

final readonly class AccountService
{
    public function __construct(
        private PdoAccountRepository $accounts,
        private TransactionManager $transactions,
        private Clock $clock,
    ) {}

    public function updateDisplayName(int $userId, string $displayName): UserRecord
    {
        return $this->transactions->run(function () use ($userId, $displayName): UserRecord {
            $this->accounts->findById($userId, true) ?? throw new \RuntimeException('Authenticated user disappeared.');

            return $this->accounts->updateDisplayName($userId, $displayName, $this->timestamp());
        });
    }

    /** @param array<string, string|int> $changes @return array<string, string|int> */
    public function updatePreferences(int $userId, array $changes): array
    {
        return $this->transactions->run(function () use ($userId, $changes): array {
            $this->accounts->findById($userId, true) ?? throw new \RuntimeException('Authenticated user disappeared.');

            return $this->accounts->updatePreferences($userId, $changes, $this->timestamp());
        });
    }

    /** @return array<string, string|int> */
    public function preferences(int $userId): array
    {
        return $this->accounts->preferences($userId);
    }

    private function timestamp(): string
    {
        return $this->clock->now()->format('Y-m-d H:i:s.u');
    }
}
