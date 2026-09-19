<?php

declare(strict_types=1);

namespace Planner\Http;

use PDOException;
use Psr\Log\LoggerInterface;
use Throwable;

final readonly class ErrorHandler
{
    public function __construct(private LoggerInterface $logger, private bool $debug) {}

    public function render(Throwable $exception, Request $request, string $requestId): Response
    {
        if ($exception instanceof ValidationException) {
            return $this->response(
                $request,
                $exception->status,
                $exception->errorCode,
                $exception->getMessage(),
                $requestId,
                ['errors' => $exception->errors],
                $exception->headers,
            );
        }

        if ($exception instanceof HttpException) {
            return $this->response(
                $request,
                $exception->status,
                $exception->errorCode,
                $exception->getMessage(),
                $requestId,
                $exception->payload,
                $exception->headers,
            );
        }

        $serviceUnavailable = $exception instanceof PDOException;
        $status = $serviceUnavailable ? 503 : 500;
        $code = $serviceUnavailable ? 'SERVICE_UNAVAILABLE' : 'SERVER_ERROR';
        $message = $serviceUnavailable ? 'The service is temporarily unavailable.' : 'Something went wrong. Please try again.';

        $this->logger->error('Unhandled application failure.', [
            'request_id' => $requestId,
            'exception' => $exception::class,
            // Exception messages may contain SQL bindings, file paths, or
            // provider content. Development diagnostics use stack inspection,
            // never unredacted application logs or JSON responses.
            'debug_enabled' => $this->debug,
        ]);

        return $this->response($request, $status, $code, $message, $requestId);
    }

    /** @param array<string, mixed> $extra @param array<string, string> $headers */
    private function response(
        Request $request,
        int $status,
        string $code,
        string $message,
        string $requestId,
        array $extra = [],
        array $headers = [],
    ): Response {
        if ($request->expectsJson()) {
            return Response::json(
                ['code' => $code, 'message' => $message, ...$extra],
                $status,
                [...$headers, 'X-Request-ID' => $requestId],
            );
        }

        $safeMessage = htmlspecialchars($message, ENT_QUOTES | ENT_SUBSTITUTE, 'UTF-8');

        return Response::html(
            '<!doctype html><html lang="en"><meta charset="utf-8"><title>Error</title><body><h1>'.$status.'</h1><p>'.$safeMessage.'</p></body></html>',
            $status,
        )->withHeaders([...$headers, 'X-Request-ID' => $requestId]);
    }
}
