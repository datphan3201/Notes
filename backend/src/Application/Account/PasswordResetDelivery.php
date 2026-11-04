<?php

declare(strict_types=1);

namespace Planner\Application\Account;

interface PasswordResetDelivery
{
    /** $code is the 6-digit alternative to the link (empty when not offered). */
    public function send(string $email, string $url, string $code = ''): void;
}
