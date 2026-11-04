<?php

declare(strict_types=1);

namespace Planner\Infrastructure\Realtime;

/**
 * Short-lived, HMAC-signed admission ticket for the realtime server.
 *
 * The web app issues a ticket only after it has authorized the user for one
 * Note (owner, or accepted recipient, and unlocked when password-protected),
 * so the realtime process never reads browser sessions. A ticket names the
 * Note, the access level and the user, and expires quickly; the socket keeps
 * re-checking access when it saves.
 */
final readonly class RealtimeTicket
{
    public const TTL_SECONDS = 60;

    public function __construct(private string $secret)
    {
        if (strlen($secret) < 32) {
            throw new \InvalidArgumentException('The realtime secret must be at least 32 bytes.');
        }
    }

    /** Derives a dedicated key from the session key when no REALTIME_SECRET is configured. */
    public static function fromSessionKey(?string $encodedSessionKey, ?string $explicitSecret): self
    {
        if ($explicitSecret !== null && $explicitSecret !== '') {
            return new self(hash('sha256', $explicitSecret, true).hash('sha256', 'realtime:'.$explicitSecret, true));
        }
        $key = $encodedSessionKey === null ? '' : (base64_decode($encodedSessionKey, true) ?: (ctype_xdigit($encodedSessionKey) ? (hex2bin($encodedSessionKey) ?: '') : ''));
        if (strlen($key) < 32) {
            throw new \InvalidArgumentException('Realtime tickets need SESSION_ENCRYPTION_KEY or REALTIME_SECRET.');
        }

        return new self(hash_hmac('sha256', 'planner-realtime-ticket-v1', $key, true).hash_hmac('sha256', 'planner-realtime-ticket-v1b', $key, true));
    }

    /**
     * @param array{user_id:int,name:string,owner_id:int,note_id:string,permission:string} $claims
     */
    public function issue(array $claims, int $now): string
    {
        $payload = self::base64(json_encode([...$claims, 'exp' => $now + self::TTL_SECONDS], JSON_THROW_ON_ERROR | JSON_UNESCAPED_UNICODE));

        return $payload.'.'.self::base64(hash_hmac('sha256', $payload, $this->secret, true));
    }

    /** @return array{user_id:int,name:string,owner_id:int,note_id:string,permission:string,exp:int}|null */
    public function verify(string $ticket, int $now): ?array
    {
        $parts = explode('.', $ticket);
        if (count($parts) !== 2 || ! hash_equals(self::base64(hash_hmac('sha256', $parts[0], $this->secret, true)), $parts[1])) {
            return null;
        }
        $json = base64_decode(strtr($parts[0], '-_', '+/'), true);
        try {
            $claims = is_string($json) ? json_decode($json, true, 4, JSON_THROW_ON_ERROR) : null;
        } catch (\JsonException) {
            return null;
        }
        if (! is_array($claims)
            || ! is_int($claims['user_id'] ?? null) || ! is_int($claims['owner_id'] ?? null) || ! is_int($claims['exp'] ?? null)
            || ! is_string($claims['note_id'] ?? null) || ! is_string($claims['name'] ?? null)
            || ! in_array($claims['permission'] ?? null, ['owner', 'edit', 'view'], true)
            || $claims['exp'] < $now) {
            return null;
        }

        return $claims;
    }

    private static function base64(string $value): string
    {
        return rtrim(strtr(base64_encode($value), '+/', '-_'), '=');
    }
}
