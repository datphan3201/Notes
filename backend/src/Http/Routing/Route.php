<?php

declare(strict_types=1);

namespace Planner\Http\Routing;

use Closure;
use Planner\Http\Request;
use Planner\Http\Response;

final readonly class Route
{
    /**
     * @param  non-empty-list<string>  $methods
     * @param  Closure(Request, array<string, string>): Response  $handler
     */
    public function __construct(
        public array $methods,
        public string $path,
        public string $name,
        public Closure $handler,
        public bool $auth = false,
        public bool $csrf = false,
        public ?string $rateLimit = null,
    ) {}
}
