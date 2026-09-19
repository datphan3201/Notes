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
    ) {}
}
