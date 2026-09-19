<?php

declare(strict_types=1);

namespace Tests\Plain\Http;

use PDO;
use PHPUnit\Framework\TestCase;
use Planner\Http\Application;
use Planner\Http\Request;
use Planner\Http\Response;
use Planner\Infrastructure\Database\MigrationRunner;
use Planner\Infrastructure\Session\SessionManager;
use RuntimeException;

final class AccountHttpTest extends TestCase
{
    /** @var array<string, mixed> */
    private array $runtime;

    private Application $application;

    private SessionManager $session;

    private PDO $pdo;

    protected function setUp(): void
    {
        if (session_status() === PHP_SESSION_ACTIVE) {
            session_write_close();
        }

        session_id('');
        $_SESSION = [];
        $_COOKIE = [];
        $this->runtime = require dirname(__DIR__, 3).'/bootstrap/http.php';
        $this->application = $this->runtime['application'];
        $this->session = $this->runtime['session'];
        $this->pdo = $this->runtime['pdo'];
        self::assertSame('goals_test', $this->pdo->query('SELECT DATABASE()')->fetchColumn());
        $this->wipeTargetDatabase();
        (new MigrationRunner(
            $this->pdo,
            dirname(__DIR__, 3).'/database/plain-migrations',
            'goals_test',
        ))->migrate();
    }

    protected function tearDown(): void
    {
        $this->session->close();
        session_id('');
        $_SESSION = [];
        $_COOKIE = [];
    }

    public function test_registration_session_profile_preferences_and_password_flow(): void
    {
        $registrationPage = $this->request('GET', '/register');
        self::assertSame(200, $registrationPage->status);
        preg_match('/name="_token" value="([a-f0-9]{64})"/', $registrationPage->body, $tokenMatch);
        self::assertArrayHasKey(1, $tokenMatch);
        $csrf = $tokenMatch[1];
        $cookie = $this->session->id();

        $registered = $this->request('POST', '/register', [
            '_token' => $csrf,
            'display_name' => '  Alex Morgan  ',
            'email' => ' Owner@Example.Test ',
            'password' => 'correct horse battery staple',
            'password_confirmation' => 'correct horse battery staple',
        ], $cookie);
        self::assertSame(302, $registered->status);
        self::assertSame('/', $registered->headers['Location']);
        $authenticatedCookie = $this->session->id();
        self::assertNotSame($cookie, $authenticatedCookie);

        $sessionResponse = $this->request('GET', '/api/v1/session', cookie: $authenticatedCookie);
        self::assertSame(200, $sessionResponse->status);
        $sessionPayload = json_decode($sessionResponse->body, true, flags: JSON_THROW_ON_ERROR);
        self::assertSame('owner@example.test', $sessionPayload['data']['user']['email']);
        self::assertSame('Alex Morgan', $sessionPayload['data']['user']['display_name']);
        self::assertSame('light', $sessionPayload['data']['preferences']['theme']);
        self::assertSame(3, (int) $this->pdo->query(
            'SELECT COUNT(*) FROM areas WHERE user_id = '.(int) $sessionPayload['data']['user']['id'],
        )->fetchColumn());
        $apiCsrf = $sessionPayload['data']['csrf_token'];

        $profile = $this->request('PATCH', '/api/v1/profile', ['display_name' => 'New name'], $authenticatedCookie, $apiCsrf, true);
        self::assertSame(200, $profile->status);
        self::assertSame('New name', json_decode($profile->body, true, flags: JSON_THROW_ON_ERROR)['data']['display_name']);

        $preferences = $this->request('PATCH', '/api/v1/preferences', [
            'theme' => 'dark',
            'note_font_size' => 18,
            'default_note_color' => 'mint',
            'notes_view' => 'list',
            'timezone' => 'America/Mexico_City',
        ], $authenticatedCookie, $apiCsrf, true);
        self::assertSame(200, $preferences->status);
        self::assertSame('America/Mexico_City', json_decode($preferences->body, true, flags: JSON_THROW_ON_ERROR)['data']['timezone']);

        $password = $this->request('POST', '/api/v1/password', [
            'current_password' => 'correct horse battery staple',
            'password' => 'replacement password',
            'password_confirmation' => 'replacement password',
        ], $authenticatedCookie, $apiCsrf, true);
        self::assertSame(200, $password->status);
        self::assertSame(0, (int) $this->pdo->query('SELECT COUNT(*) FROM sessions')->fetchColumn());

        $oldSession = $this->request('GET', '/api/v1/session', cookie: $authenticatedCookie);
        self::assertSame(401, $oldSession->status);
        self::assertSame('AUTH_REQUIRED', json_decode($oldSession->body, true, flags: JSON_THROW_ON_ERROR)['code']);
    }

    public function test_mutation_rejects_missing_csrf_and_unknown_fields_without_writing(): void
    {
        [$cookie, $csrf] = $this->registerAccount('safe@example.test');

        $missingCsrf = $this->request('PATCH', '/api/v1/profile', ['display_name' => 'Changed'], $cookie, json: true);
        self::assertSame(419, $missingCsrf->status);

        $unknown = $this->request('PATCH', '/api/v1/profile', [
            'display_name' => 'Changed',
            'role' => 'admin',
        ], $cookie, $csrf, true);
        self::assertSame(422, $unknown->status);
        self::assertSame('VALIDATION_FAILED', json_decode($unknown->body, true, flags: JSON_THROW_ON_ERROR)['code']);
        self::assertSame('Test User', $this->pdo->query("SELECT display_name FROM users WHERE email = 'safe@example.test'")->fetchColumn());
    }

    public function test_guest_api_is_401_and_browser_route_redirects_without_disclosure(): void
    {
        $api = $this->request('GET', '/api/v1/notes');
        $page = $this->request('GET', '/');

        self::assertSame(401, $api->status);
        self::assertSame('AUTH_REQUIRED', json_decode($api->body, true, flags: JSON_THROW_ON_ERROR)['code']);
        self::assertSame(302, $page->status);
        self::assertSame('/login', $page->headers['Location']);
    }

    public function test_php_templates_preserve_dom_contract_and_escape_bootstrap_data(): void
    {
        $registration = $this->request('GET', '/register');
        preg_match('/name="_token" value="([a-f0-9]{64})"/', $registration->body, $match);
        $cookie = $this->session->id();
        $displayName = '</meta><script>alert(1)</script>';
        $this->request('POST', '/register', [
            '_token' => $match[1],
            'display_name' => $displayName,
            'email' => 'escaped@example.test',
            'password' => 'correct horse battery staple',
            'password_confirmation' => 'correct horse battery staple',
        ], $cookie);

        $page = $this->request('GET', '/', cookie: $this->session->id());

        self::assertSame(200, $page->status);
        self::assertStringContainsString('data-notes-workspace', $page->body);
        self::assertStringContainsString('data-editor-dialog', $page->body);
        self::assertStringContainsString('/build/assets/', $page->body);
        self::assertStringNotContainsString('<script>alert(1)</script>', $page->body);
        self::assertStringContainsString('&lt;/meta&gt;&lt;script&gt;alert(1)&lt;/script&gt;', $page->body);
        preg_match('/<meta id="notes-bootstrap" data-json="([^"]+)">/', $page->body, $bootstrapMatch);
        self::assertArrayHasKey(1, $bootstrapMatch);
        $bootstrap = json_decode(html_entity_decode($bootstrapMatch[1], ENT_QUOTES | ENT_HTML5, 'UTF-8'), true, flags: JSON_THROW_ON_ERROR);
        self::assertSame($displayName, $bootstrap['user']['display_name']);

        foreach (['/settings/profile', '/settings/preferences', '/settings/password'] as $path) {
            $settings = $this->request('GET', $path, cookie: $this->session->id());
            self::assertSame(200, $settings->status);
            self::assertStringContainsString('settings-page', $settings->body);
        }
    }

    public function test_login_errors_are_generic_and_account_bucket_throttles_after_five_failures(): void
    {
        [$authenticatedCookie, $csrf] = $this->registerAccount('owner@example.test');
        $this->request('POST', '/logout', ['_token' => $csrf], $authenticatedCookie);

        foreach (['missing@example.test', 'owner@example.test'] as $email) {
            $page = $this->request('GET', '/login');
            preg_match('/name="_token" value="([a-f0-9]{64})"/', $page->body, $match);
            $cookie = $this->session->id();
            $response = $this->request('POST', '/login', [
                '_token' => $match[1],
                'email' => $email,
                'password' => 'wrong password',
            ], $cookie);
            self::assertSame(302, $response->status);
            $errorPage = $this->request('GET', '/login', cookie: $this->session->id());
            self::assertStringContainsString('The email or password is incorrect.', $errorPage->body);
        }

        $loginPage = $this->request('GET', '/login');
        preg_match('/name="_token" value="([a-f0-9]{64})"/', $loginPage->body, $match);
        $cookie = $this->session->id();

        for ($attempt = 1; $attempt <= 4; $attempt++) {
            $this->request('POST', '/login', [
                '_token' => $match[1],
                'email' => 'owner@example.test',
                'password' => 'wrong password',
            ], $cookie);
        }

        $limited = $this->request('POST', '/login', [
            '_token' => $match[1],
            'email' => 'owner@example.test',
            'password' => 'wrong password',
        ], $cookie);
        self::assertSame(429, $limited->status);
        self::assertArrayHasKey('Retry-After', $limited->headers);
    }

    public function test_cross_site_origin_is_rejected_even_with_valid_token(): void
    {
        [$cookie, $csrf] = $this->registerAccount('origin@example.test');

        $response = $this->request(
            'PATCH',
            '/api/v1/profile',
            ['display_name' => 'Changed'],
            $cookie,
            $csrf,
            true,
            ['origin' => 'https://attacker.example', 'sec-fetch-site' => 'cross-site'],
        );

        self::assertSame(419, $response->status);
        self::assertSame('SESSION_EXPIRED', json_decode($response->body, true, flags: JSON_THROW_ON_ERROR)['code']);
        self::assertSame('Test User', $this->pdo->query("SELECT display_name FROM users WHERE email = 'origin@example.test'")->fetchColumn());
    }

    public function test_tampered_encrypted_session_is_rejected_without_exposing_payload(): void
    {
        [$cookie] = $this->registerAccount('tamper@example.test');
        $payload = $this->pdo->query('SELECT payload FROM sessions WHERE id = '.$this->pdo->quote($cookie))->fetchColumn();
        self::assertIsString($payload);
        self::assertStringNotContainsString('user_id', $payload);
        $tampered = $payload;
        $tampered[10] = chr(ord($tampered[10]) ^ 1);
        $statement = $this->pdo->prepare('UPDATE sessions SET payload = :payload WHERE id = :id');
        $statement->execute(['payload' => $tampered, 'id' => $cookie]);

        $response = $this->request('GET', '/api/v1/session', cookie: $cookie);

        self::assertSame(401, $response->status);
        self::assertSame('AUTH_REQUIRED', json_decode($response->body, true, flags: JSON_THROW_ON_ERROR)['code']);
    }

    /** @return array{string, string} */
    private function registerAccount(string $email): array
    {
        $page = $this->request('GET', '/register');
        preg_match('/name="_token" value="([a-f0-9]{64})"/', $page->body, $match);
        $cookie = $this->session->id();
        $this->request('POST', '/register', [
            '_token' => $match[1],
            'display_name' => 'Test User',
            'email' => $email,
            'password' => 'correct horse battery staple',
            'password_confirmation' => 'correct horse battery staple',
        ], $cookie);
        $cookie = $this->session->id();
        $session = $this->request('GET', '/api/v1/session', cookie: $cookie);
        $csrf = json_decode($session->body, true, flags: JSON_THROW_ON_ERROR)['data']['csrf_token'];

        return [$cookie, $csrf];
    }

    /** @param array<string, mixed> $input */
    private function request(
        string $method,
        string $path,
        array $input = [],
        ?string $cookie = null,
        ?string $csrf = null,
        bool $json = false,
        array $extraHeaders = [],
    ): Response {
        $headers = [
            'accept' => str_starts_with($path, '/api/') ? 'application/json' : 'text/html',
            ...$extraHeaders,
        ];
        $form = $input;
        $body = '';

        if ($json) {
            $headers['content-type'] = 'application/json';
            $body = json_encode($input, JSON_THROW_ON_ERROR);
            $form = [];
        }

        if ($csrf !== null) {
            $headers['x-csrf-token'] = $csrf;
        }

        return $this->application->handle(new Request(
            $method,
            $path,
            headers: $headers,
            cookies: $cookie === null ? [] : ['planner_session' => $cookie],
            form: $form,
            server: ['REMOTE_ADDR' => '198.51.100.10'],
            rawBody: $body,
        ));
    }

    private function wipeTargetDatabase(): void
    {
        $tables = $this->pdo->query(
            "SELECT table_name FROM information_schema.tables WHERE table_schema = 'goals_test' AND table_type = 'BASE TABLE'",
        )->fetchAll(PDO::FETCH_COLUMN);
        $this->pdo->exec('SET FOREIGN_KEY_CHECKS = 0');

        try {
            foreach ($tables as $table) {
                if (! is_string($table) || preg_match('/^[a-z0-9_]+$/', $table) !== 1) {
                    throw new RuntimeException('Unsafe test table name.');
                }

                $this->pdo->exec("DROP TABLE `$table`");
            }
        } finally {
            $this->pdo->exec('SET FOREIGN_KEY_CHECKS = 1');
        }
    }
}
