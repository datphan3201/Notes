<?php

declare(strict_types=1);

namespace Planner\Http;

final readonly class Request
{
    /**
     * @param  array<string, string|list<string>>  $query
     * @param  array<string, string>  $headers
     * @param  array<string, string>  $cookies
     * @param  array<string, mixed>  $form
     * @param  array<string, mixed>  $files
     * @param  array<string, string>  $server
     */
    public function __construct(
        public string $method,
        public string $path,
        public array $query = [],
        public array $headers = [],
        public array $cookies = [],
        public array $form = [],
        public array $files = [],
        public array $server = [],
        public string $rawBody = '',
    ) {}

    public static function fromGlobals(): self
    {
        $headers = [];

        foreach ($_SERVER as $key => $value) {
            if (! is_string($value)) {
                continue;
            }

            if (str_starts_with($key, 'HTTP_')) {
                $name = strtolower(str_replace('_', '-', substr($key, 5)));
                $headers[$name] = $value;
            }
        }

        if (isset($_SERVER['CONTENT_TYPE'])) {
            $headers['content-type'] = (string) $_SERVER['CONTENT_TYPE'];
        }

        if (isset($_SERVER['CONTENT_LENGTH'])) {
            $headers['content-length'] = (string) $_SERVER['CONTENT_LENGTH'];
        }

        $uri = (string) ($_SERVER['REQUEST_URI'] ?? '/');
        $path = parse_url($uri, PHP_URL_PATH);

        return new self(
            strtoupper((string) ($_SERVER['REQUEST_METHOD'] ?? 'GET')),
            is_string($path) && $path !== '' ? $path : '/',
            self::stringArray($_GET),
            $headers,
            self::stringMap($_COOKIE),
            $_POST,
            $_FILES,
            self::stringMap($_SERVER),
            (string) file_get_contents('php://input'),
        );
    }

    public function header(string $name): ?string
    {
        return $this->headers[strtolower($name)] ?? null;
    }

    public function isJson(): bool
    {
        $contentType = strtolower(trim(explode(';', $this->header('content-type') ?? '')[0]));

        return $contentType === 'application/json';
    }

    public function expectsJson(): bool
    {
        return str_starts_with($this->path, '/api/')
            || str_contains(strtolower($this->header('accept') ?? ''), 'application/json');
    }

    /** @return array<string, mixed> */
    public function input(int $maxBytes = 1_048_576): array
    {
        if ($this->isJson()) {
            if (strlen($this->rawBody) > $maxBytes) {
                throw new HttpException(413, 'PAYLOAD_TOO_LARGE', 'The request payload is too large.');
            }

            try {
                $shape = json_decode($this->rawBody, false, 32, JSON_THROW_ON_ERROR);
                $decoded = json_decode($this->rawBody, true, 32, JSON_THROW_ON_ERROR);
            } catch (\JsonException) {
                throw new HttpException(400, 'MALFORMED_JSON', 'The JSON payload is malformed.');
            }

            if (! $shape instanceof \stdClass || ! is_array($decoded)) {
                throw new HttpException(400, 'MALFORMED_JSON', 'The JSON payload must be an object.');
            }

            return $decoded;
        }

        return $this->form;
    }

    public function clientIp(): string
    {
        return $this->server['REMOTE_ADDR'] ?? '127.0.0.1';
    }

    /** @param array<mixed> $values @return array<string, string|list<string>> */
    private static function stringArray(array $values): array
    {
        $result = [];

        foreach ($values as $key => $value) {
            if (! is_string($key)) {
                continue;
            }

            if (is_string($value)) {
                $result[$key] = $value;
            } elseif (is_array($value)) {
                $result[$key] = array_values(array_filter($value, 'is_string'));
            }
        }

        return $result;
    }

    /** @param array<mixed> $values @return array<string, string> */
    private static function stringMap(array $values): array
    {
        $result = [];

        foreach ($values as $key => $value) {
            if (is_string($key) && is_string($value)) {
                $result[$key] = $value;
            }
        }

        return $result;
    }
}
