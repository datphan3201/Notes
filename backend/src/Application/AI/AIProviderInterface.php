<?php

declare(strict_types=1);

namespace Planner\Application\AI;

interface AIProviderInterface
{
    public function name(): string;

    public function model(): string;

    public function generate(GenerationRequest $request): GenerationResult;

    /**
     * Answers a free-form question as plain text using only the supplied,
     * bounded read-only summary of the user's Planner.
     *
     * @param array<string, mixed> $context
     */
    public function answer(string $question, array $context): string;
}
