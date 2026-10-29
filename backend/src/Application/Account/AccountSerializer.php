<?php

declare(strict_types=1);

namespace Planner\Application\Account;

use Planner\Domain\Account\UserRecord;

final class AccountSerializer
{
    /** @return array{id: string, email: string, display_name: string, biography: string, email_verified: bool, avatar_url: ?string, role: string, two_factor_method: ?string} */
    public function user(UserRecord $user): array
    {
        return [
            'id' => (string) $user->id,
            'email' => $user->email,
            'display_name' => $user->displayName,
            'biography' => $user->biography,
            'email_verified' => $user->emailVerifiedAt !== null,
            'avatar_url' => $user->avatarPath === null ? null : '/files/avatar',
            'role' => $user->role,
            'two_factor_method' => $user->twoFactorMethod,
        ];
    }
}
