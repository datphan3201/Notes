<?php

declare(strict_types=1);

namespace Planner\Http;

use Closure;

final readonly class Response
{
    /** @param array<string, string> $headers */
    public function __construct(
        public int $status = 200,
        public array $headers = [],
        public string $body = '',
        public ?Closure $stream = null,
    ) {}

    /** @param array<string, mixed> $payload @param array<string, string> $headers */
    public static function json(array $payload, int $status = 200, array $headers = []): self
    {
        return new self(
            $status,
            ['Content-Type' => 'application/json; charset=UTF-8', ...$headers],
            json_encode($payload, JSON_THROW_ON_ERROR | JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES),
        );
    }

    public static function html(string $html, int $status = 200): self
    {
        return new self($status, ['Content-Type' => 'text/html; charset=UTF-8'], $html);
    }

    public static function redirect(string $location, int $status = 302): self
    {
        return new self($status, ['Location' => $location]);
    }

    /** @param array<string, string> $headers @param Closure(): void $stream */
    public static function stream(Closure $stream, int $status = 200, array $headers = []): self
    {
        return new self($status, $headers, '', $stream);
    }

    /** @param array<string, string> $headers */
    public function withHeaders(array $headers): self
    {
        return new self($this->status, [...$this->headers, ...$headers], $this->body, $this->stream);
    }

    public function emit(bool $head = false): void
    {
        http_response_code($this->status);

        foreach ($this->headers as $name => $value) {
            header($name.': '.$value, true);
        }

        if (! $head) {
            if ($this->stream !== null) {
                ($this->stream)();
            } else {
                echo $this->body;
            }
        }
    }

    /** Capture a streamed response in tests without changing production buffering behavior. */
    public function captureStream(): string
    {
        if ($this->stream === null) {
            return $this->body;
        }

        ob_start();

        try {
            ($this->stream)();

            return (string) ob_get_contents();
        } finally {
            ob_end_clean();
        }
    }
}
