<?php

declare(strict_types=1);

namespace Tests\Plain\Unit;

use PHPUnit\Framework\TestCase;
use Planner\Domain\Account\Totp;

final class TotpTest extends TestCase
{
    public function test_matches_rfc_6238_sha1_vectors_truncated_to_six_digits(): void
    {
        $secret = Totp::base32Encode('12345678901234567890');

        self::assertSame('GEZDGNBVGY3TQOJQGEZDGNBVGY3TQOJQ', $secret);
        self::assertSame('287082', Totp::code($secret, 59));
        self::assertSame('081804', Totp::code($secret, 1111111109));
        self::assertSame('005924', Totp::code($secret, 1234567890));
    }

    public function test_accepts_one_step_of_drift_and_rejects_malformed_codes(): void
    {
        $secret = Totp::generateSecret();
        $now = 1_800_000_000;

        self::assertSame('12345678901234567890', Totp::base32Decode(Totp::base32Encode('12345678901234567890')));
        self::assertTrue(Totp::verify($secret, Totp::code($secret, $now - 30), $now));
        self::assertFalse(Totp::verify($secret, Totp::code($secret, $now - 90), $now));
        self::assertFalse(Totp::verify($secret, '12345', $now));
        self::assertFalse(Totp::verify($secret, 'abcdef', $now));
    }
}
