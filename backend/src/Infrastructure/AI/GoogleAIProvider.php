<?php

declare(strict_types=1);

namespace Planner\Infrastructure\AI;

use Planner\Application\AI\AIProviderInterface;
use Planner\Application\AI\GenerationRequest;
use Planner\Application\AI\GenerationResult;
use Planner\Http\HttpException;

final readonly class GoogleAIProvider implements AIProviderInterface
{
    /** @var \Closure(string, list<string>, string): array{status:int, body:string|false, error:int} */
    private \Closure $transport;

    /**
     * @param (\Closure(string, list<string>, string): array{status:int, body:string|false, error:int})|null $transport
     *        HTTP POST seam for tests; defaults to cURL.
     */
    public function __construct(
        private string $apiKey,
        private string $model,
        ?\Closure $transport = null,
        private string $embeddingModel = 'gemini-embedding-001',
    ) {
        $this->transport = $transport ?? static function (string $url, array $headers, string $body): array {
            $curl = curl_init($url);
            curl_setopt_array($curl, [CURLOPT_POST => true, CURLOPT_RETURNTRANSFER => true, CURLOPT_CONNECTTIMEOUT => 5, CURLOPT_TIMEOUT => 30, CURLOPT_HTTPHEADER => $headers, CURLOPT_POSTFIELDS => $body]);
            $response = curl_exec($curl);

            return ['status' => (int) curl_getinfo($curl, CURLINFO_RESPONSE_CODE), 'body' => is_string($response) ? $response : false, 'error' => curl_errno($curl)];
        };
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

    public function complete(string $system, string $prompt, ?array $jsonSchema = null): string
    {
        $payload = [
            'system_instruction' => ['parts' => [['text' => $system]]],
            'contents' => [['role' => 'user', 'parts' => [['text' => $prompt]]]],
        ];
        if ($jsonSchema !== null) {
            $payload['generationConfig'] = ['responseMimeType' => 'application/json', 'responseJsonSchema' => $jsonSchema];
        }
        $body = $this->post($payload);
        try {
            $decoded = json_decode($body, true, 512, JSON_THROW_ON_ERROR);
        } catch (\JsonException) {
            throw new HttpException(503, 'AI_MALFORMED_RESPONSE', 'AI returned invalid data.');
        }
        $text = '';
        foreach ($decoded['candidates'][0]['content']['parts'] ?? [] as $part) {
            if (is_string($part['text'] ?? null) && ($part['thought'] ?? false) !== true) {
                $text .= $part['text'];
            }
        }
        if (trim($text) === '') {
            throw new HttpException(503, isset($decoded['promptFeedback']['blockReason']) ? 'AI_SAFETY_REFUSAL' : 'AI_MALFORMED_RESPONSE', 'AI did not return an answer.');
        }

        return trim($text);
    }

    public function embed(array $texts, string $task): array
    {
        if ($texts === []) {
            return [];
        }
        $requests = array_map(fn (string $text): array => [
            'model' => 'models/'.$this->embeddingModel,
            'content' => ['parts' => [['text' => mb_substr($text, 0, 6000, 'UTF-8')]]],
            'taskType' => $task === 'query' ? 'RETRIEVAL_QUERY' : 'RETRIEVAL_DOCUMENT',
            'outputDimensionality' => 256,
        ], array_values($texts));
        $body = $this->post(['requests' => $requests], $this->embeddingModel, 'batchEmbedContents');
        try {
            $decoded = json_decode($body, true, 512, JSON_THROW_ON_ERROR);
        } catch (\JsonException) {
            throw new HttpException(503, 'AI_MALFORMED_RESPONSE', 'AI returned invalid data.');
        }
        $vectors = [];
        foreach ($decoded['embeddings'] ?? [] as $embedding) {
            $values = $embedding['values'] ?? null;
            if (! is_array($values) || $values === []) {
                throw new HttpException(503, 'AI_MALFORMED_RESPONSE', 'AI returned invalid data.');
            }
            $vectors[] = array_map('floatval', $values);
        }
        if (count($vectors) !== count($texts)) {
            throw new HttpException(503, 'AI_MALFORMED_RESPONSE', 'AI returned invalid data.');
        }

        return $vectors;
    }

    public function embeddingModel(): string
    {
        return $this->embeddingModel;
    }

    /** @param array<string, mixed> $payload */
    private function post(array $payload, ?string $model = null, string $method = 'generateContent'): string
    {
        $url = 'https://generativelanguage.googleapis.com/v1beta/models/'.rawurlencode($model ?? $this->model).':'.$method;
        $lastCode = 'AI_UNAVAILABLE';
        $headers = ['Content-Type: application/json', 'x-goog-api-key: '.$this->apiKey];
        $body = json_encode($payload, JSON_THROW_ON_ERROR);
        for ($attempt = 0; $attempt < 3; $attempt++) {
            ['status' => $status, 'body' => $response, 'error' => $error] = ($this->transport)($url, $headers, $body);
            if ($error !== 0) $lastCode = $error === CURLE_OPERATION_TIMEDOUT ? 'AI_TIMEOUT' : 'AI_UNAVAILABLE';
            elseif ($status === 429) $lastCode = 'AI_QUOTA';
            elseif ($status === 503) $lastCode = 'AI_UNAVAILABLE';
            elseif ($status >= 200 && $status < 300 && is_string($response)) return $response;
            // 404 means the configured model is retired or misspelt: waiting will not help (ISSUE-025).
            elseif ($status === 400 || $status === 403 || $status === 404) throw new HttpException(503, 'AI_CONFIGURATION', 'The AI provider cannot be used with the current configuration.');
            else $lastCode = 'AI_PROVIDER_ERROR';
            if ($attempt < 2 && in_array($lastCode, ['AI_TIMEOUT', 'AI_QUOTA', 'AI_UNAVAILABLE'], true)) usleep((100_000 * (2 ** $attempt)) + random_int(0, 50_000));
            else break;
        }
        if ($lastCode === 'AI_QUOTA') {
            throw new HttpException(503, 'AI_QUOTA', 'The AI usage limit has been reached. Try again later.');
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
