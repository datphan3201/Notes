<?php

declare(strict_types=1);

namespace Planner\Http;

use Planner\Application\Account\AuthService;
use Planner\Http\Routing\Router;
use Planner\Http\Security\CsrfGuard;
use Planner\Http\Security\RateLimiter;
use Planner\Infrastructure\Session\SessionManager;
use Throwable;

final readonly class Application
{
    public function __construct(
        private Router $router,
        private SessionManager $session,
        private AuthService $auth,
        private CsrfGuard $csrf,
        private RateLimiter $rateLimiter,
        private ErrorHandler $errors,
    ) {}

    public function handle(Request $request): Response
    {
        $requestId = bin2hex(random_bytes(16));

        try {
            $match = $this->router->match($request->method, $request->path);
            $this->session->start($request);
            $user = $this->auth->currentUser();

            if ($match->route->auth && $user === null) {
                if ($request->expectsJson()) {
                    throw new HttpException(401, 'AUTH_REQUIRED', 'You must sign in to continue.');
                }

                return $this->finalize(Response::redirect('/login'), $requestId);
            }

            if ($match->route->rateLimit !== null) {
                [$limit, $seconds] = $this->limit($match->route->rateLimit);
                $identity = $user === null ? $request->clientIp() : (string) $user->id;
                $this->rateLimiter->consume($match->route->rateLimit, $identity, $limit, $seconds);
            }

            if ($match->route->csrf) {
                $this->csrf->assertValid($request, $request->input());
            }

            $response = ($match->route->handler)($request, $match->parameters);

            return $this->finalize($response, $requestId);
        } catch (Throwable $exception) {
            return $this->finalize($this->errors->render($exception, $request, $requestId), $requestId);
        } finally {
            $this->session->close();
        }
    }

    /** @return array{int, int} */
    private function limit(string $bucket): array
    {
        return match ($bucket) {
            'registration' => [10, 60],
            'note-reads' => [300, 60],
            'mutations' => [240, 60],
            'uploads' => [30, 60],
            'password-change' => [5, 60],
            'ai-generation' => [10, 3600],
            'ai-apply' => [30, 3600],
            default => throw new \LogicException("Unknown rate limit bucket [$bucket]."),
        };
    }

    private function finalize(Response $response, string $requestId): Response
    {
        $headers = [
            'X-Request-ID' => $requestId,
            'Cache-Control' => 'private, no-store',
            'X-Content-Type-Options' => 'nosniff',
            'Referrer-Policy' => 'same-origin',
        ];

        if (str_starts_with($response->headers['Content-Type'] ?? '', 'text/html')) {
            $headers['X-Frame-Options'] = 'DENY';
            $headers['Content-Security-Policy'] = "default-src 'self'; img-src 'self' data:; media-src 'self'; object-src 'none'; base-uri 'self'; frame-ancestors 'none'; form-action 'self'";
        }

        return $response->withHeaders($headers);
    }
}
