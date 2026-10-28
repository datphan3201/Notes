<?php

declare(strict_types=1);

namespace Planner\Domain\Account;

final readonly class UserRecord
{
    public function __construct(
        public int $id,
        public string $email,
        public string $displayName,
        public string $passwordHash,
        public ?string $emailVerifiedAt,
        public ?string $avatarPath,
        public int $authVersion,
        public string $biography = '',
        public string $role = 'user',
        public ?string $lockedAt = null,
        public ?string $twoFactorMethod = null,
        public ?string $twoFactorSecret = null,
    ) {
    }

    public function isAdmin(): bool
    {
        return $this->role === 'admin';
    }
}
