<?php

declare(strict_types=1);

namespace Planner\Http\Routing;

use InvalidArgumentException;

final readonly class RouteUrls
{
    /** @param array<string, string> $paths */
    public function __construct(private array $paths) {}

    /** @param array<string, string|int> $parameters */
    public function path(string $name, array $parameters = []): string
    {
        $path = $this->paths[$name] ?? throw new InvalidArgumentException("Unknown route [$name].");

        foreach ($parameters as $key => $value) {
            $path = str_replace('{'.$key.'}', rawurlencode((string) $value), $path);
        }

        if (preg_match('/\{[^}]+\}/', $path) === 1) {
            throw new InvalidArgumentException("Missing parameter for route [$name].");
        }

        return $path;
    }
}
