<?php

use App\Http\Middleware\PrivateResponseHeaders;
use App\Support\ApiError;
use App\Support\ApiException;
use Illuminate\Auth\AuthenticationException;
use Illuminate\Foundation\Application;
use Illuminate\Foundation\Configuration\Exceptions;
use Illuminate\Foundation\Configuration\Middleware;
use Illuminate\Http\Request;
use Illuminate\Validation\ValidationException;
use Symfony\Component\HttpKernel\Exception\HttpExceptionInterface;

return Application::configure(basePath: dirname(__DIR__))
    ->withRouting(
        web: __DIR__.'/../routes/web.php',
        commands: __DIR__.'/../routes/console.php',
        health: '/up',
    )
    ->withCommands([__DIR__.'/../app/Console/Commands'])
    ->withMiddleware(function (Middleware $middleware): void {
        $middleware->web(append: [PrivateResponseHeaders::class]);
        $middleware->redirectGuestsTo('/login');
        $middleware->redirectUsersTo('/');

        // Note bodies and password bytes are intentionally normalized by their own
        // validators; framework-wide trimming would destroy meaningful indentation.
        $middleware->trimStrings(except: [
            'password', 'password_confirmation', 'current_password',
            'content', 'title', 'display_name', 'q', 'name',
        ]);
        $middleware->convertEmptyStringsToNull([
            static fn (Request $request): bool => $request->is('api/*'),
        ]);
    })
    ->withExceptions(function (Exceptions $exceptions): void {
        $exceptions->shouldRenderJsonWhen(
            fn (Request $request) => $request->is('api/*') || $request->expectsJson(),
        );

        $exceptions->render(function (AuthenticationException $exception, Request $request) {
            if ($request->is('api/*')) {
                return ApiError::make('AUTH_REQUIRED', 'Vui lòng đăng nhập để tiếp tục.', 401);
            }
        });

        $exceptions->render(function (ValidationException $exception, Request $request) {
            if ($request->is('api/*')) {
                return ApiError::validation($exception->errors());
            }
        });

        $exceptions->render(function (HttpExceptionInterface $exception, Request $request) {
            if ($request->is('api/*')) {
                return ApiError::make(
                    $exception->getStatusCode() === 419 ? 'SESSION_EXPIRED' : 'NOT_FOUND',
                    $exception->getStatusCode() === 419
                        ? 'Phiên đăng nhập đã hết hạn.'
                        : 'Không tìm thấy dữ liệu.',
                    $exception->getStatusCode(),
                );
            }
        });

        $exceptions->render(function (ApiException $exception, Request $request) {
            if ($request->is('api/*') || $request->expectsJson()) {
                return ApiError::make(
                    $exception->errorCode,
                    $exception->getMessage(),
                    $exception->status,
                    $exception->extra,
                );
            }

            // Private file URLs are HTML/browser routes, but an ownership
            // miss must still be a real 404 rather than an uncaught 500.
            if ($request->is('files/*')) {
                return response('', $exception->status);
            }
        });
    })->create();
