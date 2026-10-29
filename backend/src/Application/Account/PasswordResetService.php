<?php

declare(strict_types=1);

namespace Planner\Application\Account;

use Planner\Http\ValidationException;
use Planner\Http\Security\RateLimiter;
use Planner\Infrastructure\Database\TransactionManager;
use Planner\Infrastructure\Persistence\Pdo\Account\PdoAccountRepository;
use Planner\Infrastructure\Persistence\Pdo\Account\PdoPasswordResetRepository;
use Planner\Support\Clock;
use Planner\Support\Timestamp;
use Psr\Log\LoggerInterface;
use Throwable;

final readonly class PasswordResetService
{
    public function __construct(
        private PdoAccountRepository $accounts,
        private PdoPasswordResetRepository $resets,
        private TransactionManager $transactions,
        private RateLimiter $limits,
        private Clock $clock,
        private PasswordResetDelivery $delivery,
        private LoggerInterface $logger,
        private string $appUrl,
    ) {
    }

    public function request(string $email, string $ip): void
    {
        $this->limits->consume('password-reset-ip', $ip, 10, 3600);
        $this->limits->consume('password-reset-email', $email, 3, 3600);
        $token = bin2hex(random_bytes(32));
        $user = $this->accounts->findByEmail($email);
        if ($user === null) {
            return;
        }
        $this->transactions->run(function () use ($user, $token): void {
            $locked = $this->accounts->findById($user->id, true);
            if ($locked === null) {
                return;
            }
            $this->resets->replace($user->id, hash('sha256', $token), $locked->authVersion,
                Timestamp::database($this->clock->now()->modify('+30 minutes')),
                Timestamp::database($this->clock->now()));
        });
        try {
            $this->delivery->send($email, $this->appUrl.'/reset-password?'.http_build_query(['email' => $email, 'token' => $token]));
        } catch (Throwable) {
            // Never expose delivery status, recipient, reset token or link in HTTP/logs.
            $this->logger->error('Password recovery delivery failed.');
        }
    }

    public function reset(string $email, string $token, string $password, string $ip): void
    {
        $this->limits->consume('password-reset-attempt', $ip, 10, 3600);
        $user = $this->accounts->findByEmail($email);
        $hash = password_hash($password, PASSWORD_BCRYPT);
        $this->transactions->run(function () use ($user, $token, $hash): void {
            $locked = $user === null ? null : $this->accounts->findById($user->id, true);
            $reset = $locked === null ? null : $this->resets->lock($locked->id);
            if ($reset === null || $locked === null
                || !hash_equals($reset['token_hash'], hash('sha256', $token))
                || $reset['expires_at'] <= Timestamp::database($this->clock->now())
                || $reset['auth_version'] !== $locked->authVersion) {
                throw new ValidationException(['token' => ['This reset link is invalid or has expired. Request a new link.']]);
            }
            $this->accounts->updatePasswordAndVersion($locked->id, $hash, $locked->authVersion + 1, Timestamp::database($this->clock->now()));
            $this->accounts->deleteSessions($locked->id);
            $this->resets->delete($locked->id);
        });
    }
}
