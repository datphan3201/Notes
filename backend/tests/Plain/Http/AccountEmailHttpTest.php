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

final class AccountEmailHttpTest extends TestCase
{
    private array $runtime;
    private Application $application;
    private SessionManager $session;
    private PDO $pdo;

    protected function setUp(): void
    {
        if (session_status() === PHP_SESSION_ACTIVE) session_write_close();
        session_id('');
        $_SESSION = [];
        $_COOKIE = [];
        $_GET = [];
        $this->runtime = require dirname(__DIR__, 3).'/bootstrap/http.php';
        $this->application = $this->runtime['application'];
        $this->session = $this->runtime['session'];
        $this->pdo = $this->runtime['pdo'];
        self::assertSame('goals_test', $this->pdo->query('SELECT DATABASE()')->fetchColumn());
        $this->wipe();
        (new MigrationRunner($this->pdo, dirname(__DIR__, 3).'/database/plain-migrations', 'goals_test'))->migrate();
    }

    protected function tearDown(): void
    {
        $this->session->close();
        session_id('');
        $_SESSION = [];
        $_COOKIE = [];
    }

    public function test_vietnamese_sign_up_localizes_pages_areas_and_sends_a_verification_link(): void
    {
        $page = $this->request('GET', '/register', query: ['lang' => 'vi']);
        self::assertSame(200, $page->status);
        self::assertStringContainsString('<html lang="vi">', $page->body);
        self::assertStringContainsString('Tạo tài khoản', $page->body);
        $cookie = $this->session->id();
        preg_match('/name="_token" value="([a-f0-9]{64})"/', $page->body, $match);
        $registered = $this->request('POST', '/register', ['_token' => $match[1], 'display_name' => 'Lan', 'email' => 'lan@example.test', 'password' => 'correct horse battery staple', 'password_confirmation' => 'correct horse battery staple'], $cookie);
        self::assertSame('/dashboard', $registered->headers['Location']);
        $cookie = $this->session->id();
        $session = $this->json($this->request('GET', '/api/v1/session', cookie: $cookie))['data'];
        self::assertSame('vi', $session['preferences']['locale']);
        self::assertFalse($session['user']['email_verified']);
        $areas = array_column($this->json($this->request('GET', '/api/v1/areas', cookie: $cookie))['data'], 'name');
        self::assertSame(['Lĩnh vực 1', 'Lĩnh vực 2', 'Lĩnh vực 3'], $areas);

        $status = $this->json($this->request('GET', '/api/v1/email', cookie: $cookie))['data'];
        self::assertSame(['email' => 'lan@example.test', 'verified' => false, 'pending_email' => null], array_intersect_key($status, ['email' => 0, 'verified' => 0, 'pending_email' => 0]));
        $token = $this->latestOutboxToken('lan@example.test', '/verify-email');
        $invalid = $this->request('GET', '/verify-email', query: ['token' => str_repeat('0', 64)], cookie: $cookie);
        self::assertSame(422, $invalid->status);
        $verified = $this->request('GET', '/verify-email', query: ['token' => $token], cookie: $cookie);
        self::assertSame(200, $verified->status);
        self::assertStringContainsString('Đã xác minh email', $verified->body);
        self::assertTrue($this->json($this->request('GET', '/api/v1/email', cookie: $cookie))['data']['verified']);

        $csrf = $session['csrf_token'];
        $wrong = $this->request('POST', '/api/v1/email/change', ['current_password' => 'nope', 'email' => 'lan.new@example.test'], $cookie, $csrf, true);
        self::assertSame(422, $wrong->status);
        $accepted = $this->request('POST', '/api/v1/email/change', ['current_password' => 'correct horse battery staple', 'email' => 'lan.new@example.test'], $cookie, $csrf, true);
        self::assertSame(202, $accepted->status);
        $confirmed = $this->request('GET', '/confirm-email', query: ['token' => $this->latestOutboxToken('lan.new@example.test', '/confirm-email')], cookie: $cookie);
        self::assertSame(200, $confirmed->status);
        self::assertSame('lan.new@example.test', $this->json($this->request('GET', '/api/v1/email', cookie: $cookie))['data']['email']);
    }

    public function test_review_delete_and_reminder_read_routes_are_owned(): void
    {
        $page = $this->request('GET', '/register');
        self::assertStringContainsString('<html lang="en">', $page->body);
        preg_match('/name="_token" value="([a-f0-9]{64})"/', $page->body, $match);
        $cookie = $this->session->id();
        $this->request('POST', '/register', ['_token' => $match[1], 'display_name' => 'Kim', 'email' => 'kim@example.test', 'password' => 'correct horse battery staple', 'password_confirmation' => 'correct horse battery staple'], $cookie);
        $cookie = $this->session->id();
        $csrf = $this->json($this->request('GET', '/api/v1/session', cookie: $cookie))['data']['csrf_token'];

        $review = $this->json($this->request('POST', '/api/v1/reviews', ['kind' => 'Weekly', 'date' => gmdate('Y-m-d')], $cookie, $csrf, true))['data'];
        self::assertSame(204, $this->request('DELETE', '/api/v1/reviews/'.$review['id'], ['base_version' => $review['version']], $cookie, $csrf, true)->status);
        self::assertSame(404, $this->request('GET', '/api/v1/reviews/'.$review['id'], cookie: $cookie)->status);

        $task = $this->json($this->request('POST', '/api/v1/tasks', ['goal_id' => null, 'milestone_id' => null, 'name' => 'Call', 'reminder_at' => gmdate('Y-m-d\TH:i:s\Z', time() - 60)], $cookie, $csrf, true))['data'];
        self::assertSame(1, $this->json($this->request('GET', '/api/v1/notifications', cookie: $cookie))['data']['unread']);
        self::assertSame(200, $this->request('POST', '/api/v1/reminders/'.$task['id'].'/read', [], $cookie, $csrf, true)->status);
        self::assertSame(0, $this->json($this->request('GET', '/api/v1/notifications', cookie: $cookie))['data']['unread']);
        self::assertSame(404, $this->request('POST', '/api/v1/reminders/not-a-uuid/read', [], $cookie, $csrf, true)->status);
    }

    public function test_password_reset_form_keeps_its_origin_so_the_csrf_check_passes(): void
    {
        $page = $this->request('GET', '/forgot-password');
        // no-referrer made browsers send "Origin: null" on the form POST (419).
        self::assertSame('same-origin', $page->headers['Referrer-Policy']);
        preg_match('/name="_token" value="([a-f0-9]{64})"/', $page->body, $match);
        $cookie = $this->session->id();
        $origin = $this->runtime['config']->string('app.url');
        $send = fn (string $origin): Response => $this->application->handle(new Request('POST', '/forgot-password',
            headers: ['accept' => 'text/html', 'origin' => $origin], cookies: ['planner_session' => $cookie],
            form: ['_token' => $match[1], 'email' => 'nobody@example.test'], server: ['REMOTE_ADDR' => '198.51.100.79']));
        self::assertSame(419, $send('null')->status, 'An opaque origin is still refused.');
        $sent = $send($origin);
        self::assertSame(302, $sent->status);
        self::assertSame('/forgot-password', $sent->headers['Location']);
    }

    private function latestOutboxToken(string $recipient, string $path): string
    {
        $files = glob($this->runtime['config']->string('storage.private_root').'/mail-outbox/*.eml') ?: [];
        usort($files, static fn (string $a, string $b): int => filemtime($b) <=> filemtime($a) ?: strcmp($b, $a));
        foreach ($files as $file) {
            $message = (string) file_get_contents($file);
            if (str_contains($message, 'To: <'.$recipient.'>') && preg_match('#'.preg_quote($path, '#').'\?token=([a-f0-9]{64})#', $message, $match) === 1) {
                return $match[1];
            }
        }
        self::fail("No $path message for $recipient in the local outbox.");
    }

    /** @param array<string, mixed> $input @param array<string, string> $query */
    private function request(string $method, string $path, array $input = [], ?string $cookie = null, ?string $csrf = null, bool $json = false, array $query = []): Response
    {
        $headers = ['accept' => str_starts_with($path, '/api/') ? 'application/json' : 'text/html'];
        $form = $input;
        $body = '';
        if ($json) {
            $headers['content-type'] = 'application/json';
            // An empty body is the JSON object {} that the browser sends.
            $body = json_encode($input === [] ? new \stdClass : $input, JSON_THROW_ON_ERROR);
            $form = [];
        }
        if ($csrf !== null) $headers['x-csrf-token'] = $csrf;
        $_GET = $query;

        return $this->application->handle(new Request($method, $path, $query, $headers, $cookie === null ? [] : ['planner_session' => $cookie], $form, server: ['REMOTE_ADDR' => '198.51.100.78'], rawBody: $body));
    }

    private function json(Response $response): array
    {
        return json_decode($response->body, true, 512, JSON_THROW_ON_ERROR);
    }

    private function wipe(): void
    {
        $tables = $this->pdo->query("SELECT table_name FROM information_schema.tables WHERE table_schema='goals_test' AND table_type='BASE TABLE'")->fetchAll(PDO::FETCH_COLUMN);
        $this->pdo->exec('SET FOREIGN_KEY_CHECKS=0');
        try {
            foreach ($tables as $table) {
                if (!is_string($table) || preg_match('/^[a-z0-9_]+$/', $table) !== 1) throw new RuntimeException('Unsafe table.');
                $this->pdo->exec("DROP TABLE `$table`");
            }
        } finally {
            $this->pdo->exec('SET FOREIGN_KEY_CHECKS=1');
        }
    }
}
