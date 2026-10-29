<?php

declare(strict_types=1);

namespace Planner\Application\Account;

use Planner\Domain\Account\UserRecord;
use Planner\Http\HttpException;
use Planner\Infrastructure\Database\TransactionManager;
use Planner\Infrastructure\Persistence\Pdo\Account\PdoAccountRepository;
use Planner\Support\Clock;

final readonly class AccountService
{
    public function __construct(
        private PdoAccountRepository $accounts,
        private TransactionManager $transactions,
        private Clock $clock,
    ) {
    }

    public function updateDisplayName(int $userId, string $displayName): UserRecord
    {
        return $this->transactions->run(function () use ($userId, $displayName): UserRecord {
            $this->accounts->findById($userId, true) ?? throw new \RuntimeException('Authenticated user disappeared.');

            return $this->accounts->updateDisplayName($userId, $displayName, $this->timestamp());
        });
    }

    public function updateProfile(int $userId, string $displayName, ?string $biography): UserRecord
    {
        return $this->transactions->run(function () use ($userId, $displayName, $biography): UserRecord {
            $this->accounts->findById($userId, true) ?? throw new \RuntimeException('Authenticated user disappeared.');
            $this->accounts->updateDisplayName($userId, $displayName, $this->timestamp());
            if ($biography !== null) {
                $this->accounts->updateBiography($userId, $biography);
            }
            return $this->accounts->findById($userId) ?? throw new \RuntimeException('Authenticated user disappeared.');
        });
    }

    /** @param array<string, string|int|bool> $changes @return array<string, string|int|bool> */
    public function updatePreferences(int $userId, array $changes): array
    {
        return $this->transactions->run(function () use ($userId, $changes): array {
            $this->accounts->findById($userId, true) ?? throw new \RuntimeException('Authenticated user disappeared.');
            if (array_key_exists('background_id', $changes)) {
                if ($changes['background_id'] !== null && $this->accounts->backgroundPath($userId, (string) $changes['background_id']) === null) {
                    throw new HttpException(404, 'NOT_FOUND', 'Background not found.');
                }
                // A chosen image or preset replaces any RGB background color.
                $changes['background_color'] ??= '';
            }

            return $this->accounts->updatePreferences($userId, $changes, $this->timestamp());
        });
    }

    /** @return array<string, string|int|bool> */
    public function preferences(int $userId): array
    {
        return $this->accounts->preferences($userId);
    }

    public function dismissWalkthrough(int $userId): void
    {
        $this->transactions->run(function () use ($userId): void {
            $this->accounts->findById($userId, true) ?? throw new \RuntimeException('Authenticated user disappeared.');
            $this->accounts->dismissWalkthrough($userId, $this->timestamp());
        });
    }

    private function timestamp(): string
    {
        return $this->clock->now()->format('Y-m-d H:i:s.u');
    }
}
