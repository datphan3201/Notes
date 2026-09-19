<?php

declare(strict_types=1);

namespace Planner\Infrastructure\AI;

use Planner\Application\AI\AIProviderInterface;
use Planner\Application\AI\GenerationRequest;
use Planner\Application\AI\GenerationResult;
use Planner\Http\HttpException;

final readonly class GoogleAIProvider implements AIProviderInterface
{
    public function __construct(private string $apiKey, private string $model) {}
    public function name(): string { return 'google'; }
    public function model(): string { return $this->model; }

    public function generate(GenerationRequest $request): GenerationResult
    {
        $payload = [
            'system_instruction' => ['parts' => [['text' => 'Return only a safe planning proposal matching the supplied JSON schema. Never include ownership, status, timestamps, code, SQL, or URLs.']]],
            'contents' => [['role' => 'user', 'parts' => [['text' => json_encode(['capability' => $request->capability, 'instruction' => $request->instruction, 'context' => $request->context], JSON_UNESCAPED_UNICODE | JSON_THROW_ON_ERROR)]]]],
            'generationConfig' => ['responseMimeType' => 'application/json', 'responseJsonSchema' => $this->schema()],
        ];
        $url = 'https://generativelanguage.googleapis.com/v1beta/models/'.rawurlencode($this->model).':generateContent';
        $lastCode = 'AI_UNAVAILABLE';
        for ($attempt = 0; $attempt < 3; $attempt++) {
            $curl = curl_init($url);
            curl_setopt_array($curl, [CURLOPT_POST => true, CURLOPT_RETURNTRANSFER => true, CURLOPT_CONNECTTIMEOUT => 5, CURLOPT_TIMEOUT => 30, CURLOPT_HTTPHEADER => ['Content-Type: application/json', 'x-goog-api-key: '.$this->apiKey], CURLOPT_POSTFIELDS => json_encode($payload, JSON_THROW_ON_ERROR)]);
            $body = curl_exec($curl); $status = (int) curl_getinfo($curl, CURLINFO_RESPONSE_CODE); $error = curl_errno($curl); curl_close($curl);
            if ($error !== 0) $lastCode = $error === CURLE_OPERATION_TIMEDOUT ? 'AI_TIMEOUT' : 'AI_UNAVAILABLE';
            elseif ($status === 429) $lastCode = 'AI_QUOTA';
            elseif ($status === 503) $lastCode = 'AI_UNAVAILABLE';
            elseif ($status >= 200 && $status < 300 && is_string($body)) return $this->result($body);
            elseif ($status === 400 || $status === 403) throw new HttpException(503, 'AI_CONFIGURATION', 'The AI provider cannot be used with the current configuration.');
            else $lastCode = 'AI_PROVIDER_ERROR';
            if ($attempt < 2 && in_array($lastCode, ['AI_TIMEOUT', 'AI_QUOTA', 'AI_UNAVAILABLE'], true)) usleep((100_000 * (2 ** $attempt)) + random_int(0, 50_000)); else break;
        }
        throw new HttpException(503, $lastCode, 'The AI provider is temporarily unavailable.');
    }

    private function result(string $body): GenerationResult
    {
        try { $decoded = json_decode($body, true, 512, JSON_THROW_ON_ERROR); } catch (\JsonException) { throw new HttpException(503, 'AI_MALFORMED_RESPONSE', 'AI returned invalid data.'); }
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
