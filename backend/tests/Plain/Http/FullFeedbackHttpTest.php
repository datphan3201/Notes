<?php

declare(strict_types=1);

namespace Tests\Plain\Http;

use PDO;
use PHPUnit\Framework\TestCase;
use Planner\Domain\Account\Totp;
use Planner\Http\Application;
use Planner\Http\Request;
use Planner\Http\Response;
use Planner\Infrastructure\Database\MigrationRunner;
use Planner\Infrastructure\Session\SessionManager;
use RuntimeException;

/** Sharing, reports/locking, two-factor login, Teamwork and notifications. */
final class FullFeedbackHttpTest extends TestCase
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
        (new MigrationRunner($this->pdo, dirname(__DIR__, 3).'/database/plain-migrations', 'goals_test'))->migrate();
    }

    protected function tearDown(): void
    {
        $this->session->close();
        session_id('');
        $_SESSION = [];
        $_COOKIE = [];
    }

    public function test_owner_controls_note_sharing_permissions_and_notifications(): void
    {
        $owner = $this->registerAccount('owner@example.test', 'Owner');
        $friend = $this->registerAccount('friend@example.test', 'Friend');
        $stranger = $this->registerAccount('stranger@example.test', 'Stranger');
        $noteId = '0b9c4b5e-2f3a-4c1d-9e8f-1a2b3c4d5e6f';
        self::assertSame(201, $this->api('POST', '/api/v1/notes', ['id' => $noteId, 'title' => 'Plan', 'content' => 'First draft'], $owner)->status);

        $unknown = $this->api('POST', "/api/v1/notes/$noteId/shares", ['email' => 'nobody@example.test', 'permission' => 'view'], $owner);
        self::assertSame(201, $unknown->status);
        self::assertSame([], $this->data($unknown));
        self::assertSame(404, $this->api('POST', "/api/v1/notes/$noteId/shares", ['email' => 'owner@example.test'], $stranger)->status);

        $shares = $this->data($this->api('POST', "/api/v1/notes/$noteId/shares", ['email' => 'friend@example.test', 'permission' => 'view'], $owner));
        self::assertSame('pending', $shares[0]['status']);
        $shareId = $shares[0]['id'];
        $inbox = $this->data($this->api('GET', '/api/v1/notifications', [], $friend));
        self::assertSame('share_invite', $inbox['items'][0]['type']);
        self::assertSame(404, $this->api('GET', "/api/v1/shared-notes/$noteId", [], $friend)->status);

        self::assertSame(200, $this->api('POST', "/api/v1/shared-notes/invitations/$shareId/accept", [], $friend)->status);
        self::assertSame('share_joined', $this->data($this->api('GET', '/api/v1/notifications', [], $owner))['items'][0]['type']);
        $shared = $this->data($this->api('GET', "/api/v1/shared-notes/$noteId", [], $friend));
        self::assertSame('First draft', $shared['content']);
        self::assertSame('view', $shared['permission']);
        self::assertSame(403, $this->api('PATCH', "/api/v1/shared-notes/$noteId", ['base_version' => 1, 'title' => 'Plan', 'content' => 'Edited'], $friend)->status);
        self::assertSame(404, $this->api('GET', "/api/v1/shared-notes/$noteId", [], $stranger)->status);

        $this->api('PATCH', "/api/v1/notes/$noteId/shares/$shareId", ['permission' => 'edit'], $owner);
        $edited = $this->api('PATCH', "/api/v1/shared-notes/$noteId", ['base_version' => 1, 'title' => 'Plan', 'content' => 'Edited together'], $friend);
        self::assertSame(200, $edited->status);
        self::assertSame(2, $this->data($edited)['version']);
        self::assertSame(409, $this->api('PATCH', "/api/v1/shared-notes/$noteId", ['base_version' => 1, 'title' => 'Plan', 'content' => 'Stale'], $friend)->status);
        self::assertSame(422, $this->api('PATCH', "/api/v1/shared-notes/$noteId", ['base_version' => 2, 'title' => 'Plan', 'content' => 'x', 'color' => 'rose'], $friend)->status);
        $ownerView = $this->data($this->api('GET', "/api/v1/notes/$noteId", [], $owner));
        self::assertSame('Edited together', $ownerView['content']);
        $ownerInbox = $this->data($this->api('GET', '/api/v1/notifications', [], $owner));
        self::assertSame('shared_note_updated', $ownerInbox['items'][0]['type']);
        self::assertSame(0, (int) $this->pdo->query("SELECT COUNT(*) FROM notifications n JOIN users u ON u.id = n.user_id WHERE u.email = 'friend@example.test' AND n.type = 'shared_note_updated'")->fetchColumn());

        $this->api('DELETE', "/api/v1/notes/$noteId/shares/$shareId", [], $owner);
        self::assertSame(404, $this->api('GET', "/api/v1/shared-notes/$noteId", [], $friend)->status);
    }

    public function test_reports_reach_admins_and_locked_accounts_lose_access(): void
    {
        $owner = $this->registerAccount('author@example.test', 'Author');
        $reader = $this->registerAccount('reader@example.test', 'Reader');
        $admin = $this->registerAccount('admin@example.test', 'Admin');
        $this->pdo->exec("UPDATE users SET role = 'admin' WHERE email = 'admin@example.test'");
        $noteId = '1c9c4b5e-2f3a-4c1d-9e8f-1a2b3c4d5e6f';
        $this->api('POST', '/api/v1/notes', ['id' => $noteId, 'title' => 'Bad', 'content' => 'Abusive text'], $owner);
        $shareId = $this->data($this->api('POST', "/api/v1/notes/$noteId/shares", ['email' => 'reader@example.test'], $owner))[0]['id'];
        $this->api('POST', "/api/v1/shared-notes/invitations/$shareId/accept", [], $reader);

        self::assertSame(404, $this->api('GET', '/api/v1/admin/reports', [], $reader)->status);
        self::assertSame(201, $this->api('POST', "/api/v1/shared-notes/$noteId/report", ['reason' => 'Harassment'], $reader)->status);
        self::assertSame(422, $this->api('POST', "/api/v1/shared-notes/$noteId/report", ['reason' => 'Again'], $reader)->status);
        $reports = $this->data($this->api('GET', '/api/v1/admin/reports', [], $admin));
        self::assertCount(1, $reports);
        self::assertSame('Abusive text', $reports[0]['note']['excerpt']);
        self::assertSame('report_new', $this->data($this->api('GET', '/api/v1/notifications', [], $admin))['items'][0]['type']);

        self::assertSame(200, $this->api('POST', '/api/v1/admin/reports/'.$reports[0]['id'].'/resolve', ['status' => 'resolved', 'response' => 'Account locked'], $admin)->status);
        self::assertSame('report_resolved', $this->data($this->api('GET', '/api/v1/notifications', [], $reader))['items'][0]['type']);

        $ownerId = $reports[0]['owner']['id'];
        $adminId = (string) $this->pdo->query("SELECT id FROM users WHERE email = 'admin@example.test'")->fetchColumn();
        self::assertSame(422, $this->api('POST', "/api/v1/admin/users/$adminId/lock", [], $admin)->status);
        self::assertSame(200, $this->api('POST', "/api/v1/admin/users/$ownerId/lock", ['reason' => 'Abuse'], $admin)->status);
        self::assertSame(401, $this->api('GET', '/api/v1/session', [], $owner)->status);
        $login = $this->login('author@example.test');
        self::assertSame('/login', $login->headers['Location']);
        self::assertNull($this->session->userId());

        $this->api('POST', "/api/v1/admin/users/$ownerId/unlock", [], $admin);
        self::assertSame('/dashboard', $this->login('author@example.test')->headers['Location']);
        self::assertSame(200, $this->data($this->api('PATCH', '/api/v1/admin/settings', ['history_limit' => 100], $admin)) === ['history_limit' => 100] ? 200 : 500);
    }

    public function test_totp_two_factor_login_requires_a_valid_code(): void
    {
        $user = $this->registerAccount('secure@example.test', 'Secure');
        $setup = $this->data($this->api('POST', '/api/v1/two-factor/totp', [], $user));
        self::assertStringStartsWith('otpauth://totp/', $setup['uri']);
        self::assertSame(422, $this->api('POST', '/api/v1/two-factor/totp/confirm', ['code' => '000000'], $user)->status);
        $code = Totp::code($setup['secret'], $this->runtime['clock']->now()->getTimestamp());
        self::assertSame('totp', $this->data($this->api('POST', '/api/v1/two-factor/totp/confirm', ['code' => $code], $user))['method']);
        self::assertNotSame($setup['secret'], $this->pdo->query("SELECT two_factor_secret FROM users WHERE email = 'secure@example.test'")->fetchColumn());

        $login = $this->login('secure@example.test');
        self::assertSame('/two-factor', $login->headers['Location']);
        $cookie = $this->session->id();
        self::assertNull($this->session->userId());
        self::assertSame(401, $this->request('GET', '/api/v1/session', cookie: $cookie)->status);
        $page = $this->request('GET', '/two-factor', cookie: $cookie);
        preg_match('/name="_token" value="([a-f0-9]{64})"/', $page->body, $token);
        $wrong = $this->request('POST', '/two-factor', ['_token' => $token[1], 'code' => '000000'], $cookie);
        self::assertSame('/two-factor', $wrong->headers['Location']);
        $right = $this->request('POST', '/two-factor', ['_token' => $token[1], 'code' => Totp::code($setup['secret'], $this->runtime['clock']->now()->getTimestamp())], $cookie);
        self::assertSame('/dashboard', $right->headers['Location']);
        self::assertSame(200, $this->request('GET', '/api/v1/session', cookie: $this->session->id())->status);
    }

    public function test_teamwork_roles_tasks_chat_and_member_isolation(): void
    {
        $lead = $this->registerAccount('lead@example.test', 'Lead');
        $viewer = $this->registerAccount('viewer@example.test', 'Viewer');
        $outsider = $this->registerAccount('outsider@example.test', 'Outsider');
        $goal = $this->data($this->api('POST', '/api/v1/team-goals', [
            'name' => 'Project Phoenix', 'description' => 'Launch', 'due_date' => '2026-11-30',
            'members' => [['email' => 'viewer@example.test', 'role' => 'viewer'], ['email' => 'ghost@example.test', 'role' => 'editor']],
        ], $lead));
        self::assertCount(2, $goal['members']);
        $goalId = $goal['id'];
        self::assertSame(404, $this->api('GET', "/api/v1/team-goals/$goalId", [], $outsider)->status);
        self::assertSame(404, $this->api('GET', "/api/v1/team-goals/$goalId", [], $viewer)->status);
        self::assertSame('team_invite', $this->data($this->api('GET', '/api/v1/notifications', [], $viewer))['items'][0]['type']);
        $this->api('POST', "/api/v1/team-goals/$goalId/invitation/accept", [], $viewer);
        $viewerId = (string) $this->pdo->query("SELECT id FROM users WHERE email = 'viewer@example.test'")->fetchColumn();
        $leadId = (string) $this->pdo->query("SELECT id FROM users WHERE email = 'lead@example.test'")->fetchColumn();

        self::assertSame(403, $this->api('POST', "/api/v1/team-goals/$goalId/tasks", ['name' => 'Sneaky'], $viewer)->status);
        $detail = $this->data($this->api('POST', "/api/v1/team-goals/$goalId/tasks", ['name' => 'Design mockups', 'assignee_id' => $viewerId], $lead));
        $task = $detail['tasks'][0];
        self::assertSame('team_task_assigned', $this->data($this->api('GET', '/api/v1/notifications', [], $viewer))['items'][0]['type']);
        $done = $this->data($this->api('PATCH', "/api/v1/team-goals/$goalId/tasks/{$task['id']}", ['base_version' => 1, 'status' => 'done'], $viewer));
        self::assertSame(['done' => 1, 'total' => 1], $done['progress']);
        self::assertSame(403, $this->api('PATCH', "/api/v1/team-goals/$goalId/tasks/{$task['id']}", ['base_version' => 2, 'name' => 'Renamed'], $viewer)->status);
        self::assertSame(422, $this->api('PATCH', "/api/v1/team-goals/$goalId/members/$leadId", ['role' => 'viewer'], $lead)->status);

        $this->api('POST', "/api/v1/team-goals/$goalId/messages", ['body' => 'Hello team'], $viewer);
        $messages = $this->data($this->api('GET', "/api/v1/team-goals/$goalId/messages?after=0", [], $lead));
        self::assertSame('Hello team', $messages[0]['body']);
        self::assertFalse($messages[0]['mine']);
        self::assertSame(404, $this->api('GET', "/api/v1/team-goals/$goalId/messages?after=0", [], $outsider)->status);
        self::assertSame(204, $this->api('DELETE', "/api/v1/team-goals/$goalId/members/$viewerId", [], $viewer)->status);
        self::assertSame(404, $this->api('GET', "/api/v1/team-goals/$goalId", [], $viewer)->status);
    }

    public function test_team_tasks_capture_planning_fields_repeat_and_remind_the_assignee(): void
    {
        $lead = $this->registerAccount('planner-lead@example.test', 'Lead');
        $goalId = $this->data($this->api('POST', '/api/v1/team-goals', ['name' => 'Launch', 'description' => '', 'due_date' => null, 'members' => []], $lead))['id'];
        $leadId = (string) $this->pdo->query("SELECT id FROM users WHERE email = 'planner-lead@example.test'")->fetchColumn();
        $reminder = $this->runtime['clock']->now()->modify('-1 hour')->format(DATE_ATOM);

        self::assertSame(422, $this->api('POST', "/api/v1/team-goals/$goalId/tasks", ['name' => 'Bad', 'importance' => 9], $lead)->status);
        self::assertSame(422, $this->api('POST', "/api/v1/team-goals/$goalId/tasks", ['name' => 'Bad', 'repeat' => ['frequency' => 'hourly']], $lead)->status);
        $detail = $this->data($this->api('POST', "/api/v1/team-goals/$goalId/tasks", [
            'name' => 'Weekly sync', 'description' => 'Agenda', 'assignee_id' => $leadId, 'importance' => 5,
            'start_date' => '2026-11-02', 'due_date' => '2026-11-02', 'estimated_minutes' => 30, 'reminder_at' => $reminder,
            'repeat' => ['frequency' => 'weekly', 'interval_count' => 1, 'weekdays' => [1], 'end_date' => '2026-11-10'],
        ], $lead));
        $task = $detail['tasks'][0];
        self::assertSame([5, '2026-11-02', 30, 'weekly'], [$task['importance'], $task['due_date'], $task['estimated_minutes'], $task['repeat']['frequency']]);
        $bell = $this->data($this->api('GET', '/api/v1/notifications', [], $lead))['reminders'];
        self::assertSame("/teamwork?goal=$goalId", $bell[0]['url']);

        $next = $this->data($this->api('PATCH', "/api/v1/team-goals/$goalId/tasks/{$task['id']}", ['base_version' => 1, 'status' => 'done'], $lead));
        $open = array_values(array_filter($next['tasks'], static fn (array $row): bool => $row['status'] === 'todo'));
        self::assertCount(1, $open);
        self::assertSame(['Weekly sync', '2026-11-09', 5], [$open[0]['name'], $open[0]['due_date'], $open[0]['importance']]);
        $after = $this->data($this->api('PATCH', "/api/v1/team-goals/$goalId/tasks/{$open[0]['id']}", ['base_version' => 1, 'status' => 'done'], $lead));
        // The following Monday is after end_date, so the series stops.
        self::assertCount(0, array_filter($after['tasks'], static fn (array $row): bool => $row['status'] === 'todo'));
    }

    public function test_changed_pages_render_their_new_controls(): void
    {
        $user = $this->registerAccount('pages@example.test', 'Pages');
        $expectations = [
            '/tasks' => ['data-schedule-open="repeat"', 'data-task-view="repeating"', 'data-task-completed'],
            '/' => ['data-view-toggle', 'data-note-sort', 'data-filter-shared', 'data-editor-save', 'data-color-custom'],
            '/habits' => ['habit-description'],
            '/dashboard' => ['data-activity-years'],
            '/teamwork' => ['data-teamwork-page', 'team-goal-dialog', 'data-team-search', 'data-team-page="1"', 'team-task-dialog', 'data-schedule-open="repeat"', 'team-invite-dialog'],
            '/settings/history' => ['data-history-rules'],
            '/settings/password' => ['data-two-factor-settings'],
            '/settings/preferences' => ['personal-background-dialog'],
        ];
        foreach ($expectations as $path => $needles) {
            $page = $this->request('GET', $path, cookie: $user[0]);
            self::assertSame(200, $page->status, $path);
            self::assertStringContainsString('data-notifications-toggle', $page->body, $path);
            self::assertStringContainsString('data-assistant-open', $page->body, $path);
            self::assertStringNotContainsString('href="/ai" data-leave-guard>'."\n".'                        <svg', $page->body, $path);
            foreach ($needles as $needle) {
                self::assertStringContainsString($needle, $page->body, "$path lacks $needle");
            }
        }
        self::assertStringNotContainsString('Recurring tasks', $this->request('GET', '/habits', cookie: $user[0])->body);
        self::assertSame(404, $this->request('GET', '/admin', cookie: $user[0])->status);
        $this->pdo->exec("UPDATE users SET role = 'admin' WHERE email = 'pages@example.test'");
        $admin = $this->request('GET', '/admin', cookie: $user[0]);
        self::assertSame(200, $admin->status);
        self::assertStringContainsString('data-admin-page', $admin->body);
    }

    /** @return array{0:string,1:string} cookie and CSRF token */
    private function registerAccount(string $email, string $name): array
    {
        $page = $this->request('GET', '/register');
        preg_match('/name="_token" value="([a-f0-9]{64})"/', $page->body, $match);
        $this->request('POST', '/register', [
            '_token' => $match[1],
            'display_name' => $name,
            'email' => $email,
            'password' => 'correct horse battery staple',
            'password_confirmation' => 'correct horse battery staple',
        ], $this->session->id());
        $cookie = $this->session->id();
        $csrf = $this->data($this->request('GET', '/api/v1/session', cookie: $cookie))['csrf_token'];

        return [$cookie, $csrf];
    }

    private function login(string $email): Response
    {
        $page = $this->request('GET', '/login');
        preg_match('/name="_token" value="([a-f0-9]{64})"/', $page->body, $match);

        return $this->request('POST', '/login', ['_token' => $match[1], 'email' => $email, 'password' => 'correct horse battery staple'], $this->session->id());
    }

    /** @param array<string, mixed> $input @param array{0:string,1:string} $auth */
    private function api(string $method, string $path, array $input, array $auth): Response
    {
        return $this->request($method, $path, $input, $auth[0], $method === 'GET' ? null : $auth[1], $method !== 'GET');
    }

    private function data(Response $response): mixed
    {
        return json_decode($response->body, true, flags: JSON_THROW_ON_ERROR)['data'];
    }

    /** @param array<string, mixed> $input */
    private function request(string $method, string $path, array $input = [], ?string $cookie = null, ?string $csrf = null, bool $json = false): Response
    {
        [$path, $queryString] = array_pad(explode('?', $path, 2), 2, '');
        parse_str($queryString, $query);
        $headers = ['accept' => str_starts_with($path, '/api/') ? 'application/json' : 'text/html'];
        $form = $input;
        $body = '';
        if ($json) {
            $headers['content-type'] = 'application/json';
            $body = json_encode((object) $input, JSON_THROW_ON_ERROR);
            $form = [];
        }
        if ($csrf !== null) {
            $headers['x-csrf-token'] = $csrf;
        }

        return $this->application->handle(new Request(
            $method,
            $path,
            query: $query,
            headers: $headers,
            cookies: $cookie === null ? [] : ['planner_session' => $cookie],
            form: $form,
            server: ['REMOTE_ADDR' => '198.51.100.20'],
            rawBody: $body,
        ));
    }

    private function wipeTargetDatabase(): void
    {
        $tables = $this->pdo->query("SELECT table_name FROM information_schema.tables WHERE table_schema = 'goals_test' AND table_type = 'BASE TABLE'")->fetchAll(PDO::FETCH_COLUMN);
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
