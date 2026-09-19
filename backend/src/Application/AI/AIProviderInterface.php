<?php

declare(strict_types=1);

namespace Planner\Application\AI;

interface AIProviderInterface
{
    public function name(): string;
    public function model(): string;
    public function generate(GenerationRequest $request): GenerationResult;
}
