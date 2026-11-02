<?php

declare(strict_types=1);

namespace Tests\Plain\Unit;

use PHPUnit\Framework\TestCase;
use Planner\Http\Security\ContentSecurityPolicy;

final class ContentSecurityPolicyTest extends TestCase
{
    public function test_vite_exceptions_are_only_enabled_for_local_loopback_origins(): void
    {
        $baseline = (new ContentSecurityPolicy())->value();
        foreach (['production', 'testing'] as $environment) {
            self::assertSame($baseline, (new ContentSecurityPolicy($environment, 'http://127.0.0.1:5173'))->value());
        }
        foreach ([null, '', 'https://example.com:5173', "http://localhost:5173/;script-src *", 'http://user@localhost:5173', 'http://localhost:5173?x=1'] as $url) {
            self::assertSame($baseline, (new ContentSecurityPolicy('local', $url))->value());
        }

        $local = (new ContentSecurityPolicy('local', 'http://127.0.0.1:5173'))->value();
        self::assertStringContainsString("script-src 'self' http://127.0.0.1:5173", $local);
        self::assertStringContainsString("style-src 'self' 'unsafe-inline' http://127.0.0.1:5173", $local);
        self::assertStringContainsString("font-src 'self' http://127.0.0.1:5173", $local);
        self::assertStringContainsString("img-src 'self' data: http://127.0.0.1:5173", $local);
        self::assertStringContainsString('ws://127.0.0.1:5173', $local);
        self::assertStringContainsString('wss://localhost:5173', (new ContentSecurityPolicy('local', 'https://localhost:5173'))->value());
    }
}
