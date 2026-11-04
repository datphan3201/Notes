<?php

declare(strict_types=1);

namespace Planner\Application\AI;

interface AIProviderInterface
{
    public function name(): string;

    public function model(): string;

    public function generate(GenerationRequest $request): GenerationResult;

    /**
     * One model step of the chat agent. $contents are Gemini-style turns
     * ({role: user|model, parts: [...]}) including earlier function calls and
     * responses; $tools are function declarations. The returned content is
     * the model turn to append verbatim before sending function responses.
     *
     * @param list<array<string, mixed>> $contents
     * @param list<array<string, mixed>> $tools
     * @return array{content:array<string,mixed>,text:string,calls:list<array{name:string,args:array<string,mixed>,id?:string}>}
     */
    public function chat(string $system, array $contents, array $tools): array;

    /**
     * One plain generation. With $jsonSchema the model must return JSON that
     * matches it; the raw text is returned either way.
     *
     * @param array<string, mixed>|null $jsonSchema
     */
    public function complete(string $system, string $prompt, ?array $jsonSchema = null): string;

    /**
     * Embedding vectors for retrieval, one per input text, in input order.
     * $task is "document" for stored texts and "query" for questions.
     *
     * @param list<string> $texts
     * @return list<list<float>>
     */
    public function embed(array $texts, string $task): array;

    /** Identifies the embedding space, so vectors from another model are not compared. */
    public function embeddingModel(): string;
}
