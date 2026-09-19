<?php

declare(strict_types=1);

namespace Planner\Infrastructure\AI;

use Planner\Application\AI\AIProviderInterface;
use Planner\Application\AI\GenerationRequest;
use Planner\Application\AI\GenerationResult;
use Planner\Http\HttpException;

final readonly class DisabledAIProvider implements AIProviderInterface
{
    public function __construct(private string $model) {}
    public function name(): string { return 'disabled'; }
    public function model(): string { return $this->model; }
    public function generate(GenerationRequest $request): GenerationResult { throw new HttpException(503, 'AI_DISABLED', 'The AI assistant is not enabled.'); }
}
