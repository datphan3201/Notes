<?php

declare(strict_types=1);

namespace Planner\Application\Account;

/** Sends one plain-text email; implementations throw when delivery fails. */
interface MessageDelivery
{
    public function sendMessage(string $email, string $subject, string $body): void;
}
