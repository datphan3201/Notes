<?php

declare(strict_types=1);

namespace Tests\Plain\Unit;

use PHPUnit\Framework\TestCase;
use Planner\Support\SystemClock;
use Planner\Support\TextNormalizer;
use Planner\Support\UuidGenerator;
use Ramsey\Uuid\Uuid;

final class SupportTest extends TestCase
{
    public function test_normalizes_identity_and_body_text_without_removing_indentation(): void
    {
        self::assertSame('user@example.com', TextNormalizer::email(' User@Example.COM '));
        self::assertSame("  line one\n\tline two\n", TextNormalizer::body("  line one\r\n\tline two\r"));
        self::assertTrue(TextNormalizer::hasForbiddenIdentityControl("name\n"));
        self::assertFalse(TextNormalizer::hasForbiddenBodyControl("line\n"));
    }

    public function test_generates_lowercase_version_four_uuid(): void
    {
        $uuid = (new UuidGenerator)->generate();

        self::assertSame(strtolower($uuid), $uuid);
        self::assertTrue(Uuid::isValid($uuid));
        self::assertSame(4, Uuid::fromString($uuid)->getVersion());
    }

    public function test_system_clock_returns_utc_immutable_time(): void
    {
        $now = (new SystemClock)->now();

        self::assertSame('UTC', $now->getTimezone()->getName());
    }
}
