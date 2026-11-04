<?php

declare(strict_types=1);

namespace Tests\Plain\Unit;

use PHPUnit\Framework\TestCase;
use Planner\Http\HttpException;
use Planner\Infrastructure\AI\GoogleAIProvider;

final class GoogleAIProviderTest extends TestCase
{
    public function test_a_retired_model_is_a_configuration_error_without_retries(): void
    {
        $calls = 0;
        $error = $this->failure($this->provider([404], $calls));

        self::assertSame('AI_CONFIGURATION', $error->errorCode);
        self::assertSame('The AI provider cannot be used with the current configuration.', $error->getMessage());
        self::assertSame(1, $calls);
    }

    public function test_quota_exhaustion_is_retried_then_named(): void
    {
        $calls = 0;
        $error = $this->failure($this->provider([429, 429, 429], $calls));

        self::assertSame('AI_QUOTA', $error->errorCode);
        self::assertSame('The AI usage limit has been reached. Try again later.', $error->getMessage());
        self::assertSame(3, $calls);
    }

    public function test_a_temporary_outage_is_retried_until_the_model_answers(): void
    {
        $calls = 0;
        $reply = $this->provider([503, 200], $calls)->chat('system', [['role' => 'user', 'parts' => [['text' => 'Hi']]]], []);

        self::assertSame('Hello', $reply['text']);
        self::assertSame(2, $calls);
    }

    public function test_the_api_key_travels_in_a_header_not_the_url(): void
    {
        $seen = [];
        $provider = new GoogleAIProvider('secret-key', 'gemini-test', static function (string $url, array $headers) use (&$seen): array {
            $seen = [$url, $headers];

            return ['status' => 200, 'body' => self::answer(), 'error' => 0];
        });
        $provider->chat('system', [], []);

        self::assertStringNotContainsString('secret-key', $seen[0]);
        self::assertStringEndsWith('/models/gemini-test:generateContent', $seen[0]);
        self::assertContains('x-goog-api-key: secret-key', $seen[1]);
    }

    /** @param list<int> $statuses */
    private function provider(array $statuses, int &$calls): GoogleAIProvider
    {
        return new GoogleAIProvider('key', 'gemini-test', static function () use (&$statuses, &$calls): array {
            $calls++;
            $status = array_shift($statuses) ?? 500;

            return ['status' => $status, 'body' => $status === 200 ? self::answer() : '{"error":{}}', 'error' => 0];
        });
    }

    private static function answer(): string
    {
        return json_encode(['candidates' => [['content' => ['role' => 'model', 'parts' => [['text' => 'Hello']]]]]], JSON_THROW_ON_ERROR);
    }

    private function failure(GoogleAIProvider $provider): HttpException
    {
        try {
            $provider->chat('system', [], []);
        } catch (HttpException $error) {
            return $error;
        }
        self::fail('The provider should have failed.');
    }
}
