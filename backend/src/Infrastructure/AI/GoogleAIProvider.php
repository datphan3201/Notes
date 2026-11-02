<?php

declare(strict_types=1);

namespace Planner\Infrastructure\AI;

use Planner\Application\AI\AIProviderInterface;
use Planner\Application\AI\GenerationRequest;
use Planner\Application\AI\GenerationResult;
use Planner\Http\HttpException;

final readonly class GoogleAIProvider implements AIProviderInterface
{
    public function __construct(private string $apiKey, private string $model)
    {
    }
    public function name(): string
    {
        return 'google';
    }
    public function model(): string
    {
        return $this->model;
    }

    public function generate(GenerationRequest $request): GenerationResult
    {
        $payload = [
            'system_instruction' => ['parts' => [['text' => 'Return only a safe planning proposal matching the supplied JSON schema. Never include ownership, status, timestamps, code, SQL, or URLs. Use schema_version 1, a short summary in the language of the instruction, and operations such as {"op":"create_task","local_id":"t1","parent":null,"fields":{"name":"...","description":"...","importance":3,"deadline":"YYYY-MM-DD"}}. local_id is lowercase letters, digits, _ or -, unique per operation. Task fields may only be name, description, expected_result, completion_criteria, importance (1-5), start_date, deadline (YYYY-MM-DD, not in the past) and scheduled_start/scheduled_end; omit fields you do not know. A parent may reference only context objects, as {"type":"goal","existing_id":"...","version":n}.']]],
            'contents' => [['role' => 'user', 'parts' => [['text' => json_encode(['capability' => $request->capability, 'instruction' => $request->instruction, 'context' => $request->context], JSON_UNESCAPED_UNICODE | JSON_THROW_ON_ERROR)]]]],
            'generationConfig' => ['responseMimeType' => 'application/json', 'responseJsonSchema' => $this->schema()],
        ];

        return $this->result($this->post($payload));
    }

    public function chat(string $system, array $contents, array $tools): array
    {
        $payload = [
            'system_instruction' => ['parts' => [['text' => $system]]],
            'contents' => $contents,
            'tools' => [['functionDeclarations' => $tools]],
        ];
        $body = $this->post($payload);

        try {
            $decoded = json_decode($body, true, 512, JSON_THROW_ON_ERROR);
            // The model turn is echoed back verbatim (thought signatures and
            // empty {} args included), so keep JSON objects as objects.
            $raw = json_decode($body, false, 512, JSON_THROW_ON_ERROR)->candidates[0]->content ?? null;
        } catch (\JsonException) {
            throw new HttpException(503, 'AI_MALFORMED_RESPONSE', 'AI returned invalid data.');
        }
        $parts = $decoded['candidates'][0]['content']['parts'] ?? null;
        if (!is_array($parts) || !is_object($raw)) {
            throw new HttpException(503, isset($decoded['promptFeedback']['blockReason']) ? 'AI_SAFETY_REFUSAL' : 'AI_MALFORMED_RESPONSE', 'AI did not return a valid answer.');
        }
        $text = [];
        $calls = [];
        foreach ($parts as $part) {
            if (is_string($part['text'] ?? null) && ($part['thought'] ?? false) !== true) {
                $text[] = $part['text'];
            }
            if (is_string($part['functionCall']['name'] ?? null)) {
                $call = ['name' => $part['functionCall']['name'], 'args' => is_array($part['functionCall']['args'] ?? null) ? $part['functionCall']['args'] : []];
                if (is_string($part['functionCall']['id'] ?? null)) {
                    $call['id'] = $part['functionCall']['id'];
                }
                $calls[] = $call;
            }
        }

        return ['content' => (array) $raw, 'text' => trim(implode('', $text)), 'calls' => $calls];
    }

    /** @param array<string, mixed> $payload */
    private function post(array $payload): string
    {
        $url = 'https://generativelanguage.googleapis.com/v1beta/models/'.rawurlencode($this->model).':generateContent';
        $lastCode = 'AI_UNAVAILABLE';
        for ($attempt = 0; $attempt < 3; $attempt++) {
            $curl = curl_init($url);
            curl_setopt_array($curl, [CURLOPT_POST => true, CURLOPT_RETURNTRANSFER => true, CURLOPT_CONNECTTIMEOUT => 5, CURLOPT_TIMEOUT => 30, CURLOPT_HTTPHEADER => ['Content-Type: application/json', 'x-goog-api-key: '.$this->apiKey], CURLOPT_POSTFIELDS => json_encode($payload, JSON_THROW_ON_ERROR)]);
            $body = curl_exec($curl);
            $status = (int) curl_getinfo($curl, CURLINFO_RESPONSE_CODE);
            $error = curl_errno($curl);
            curl_close($curl);
            if ($error !== 0) $lastCode = $error === CURLE_OPERATION_TIMEDOUT ? 'AI_TIMEOUT' : 'AI_UNAVAILABLE';
            elseif ($status === 429) $lastCode = 'AI_QUOTA';
            elseif ($status === 503) $lastCode = 'AI_UNAVAILABLE';
            elseif ($status >= 200 && $status < 300 && is_string($body)) return $body;
            elseif ($status === 400 || $status === 403) throw new HttpException(503, 'AI_CONFIGURATION', 'The AI provider cannot be used with the current configuration.');
            else $lastCode = 'AI_PROVIDER_ERROR';
            if ($attempt < 2 && in_array($lastCode, ['AI_TIMEOUT', 'AI_QUOTA', 'AI_UNAVAILABLE'], true)) usleep((100_000 * (2 ** $attempt)) + random_int(0, 50_000));
            else break;
        }
        throw new HttpException(503, $lastCode, 'The AI provider is temporarily unavailable.');
    }

    private function result(string $body): GenerationResult
    {
        try {
            $decoded = json_decode($body, true, 512, JSON_THROW_ON_ERROR);
        } catch (\JsonException) {
            throw new HttpException(503, 'AI_MALFORMED_RESPONSE', 'AI returned invalid data.');
        }
        $text = $decoded['candidates'][0]['content']['parts'][0]['text'] ?? null;
        if (!is_string($text)) {
            $reason = $decoded['promptFeedback']['blockReason'] ?? null;
            throw new HttpException(503, $reason !== null ? 'AI_SAFETY_REFUSAL' : 'AI_MALFORMED_RESPONSE', 'AI did not return a valid proposal.');
        }
        return new GenerationResult($text, isset($decoded['usageMetadata']['promptTokenCount']) ? (int) $decoded['usageMetadata']['promptTokenCount'] : null, isset($decoded['usageMetadata']['candidatesTokenCount']) ? (int) $decoded['usageMetadata']['candidatesTokenCount'] : null);
    }

    private function schema(): array
    {
        return ['type' => 'object', 'required' => ['schema_version','summary','operations'], 'properties' => ['schema_version' => ['type' => 'integer'], 'summary' => ['type' => 'string'], 'operations' => ['type' => 'array', 'maxItems' => 50, 'items' => ['type' => 'object']]]];
    }
}
