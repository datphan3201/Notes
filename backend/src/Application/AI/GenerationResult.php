<?php

declare(strict_types=1);

namespace Planner\Application\AI;

final readonly class GenerationResult
{
    public function __construct(public string $proposalJson, public ?int $inputTokens = null, public ?int $outputTokens = null) {}
}
