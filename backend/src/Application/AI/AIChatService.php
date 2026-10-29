<?php

declare(strict_types=1);

namespace Planner\Application\AI;

use Planner\Http\ValidationException;
use Planner\Infrastructure\Persistence\Pdo\AI\PdoAIActionRepository;
use Planner\Support\TextNormalizer;

/**
 * Read-only question answering about the user's own Planner. It sends a
 * bounded summary (names, statuses, dates) and never writes planning data.
 */
final readonly class AIChatService
{
    public function __construct(
        private AIProviderInterface $provider,
        private PdoAIActionRepository $repository,
    ) {
    }

    public function available(): bool
    {
        return $this->provider->name() !== 'disabled';
    }

    public function ask(int $userId, mixed $question): string
    {
        $question = is_string($question) ? trim(TextNormalizer::body($question)) : '';
        if ($question === '' || TextNormalizer::codePoints($question) > 2000) {
            throw new ValidationException(['question' => ['Ask a question of 1 to 2000 characters.']]);
        }

        return $this->provider->answer($question, $this->repository->assistantSummary($userId));
    }
}
