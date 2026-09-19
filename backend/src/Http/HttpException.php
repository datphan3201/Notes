<?php

declare(strict_types=1);

namespace Planner\Http;

use RuntimeException;

class HttpException extends RuntimeException
{
    /** @param array<string, string> $headers */
    public function __construct(
        public readonly int $status,
        public readonly string $errorCode,
        string $message,
        public readonly array $headers = [],
        /** @var array<string, mixed> */
        public readonly array $payload = [],
    ) {
        parent::__construct($message);
    }
}
