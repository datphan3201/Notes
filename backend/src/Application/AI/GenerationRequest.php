<?php

declare(strict_types=1);

namespace Planner\Application\AI;

final readonly class GenerationRequest
{
    /** @param list<array<string, mixed>> $context */
    public function __construct(public string $capability, public string $instruction, public array $context) {}
}
