<?php

declare(strict_types=1);

namespace Planner\Http;

use Planner\Infrastructure\Session\SessionManager;

/**
 * Language for pages shown before sign-in: an explicit ?lang= choice is kept
 * for the session; otherwise the browser's Accept-Language decides.
 */
final class GuestLocale
{
    private const SUPPORTED = ['en', 'vi'];

    public static function resolve(Request $request, SessionManager $session): string
    {
        $requested = $request->query['lang'] ?? null;
        if (is_string($requested) && in_array($requested, self::SUPPORTED, true)) {
            $session->put('guest_locale', $requested);

            return $requested;
        }
        $remembered = $session->get('guest_locale');
        if (is_string($remembered) && in_array($remembered, self::SUPPORTED, true)) {
            return $remembered;
        }
        $header = strtolower((string) $request->header('Accept-Language'));

        return str_starts_with($header, 'vi') ? 'vi' : 'en';
    }
}
