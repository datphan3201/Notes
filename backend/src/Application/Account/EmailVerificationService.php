<?php

declare(strict_types=1);

namespace Planner\Application\Account;

use PDOException;
use Planner\Domain\Account\UserRecord;
use Planner\Http\HttpException;
use Planner\Http\Security\RateLimiter;
use Planner\Http\ValidationException;
use Planner\Infrastructure\Database\TransactionManager;
use Planner\Infrastructure\Persistence\Pdo\Account\PdoAccountRepository;
use Planner\Infrastructure\Persistence\Pdo\Account\PdoEmailTokenRepository;
use Planner\Support\Clock;
use Planner\Support\Timestamp;
use Psr\Log\LoggerInterface;
use Throwable;

/**
 * Email ownership: a link proves the address on registration, and an email
 * change only takes effect once the new address follows its own link.
 */
final readonly class EmailVerificationService
{
    private const INVALID_LINK = 'This link is invalid or has expired. Request a new one from your profile.';

    public function __construct(
        private PdoAccountRepository $accounts,
        private PdoEmailTokenRepository $tokens,
        private TransactionManager $transactions,
        private RateLimiter $limits,
        private Clock $clock,
        private MessageDelivery $delivery,
        private LoggerInterface $logger,
        private string $appUrl,
    ) {
    }

    /** Sends a verification link unless the address is already verified. Throws when delivery fails. */
    public function sendVerification(int $userId): void
    {
        $user = $this->accounts->findById($userId) ?? throw new HttpException(404, 'NOT_FOUND', 'Account not found.');
        if ($user->emailVerifiedAt !== null) {
            return;
        }
        $this->limits->consume('email-verification', (string) $userId, 5, 3600);
        $token = $this->issue($userId, 'verify', $user->email, '+24 hours');
        $this->delivery->sendMessage(
            $user->email,
            'Confirm your Planner email address',
            "Hello {$user->displayName},\n\nConfirm that this is your email address by opening this link within 24 hours:\n\n"
                .$this->appUrl.'/verify-email?'.http_build_query(['token' => $token])
                ."\n\nIf you did not create a Planner account, ignore this message.\n",
        );
    }

    /** Registration must not fail because mail is unavailable; the profile offers a resend. */
    public function sendVerificationQuietly(int $userId): void
    {
        try {
            $this->sendVerification($userId);
        } catch (Throwable $error) {
            $this->logger->warning('Verification email was not sent.', ['error' => $error->getMessage()]);
        }
    }

    public function verify(string $token): UserRecord
    {
        $hash = $this->hash($token);

        return $this->transactions->run(function () use ($hash): UserRecord {
            $row = $this->tokens->findByHash($hash, true);
            $user = $row === null ? null : $this->accounts->findById($row['user_id'], true);
            if ($row === null || $user === null || $row['purpose'] !== 'verify' || $this->expired($row['expires_at'])
                || strtolower($row['email']) !== strtolower($user->email)) {
                throw new ValidationException(['token' => [self::INVALID_LINK]]);
            }
            $this->accounts->markEmailVerified($user->id, $this->now());
            $this->tokens->delete($user->id, 'verify');

            return $this->accounts->findById($user->id) ?? $user;
        });
    }

    /** Sends a confirmation link to the new address; the current address stays until it is followed. */
    public function requestChange(int $userId, string $password, string $email): void
    {
        $user = $this->accounts->findById($userId) ?? throw new HttpException(404, 'NOT_FOUND', 'Account not found.');
        if (!password_verify($password, $user->passwordHash)) {
            throw new ValidationException(['current_password' => ['The current password is incorrect.']]);
        }
        if (strtolower($email) === strtolower($user->email)) {
            throw new ValidationException(['email' => ['This is already your email address.']]);
        }
        if ($this->accounts->findByEmail($email) !== null) {
            throw new ValidationException(['email' => ['This email address is already registered.']]);
        }
        $this->limits->consume('email-change', (string) $userId, 5, 3600);
        $token = $this->issue($userId, 'change', $email, '+1 hour');
        $this->delivery->sendMessage(
            $email,
            'Confirm your new Planner email address',
            "Hello {$user->displayName},\n\nOpen this link within one hour to use this address to sign in to Planner:\n\n"
                .$this->appUrl.'/confirm-email?'.http_build_query(['token' => $token])
                ."\n\nIf you did not ask for this change, ignore this message; nothing will change.\n",
        );
    }

    public function confirmChange(string $token): UserRecord
    {
        $hash = $this->hash($token);
        [$user, $previous] = $this->transactions->run(function () use ($hash): array {
            $row = $this->tokens->findByHash($hash, true);
            $user = $row === null ? null : $this->accounts->findById($row['user_id'], true);
            if ($row === null || $user === null || $row['purpose'] !== 'change' || $this->expired($row['expires_at'])) {
                throw new ValidationException(['token' => [self::INVALID_LINK]]);
            }
            $owner = $this->accounts->findByEmail($row['email']);
            if ($owner !== null && $owner->id !== $user->id) {
                throw new ValidationException(['email' => ['This email address is already registered.']]);
            }
            try {
                $this->accounts->updateEmail($user->id, $row['email'], $this->now());
            } catch (PDOException $exception) {
                if ((string) $exception->getCode() === '23000') {
                    throw new ValidationException(['email' => ['This email address is already registered.']]);
                }
                throw $exception;
            }
            $this->tokens->delete($user->id, 'change');
            // A pending verification for the old address no longer applies.
            $this->tokens->delete($user->id, 'verify');

            return [$this->accounts->findById($user->id) ?? $user, $user->email];
        });
        try {
            $this->delivery->sendMessage(
                $previous,
                'Your Planner email address was changed',
                "Your Planner account now signs in with {$user->email}.\n\nIf you did not make this change, reset your password immediately.\n",
            );
        } catch (Throwable $error) {
            $this->logger->warning('Email change notice was not sent.', ['error' => $error->getMessage()]);
        }

        return $user;
    }

    public function pendingChange(int $userId): ?string
    {
        return $this->tokens->pendingEmail($userId, 'change', $this->now());
    }

    private function issue(int $userId, string $purpose, string $email, string $lifetime): string
    {
        $token = bin2hex(random_bytes(32));
        $this->tokens->replace($userId, $purpose, hash('sha256', $token), $email,
            Timestamp::database($this->clock->now()->modify($lifetime)), $this->now());

        return $token;
    }

    private function hash(string $token): string
    {
        if (preg_match('/^[a-f0-9]{64}$/D', $token) !== 1) {
            throw new ValidationException(['token' => [self::INVALID_LINK]]);
        }

        return hash('sha256', $token);
    }

    private function expired(string $expiresAt): bool
    {
        return $expiresAt <= $this->now();
    }

    private function now(): string
    {
        return Timestamp::database($this->clock->now());
    }
}
