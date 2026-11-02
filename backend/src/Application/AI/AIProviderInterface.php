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
}
