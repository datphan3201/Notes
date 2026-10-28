<?php

declare(strict_types=1);

namespace Planner\Application\Account;

use Planner\Domain\Account\Totp;
use Planner\Domain\Account\UserRecord;
use Planner\Http\HttpException;
use Planner\Http\Security\RateLimiter;
use Planner\Http\ValidationException;
use Planner\Infrastructure\Database\TransactionManager;
use Planner\Infrastructure\Mail\PasswordResetMailer;
use Planner\Infrastructure\Persistence\Pdo\Account\PdoAccountRepository;
use Planner\Infrastructure\Persistence\Pdo\Account\PdoTwoFactorRepository;
use Planner\Infrastructure\Session\SessionCipher;
use Planner\Infrastructure\Session\SessionManager;
use Planner\Support\Clock;
use Planner\Support\Timestamp;

final readonly class TwoFactorService
{
    private const SETUP_KEY = 'totp_setup';

    public function __construct(
        private PdoAccountRepository $accounts,
        private PdoTwoFactorRepository $codes,
        private TransactionManager $transactions,
        private RateLimiter $limits,
        private SessionManager $session,
        private SessionCipher $cipher,
        private PasswordResetMailer $mail,
        private Clock $clock,
    ) {
    }

    /** Emails a fresh six-digit code (login challenge, email setup, or TOTP fallback). */
    public function sendEmailCode(UserRecord $user): void
    {
        $this->limits->consume('two-factor-send', (string) $user->id, 5, 600);
        $code = str_pad((string) random_int(0, 999_999), 6, '0', STR_PAD_LEFT);
        $now = $this->clock->now();
        $this->transactions->run(function () use ($user, $code, $now): void {
            $this->codes->store($user->id, $this->hash($user->id, $code), Timestamp::database($now->modify('+10 minutes')), Timestamp::database($now));
        });
        $this->mail->sendMessage($user->email, 'Your Planner verification code', "Your Planner verification code is $code.\nIt expires in 10 minutes. If you did not try to sign in, change your password.\n");
    }

    /** Verifies a login or confirmation code for the user's method; email codes are single use. */
    public function verify(UserRecord $user, string $code, bool $allowEmailCode = true): bool
    {
        $this->limits->assertAvailable('two-factor-verify', (string) $user->id, 10);
        $code = preg_replace('/\s+/', '', $code) ?? '';
        $valid = ($user->twoFactorMethod === 'totp' && $this->totpMatches($user, $code))
            || ($allowEmailCode && $this->emailCodeMatches($user->id, $code));
        if (! $valid) {
            $this->limits->hit('two-factor-verify', (string) $user->id, 600);

            return false;
        }
        $this->limits->clear('two-factor-verify', (string) $user->id);

        return true;
    }

    /** @return array{secret:string,uri:string} kept in the session until confirmed */
    public function beginTotpSetup(UserRecord $user): array
    {
        $secret = Totp::generateSecret();
        $this->session->put(self::SETUP_KEY, $secret);

        return ['secret' => $secret, 'uri' => Totp::uri($secret, $user->email)];
    }

    public function confirmTotp(UserRecord $user, string $code): void
    {
        $secret = $this->session->get(self::SETUP_KEY);
        if (! is_string($secret)) {
            throw new ValidationException(['code' => ['Start the authenticator setup again.']]);
        }
        if (! Totp::verify($secret, preg_replace('/\s+/', '', $code) ?? '', $this->clock->now()->getTimestamp())) {
            throw new ValidationException(['code' => ['The code is incorrect.']]);
        }
        $encrypted = base64_encode($this->cipher->encrypt($this->context($user->id), $secret));
        $this->transactions->run(fn () => $this->accounts->setTwoFactor($user->id, 'totp', $encrypted, Timestamp::database($this->clock->now())));
        $this->session->forget(self::SETUP_KEY);
    }

    public function confirmEmail(UserRecord $user, string $code): void
    {
        if (! $this->emailCodeMatches($user->id, preg_replace('/\s+/', '', $code) ?? '')) {
            throw new ValidationException(['code' => ['The code is incorrect or has expired.']]);
        }
        $this->transactions->run(fn () => $this->accounts->setTwoFactor($user->id, 'email', null, Timestamp::database($this->clock->now())));
    }

    public function disable(UserRecord $user, string $password): void
    {
        if (! password_verify($password, $user->passwordHash)) {
            throw new ValidationException(['password' => ['The current password is incorrect.']]);
        }
        $this->transactions->run(function () use ($user): void {
            $this->accounts->setTwoFactor($user->id, null, null, Timestamp::database($this->clock->now()));
            $this->codes->delete($user->id);
        });
    }

    private function totpMatches(UserRecord $user, string $code): bool
    {
        if ($user->twoFactorSecret === null) {
            return false;
        }
        $payload = base64_decode($user->twoFactorSecret, true);
        if ($payload === false) {
            throw new HttpException(500, 'TWO_FACTOR_UNAVAILABLE', 'Two-factor authentication is unavailable.');
        }

        return Totp::verify($this->cipher->decrypt($this->context($user->id), $payload), $code, $this->clock->now()->getTimestamp());
    }

    private function emailCodeMatches(int $userId, string $code): bool
    {
        if (preg_match('/^\d{6}$/D', $code) !== 1) {
            return false;
        }

        return $this->transactions->run(function () use ($userId, $code): bool {
            $stored = $this->codes->find($userId);
            if ($stored === null || $stored['attempts'] >= 5 || $stored['expires_at'] < Timestamp::database($this->clock->now())) {
                return false;
            }
            if (! hash_equals($stored['code_hash'], $this->hash($userId, $code))) {
                $this->codes->failedAttempt($userId);

                return false;
            }
            $this->codes->delete($userId);

            return true;
        });
    }

    private function hash(int $userId, string $code): string
    {
        return hash('sha256', $userId.'|'.$code);
    }

    private function context(int $userId): string
    {
        return 'totp:'.$userId;
    }
}
