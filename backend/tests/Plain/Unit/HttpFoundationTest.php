<?php

declare(strict_types=1);

namespace Tests\Plain\Unit;

use PHPUnit\Framework\TestCase;
use Planner\Http\HttpException;
use Planner\Http\Request;
use Planner\Http\Response;
use Planner\Http\Routing\Route;
use Planner\Http\Routing\Router;
use Planner\Infrastructure\Session\SessionCipher;
use RuntimeException;

final class HttpFoundationTest extends TestCase
{
    public function test_router_matches_parameter_and_head_to_get(): void
    {
        $route = new Route(
            ['GET'],
            '/items/{id}',
            'items.show',
            static fn (Request $request, array $parameters): Response => Response::json($parameters),
        );
        $router = new Router([$route]);

        $match = $router->match('HEAD', '/items/a%20b');

        self::assertSame('items.show', $match->route->name);
        self::assertSame(['id' => 'a b'], $match->parameters);
    }

    public function test_router_returns_405_with_allow_for_known_path(): void
    {
        $router = new Router([new Route(
            ['GET'],
            '/items',
            'items.index',
            static fn (Request $request, array $parameters): Response => Response::json([]),
        )]);

        try {
            $router->match('POST', '/items');
            self::fail('Expected method rejection.');
        } catch (HttpException $exception) {
            self::assertSame(405, $exception->status);
            self::assertSame('GET', $exception->headers['Allow']);
        }
    }

    public function test_router_rejects_encoded_separator_and_malformed_escape(): void
    {
        $router = new Router([]);

        foreach (['/items/a%2Fb', '/items/%zz'] as $path) {
            try {
                $router->match('GET', $path);
                self::fail('Expected invalid path rejection.');
            } catch (HttpException $exception) {
                self::assertSame(400, $exception->status);
                self::assertSame('INVALID_PATH', $exception->errorCode);
            }
        }
    }

    public function test_request_rejects_malformed_and_non_object_json(): void
    {
        foreach (['{', '[]'] as $json) {
            $request = new Request('POST', '/api/test', headers: ['content-type' => 'application/json'], rawBody: $json);

            try {
                $request->input();
                self::fail('Expected malformed JSON rejection.');
            } catch (HttpException $exception) {
                self::assertSame(400, $exception->status);
                self::assertSame('MALFORMED_JSON', $exception->errorCode);
            }
        }
    }

    public function test_session_cipher_round_trips_and_rejects_tampering(): void
    {
        $cipher = SessionCipher::fromEncodedKey(str_repeat('01', 32));
        $encrypted = $cipher->encrypt('session-id', 'private payload');

        self::assertSame('private payload', $cipher->decrypt('session-id', $encrypted));
        self::assertStringNotContainsString('private payload', $encrypted);

        $encrypted[10] = chr(ord($encrypted[10]) ^ 1);

        $this->expectException(RuntimeException::class);
        $cipher->decrypt('session-id', $encrypted);
    }
}
