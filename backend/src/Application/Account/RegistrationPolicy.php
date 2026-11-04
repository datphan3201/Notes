<?php

declare(strict_types=1);

namespace Planner\Application\Account;

use Planner\Http\ValidationException;
use Planner\Infrastructure\Persistence\Pdo\Admin\PdoRegistrationInviteRepository;
use Planner\Infrastructure\Persistence\Pdo\Admin\PdoSystemSettingRepository;

/** Whether a new account may be created, as set by an administrator. */
final readonly class RegistrationPolicy
{
    public function __construct(
        private PdoSystemSettingRepository $settings,
        private PdoRegistrationInviteRepository $invites,
    ) {
    }

    /** @return 'open'|'invite'|'closed' */
    public function mode(): string
    {
        /** @var 'open'|'invite'|'closed' */
        return $this->settings->registrationMode();
    }

    /** Call inside the registration transaction; an invitation row is locked until commit. */
    public function assertAllowed(string $email): void
    {
        $mode = $this->mode();
        if ($mode === 'closed') {
            throw new ValidationException(['email' => ['Registration is closed. Ask the administrator for an account.']]);
        }
        if ($mode === 'invite') {
            $invite = $this->invites->find($this->normalize($email), true);
            if ($invite === null || $invite['used_at'] !== null) {
                throw new ValidationException(['email' => ['This email has not been invited. Ask the administrator for an invitation.']]);
            }
        }
    }

    public function accepted(string $email, int $userId, string $now): void
    {
        if ($this->invites->find($this->normalize($email)) !== null) {
            $this->invites->markUsed($this->normalize($email), $userId, $now);
        }
    }

    public function normalize(string $email): string
    {
        return strtolower(trim($email));
    }
}
