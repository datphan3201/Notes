<?php

declare(strict_types=1);

namespace Planner\Application\Account;

interface PasswordResetDelivery
{
    public function send(string $email, string $url): void;
}
