<?php

declare(strict_types=1);

namespace Planner\Application\Account;

use Planner\Domain\Account\UserRecord;

final class AccountSerializer
{
    /** @return array{id: string, email: string, display_name: string, email_verified: bool, avatar_url: ?string} */
    public function user(UserRecord $user): array
    {
        return [
            'id' => (string) $user->id,
            'email' => $user->email,
            'display_name' => $user->displayName,
            'email_verified' => $user->emailVerifiedAt !== null,
            'avatar_url' => $user->avatarPath === null ? null : '/files/avatar',
        ];
    }
}
