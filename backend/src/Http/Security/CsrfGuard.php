<?php

declare(strict_types=1);

namespace Planner\Http\Security;

use Planner\Http\HttpException;
use Planner\Http\Request;
use Planner\Infrastructure\Session\SessionManager;

final readonly class CsrfGuard
{
    public function __construct(private SessionManager $session, private string $applicationUrl) {}

    /** @param array<string, mixed> $input */
    public function assertValid(Request $request, array $input): void
    {
        $site = strtolower($request->header('sec-fetch-site') ?? '');

        if ($site === 'cross-site') {
            throw $this->failure();
        }

        $origin = $request->header('origin');

        if ($origin !== null) {
            $expected = parse_url($this->applicationUrl);
            $actual = parse_url($origin);

            if (! is_array($expected) || ! is_array($actual)
                || strtolower((string) ($expected['scheme'] ?? '')) !== strtolower((string) ($actual['scheme'] ?? ''))
                || strtolower((string) ($expected['host'] ?? '')) !== strtolower((string) ($actual['host'] ?? ''))
                || (int) ($expected['port'] ?? $this->defaultPort((string) ($expected['scheme'] ?? '')))
                    !== (int) ($actual['port'] ?? $this->defaultPort((string) ($actual['scheme'] ?? '')))) {
                throw $this->failure();
            }
        }

        $provided = $request->header('x-csrf-token') ?? ($input['_token'] ?? null);

        if (! is_string($provided) || ! hash_equals($this->session->csrfToken(), $provided)) {
            throw $this->failure();
        }
    }

    private function defaultPort(string $scheme): int
    {
        return strtolower($scheme) === 'https' ? 443 : 80;
    }

    private function failure(): HttpException
    {
        return new HttpException(419, 'SESSION_EXPIRED', 'Your session has expired. Reload the page and try again.');
    }
}
