<?php

declare(strict_types=1);

namespace Planner\Http\Routing;

use Planner\Http\HttpException;

final class Router
{
    /** @param list<Route> $routes */
    public function __construct(private readonly array $routes) {}

    public function match(string $method, string $rawPath): RouteMatch
    {
        $path = $this->decodePath($rawPath);
        $allowed = [];

        foreach ($this->routes as $route) {
            $pattern = $this->compile($route->path);

            if (preg_match('#^'.$pattern.'$#D', $path, $matches) !== 1) {
                continue;
            }

            $methods = array_map('strtoupper', $route->methods);
            $effectiveMethod = strtoupper($method) === 'HEAD' ? 'GET' : strtoupper($method);

            if (! in_array($effectiveMethod, $methods, true)) {
                $allowed = [...$allowed, ...$methods];

                continue;
            }

            $parameters = [];

            foreach ($matches as $key => $value) {
                if (is_string($key)) {
                    $parameters[$key] = $value;
                }
            }

            return new RouteMatch($route, $parameters);
        }

        if ($allowed !== []) {
            $allowed = array_values(array_unique($allowed));
            sort($allowed);

            throw new HttpException(405, 'METHOD_NOT_ALLOWED', 'The HTTP method is not supported.', [
                'Allow' => implode(', ', $allowed),
            ]);
        }

        throw new HttpException(404, 'NOT_FOUND', 'The requested page was not found.');
    }

    /** @return list<Route> */
    public function routes(): array
    {
        return $this->routes;
    }

    private function decodePath(string $rawPath): string
    {
        if (str_contains($rawPath, "\0") || preg_match('/%(?:2f|5c|00)/i', $rawPath) === 1) {
            throw new HttpException(400, 'INVALID_PATH', 'The request path is invalid.');
        }

        if (preg_match('/%(?![0-9A-Fa-f]{2})/', $rawPath) === 1) {
            throw new HttpException(400, 'INVALID_PATH', 'The request path is invalid.');
        }

        $segments = explode('/', $rawPath);
        $decoded = array_map('rawurldecode', $segments);

        foreach ($decoded as $segment) {
            if (str_contains($segment, '/') || str_contains($segment, '\\') || str_contains($segment, "\0")) {
                throw new HttpException(400, 'INVALID_PATH', 'The request path is invalid.');
            }
        }

        $path = implode('/', $decoded);

        return $path !== '' ? $path : '/';
    }

    private function compile(string $path): string
    {
        $parts = preg_split('/(\{[A-Za-z_][A-Za-z0-9_]*\})/', $path, -1, PREG_SPLIT_DELIM_CAPTURE);

        if ($parts === false) {
            throw new \LogicException('Unable to compile route pattern.');
        }

        $pattern = '';

        foreach ($parts as $part) {
            if (preg_match('/^\{([A-Za-z_][A-Za-z0-9_]*)\}$/', $part, $match) === 1) {
                $pattern .= '(?P<'.$match[1].'>[^/]+)';
            } else {
                $pattern .= preg_quote($part, '#');
            }
        }

        return $pattern;
    }
}
