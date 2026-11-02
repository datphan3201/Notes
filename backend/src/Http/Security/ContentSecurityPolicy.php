<?php

declare(strict_types=1);

namespace Planner\Http\Security;

final readonly class ContentSecurityPolicy
{
    public function __construct(
        private string $environment = 'production',
        private ?string $developmentUrl = null,
    ) {
    }

    public function value(): string
    {
        $policy = "default-src 'self'; img-src 'self' data:; media-src 'self'; object-src 'none'; base-uri 'self'; frame-ancestors 'none'; form-action 'self'";
        if ($this->environment !== 'local' || $this->developmentUrl === null) {
            return $policy;
        }

        $parts = parse_url($this->developmentUrl);
        if ($parts === false || !in_array($parts['scheme'] ?? '', ['http', 'https'], true)
            || !in_array($parts['host'] ?? '', ['localhost', '127.0.0.1', '[::1]'], true)
            || isset($parts['user']) || isset($parts['pass']) || isset($parts['query']) || isset($parts['fragment'])
            || !in_array($parts['path'] ?? '', ['', '/'], true)) {
            return $policy;
        }

        $authority = $parts['host'].(isset($parts['port']) ? ':'.$parts['port'] : '');
        $origin = $parts['scheme'].'://'.$authority;
        $socket = ($parts['scheme'] === 'https' ? 'wss' : 'ws').'://'.$authority;
        $policy = str_replace("img-src 'self' data:", "img-src 'self' data: ".$origin, $policy);

        // Vite injects styles and opens a WebSocket; these exceptions are local only.
        return $policy."; script-src 'self' ".$origin."; style-src 'self' 'unsafe-inline' ".$origin
            ."; font-src 'self' ".$origin."; connect-src 'self' ".$origin.' '.$socket;
    }
}
