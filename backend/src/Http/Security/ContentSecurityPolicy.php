<?php

declare(strict_types=1);

namespace Planner\Http\Security;

final readonly class ContentSecurityPolicy
{
    public function __construct(
        private string $environment = 'production',
        private ?string $developmentUrl = null,
        private ?string $realtimeUrl = null,
    ) {
    }

    public function value(): string
    {
        $policy = $this->base();
        $socket = $this->realtimeOrigin();
        if ($socket !== null && ! str_contains($policy, 'connect-src')) {
            // Live collaboration: the WebSocket origin (same host via /realtime, or a separate port).
            $policy .= "; connect-src 'self' ".$socket;
        }

        return $policy;
    }

    /** ws(s)://host[:port] of the realtime server, or null when it is off or malformed. */
    private function realtimeOrigin(): ?string
    {
        if ($this->realtimeUrl === null) {
            return null;
        }
        $parts = parse_url($this->realtimeUrl);
        if ($parts === false || ! in_array($parts['scheme'] ?? '', ['ws', 'wss'], true) || ! isset($parts['host'])
            || isset($parts['user']) || isset($parts['pass']) || preg_match('/^[A-Za-z0-9.\-\[\]:]+$/D', $parts['host']) !== 1) {
            return null;
        }

        return $parts['scheme'].'://'.$parts['host'].(isset($parts['port']) ? ':'.$parts['port'] : '');
    }

    private function base(): string
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
        $realtime = $this->realtimeOrigin();

        return $policy."; script-src 'self' ".$origin."; style-src 'self' 'unsafe-inline' ".$origin
            ."; font-src 'self' ".$origin."; connect-src 'self' ".$origin.' '.$socket.($realtime === null ? '' : ' '.$realtime);
    }
}
