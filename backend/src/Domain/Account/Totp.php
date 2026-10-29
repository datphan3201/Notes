<?php

declare(strict_types=1);

namespace Planner\Domain\Account;

/** RFC 6238 time-based one-time passwords: HMAC-SHA1, 6 digits, 30-second steps. */
final class Totp
{
    private const ALPHABET = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ234567';

    public static function generateSecret(): string
    {
        return self::base32Encode(random_bytes(20));
    }

    public static function code(string $secret, int $timestamp): string
    {
        $counter = intdiv($timestamp, 30);
        $hash = hash_hmac('sha1', pack('N2', 0, $counter), self::base32Decode($secret), true);
        $offset = ord($hash[19]) & 0x0f;
        $value = ((ord($hash[$offset]) & 0x7f) << 24)
            | (ord($hash[$offset + 1]) << 16)
            | (ord($hash[$offset + 2]) << 8)
            | ord($hash[$offset + 3]);

        return str_pad((string) ($value % 1_000_000), 6, '0', STR_PAD_LEFT);
    }

    /** Accepts the current step and one step either side for clock drift. */
    public static function verify(string $secret, string $code, int $timestamp): bool
    {
        if (preg_match('/^\d{6}$/D', $code) !== 1) {
            return false;
        }
        foreach ([-30, 0, 30] as $drift) {
            if (hash_equals(self::code($secret, $timestamp + $drift), $code)) {
                return true;
            }
        }

        return false;
    }

    public static function uri(string $secret, string $email): string
    {
        return 'otpauth://totp/'.rawurlencode('Planner:'.$email).'?secret='.$secret.'&issuer=Planner&digits=6&period=30';
    }

    public static function base32Encode(string $bytes): string
    {
        $bits = '';
        foreach (str_split($bytes) as $byte) {
            $bits .= str_pad(decbin(ord($byte)), 8, '0', STR_PAD_LEFT);
        }
        $output = '';
        foreach (str_split($bits, 5) as $chunk) {
            $output .= self::ALPHABET[bindec(str_pad($chunk, 5, '0'))];
        }

        return $output;
    }

    public static function base32Decode(string $value): string
    {
        $bits = '';
        foreach (str_split(strtoupper(rtrim($value, '='))) as $character) {
            $index = strpos(self::ALPHABET, $character);
            if ($index === false) {
                throw new \InvalidArgumentException('Invalid base32 secret.');
            }
            $bits .= str_pad(decbin($index), 5, '0', STR_PAD_LEFT);
        }
        $output = '';
        foreach (str_split($bits, 8) as $chunk) {
            if (strlen($chunk) === 8) {
                $output .= chr(bindec($chunk));
            }
        }

        return $output;
    }
}
