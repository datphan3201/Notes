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

/** System administration: registration control, report actions, locking and the activity log. */
final class SystemAdminHttpTest extends TestCase
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

    public function test_registration_mode_and_invitations_decide_who_can_create_an_account(): void
    {
        $admin = $this->admin('root@example.test', 'Root');
        $member = $this->registerAccount('member@example.test', 'Member');
        self::assertSame(404, $this->api('GET', '/api/v1/admin/registration-invites', [], $member)->status);
        self::assertSame(404, $this->api('PATCH', '/api/v1/admin/settings', ['registration_mode' => 'closed'], $member)->status);
        self::assertSame(422, $this->api('PATCH', '/api/v1/admin/settings', ['registration_mode' => 'members-only'], $admin)->status);

        $settings = $this->data($this->api('PATCH', '/api/v1/admin/settings', ['registration_mode' => 'invite'], $admin));
        self::assertSame('invite', $settings['registration_mode']);
        self::assertStringContainsString('Registration is by invitation', $this->request('GET', '/register')->body);
        self::assertSame('/register', $this->attemptRegistration('stranger@example.test')->headers['Location']);
        self::assertFalse($this->userExists('stranger@example.test'));

        self::assertSame(422, $this->api('POST', '/api/v1/admin/registration-invites', ['email' => 'member@example.test'], $admin)->status);
        self::assertSame(422, $this->api('POST', '/api/v1/admin/registration-invites', ['email' => 'not an email'], $admin)->status);
        $invites = $this->data($this->api('POST', '/api/v1/admin/registration-invites', ['email' => ' Friend@Example.test '], $admin));
        self::assertSame(['friend@example.test', false], [$invites[0]['email'], $invites[0]['used']]);
        self::assertSame('/dashboard', $this->attemptRegistration('friend@example.test', 'Friend')->headers['Location']);
        $used = $this->data($this->api('GET', '/api/v1/admin/registration-invites', [], $admin))[0];
        self::assertSame([true, 'Friend'], [$used['used'], $used['used_by']]);

        $this->api('POST', '/api/v1/admin/registration-invites', ['email' => 'late@example.test'], $admin);
        $this->api('PATCH', '/api/v1/admin/settings', ['registration_mode' => 'closed'], $admin);
        $page = $this->request('GET', '/register')->body;
        self::assertStringContainsString('data-registration-closed', $page);
        self::assertStringNotContainsString('action="/register"', $page);
        self::assertStringNotContainsString('href="/register"', $this->request('GET', '/login')->body);
        self::assertSame('/register', $this->attemptRegistration('late@example.test')->headers['Location']);
        self::assertFalse($this->userExists('late@example.test'));
        self::assertSame([], array_column(array_filter(
            $this->data($this->api('DELETE', '/api/v1/admin/registration-invites', ['email' => 'late@example.test'], $admin)),
            static fn (array $invite): bool => $invite['email'] === 'late@example.test',
        ), 'email'));

        $log = $this->data($this->api('GET', '/api/v1/admin/actions', [], $admin));
        self::assertSame(
            ['registration.uninvite', 'settings.registration_mode', 'registration.invite', 'registration.invite', 'settings.registration_mode'],
            array_column($log, 'action'),
        );
        self::assertSame('Root', $log[0]['actor']['display_name']);
        self::assertSame('invite → closed', $log[1]['summary']);
    }

    public function test_resolving_a_note_report_takes_the_chosen_action_and_tells_the_reporter(): void
    {
        $admin = $this->admin('moderator@example.test', 'Moderator');
        $owner = $this->registerAccount('owner@example.test', 'Owner');
        $reader = $this->registerAccount('reader@example.test', 'Reader');
        $pending = $this->registerAccount('pending@example.test', 'Pending');
        $noteId = $this->sharedNote($owner, 'Abusive', ['reader@example.test' => $reader]);
        $this->api('POST', "/api/v1/notes/$noteId/shares", ['email' => 'pending@example.test'], $owner);
        $this->api('POST', "/api/v1/shared-notes/$noteId/report", ['reason' => 'Harassment in a shared note'], $reader);
        $report = $this->data($this->api('GET', '/api/v1/admin/reports', [], $admin))[0];
        $path = '/api/v1/admin/reports/'.$report['id'].'/resolve';

        // Resolving means acting; dismissing means not acting.
        self::assertSame(422, $this->api('POST', $path, ['status' => 'resolved'], $admin)->status);
        self::assertSame(422, $this->api('POST', $path, ['status' => 'dismissed', 'actions' => ['revoke_shares']], $admin)->status);
        self::assertSame(422, $this->api('POST', $path, ['status' => 'resolved', 'actions' => ['delete_everything']], $admin)->status);
        self::assertSame(200, $this->api('POST', $path, ['status' => 'resolved', 'actions' => ['revoke_shares', 'warn_owner'], 'response' => 'Removed.'], $admin)->status);

        self::assertSame(404, $this->api('GET', "/api/v1/shared-notes/$noteId", [], $reader)->status);
        self::assertSame(0, (int) $this->pdo->query("SELECT COUNT(*) FROM note_shares WHERE note_id = '$noteId'")->fetchColumn());
        self::assertSame([], $this->data($this->api('GET', '/api/v1/shared-notes', [], $pending))['invitations']);
        $readerInbox = $this->data($this->api('GET', '/api/v1/notifications', [], $reader))['items'];
        self::assertSame(['report_resolved', 'Your report was reviewed and action was taken'], [$readerInbox[0]['type'], $readerInbox[0]['payload']['title']]);
        $ownerInbox = $this->data($this->api('GET', '/api/v1/notifications', [], $owner))['items'];
        self::assertSame('admin_warning', $ownerInbox[0]['type']);
        self::assertStringNotContainsString('Reader', $ownerInbox[0]['payload']['title'].$ownerInbox[0]['payload']['body']);
        $handled = $this->data($this->api('GET', '/api/v1/admin/reports?status=resolved', [], $admin))[0];
        self::assertSame(['revoke_shares', 'warn_owner'], $handled['actions']);
        self::assertSame(422, $this->api('POST', $path, ['status' => 'dismissed'], $admin)->status);

        // A dismissal tells the reporter that nothing was needed, and changes nothing.
        $second = $this->sharedNote($owner, 'Harmless', ['reader@example.test' => $reader]);
        $this->api('POST', "/api/v1/shared-notes/$second/report", ['reason' => 'I do not like this note'], $reader);
        $open = $this->data($this->api('GET', '/api/v1/admin/reports', [], $admin))[0];
        self::assertSame(200, $this->api('POST', '/api/v1/admin/reports/'.$open['id'].'/resolve', ['status' => 'dismissed'], $admin)->status);
        self::assertSame(200, $this->api('GET', "/api/v1/shared-notes/$second", [], $reader)->status);
        self::assertSame('Your report was reviewed. No action was needed', $this->data($this->api('GET', '/api/v1/notifications', [], $reader))['items'][0]['payload']['title']);

        self::assertSame(
            ['report.dismissed', 'report.resolved', 'account.warn', 'note.revoke_shares'],
            array_column($this->data($this->api('GET', '/api/v1/admin/actions', [], $admin)), 'action'),
        );
    }

    public function test_locking_hides_shared_notes_records_the_admin_and_spares_administrators(): void
    {
        $admin = $this->admin('lead@example.test', 'Lead');
        $deputy = $this->admin('deputy@example.test', 'Deputy');
        $owner = $this->registerAccount('writer@example.test', 'Writer');
        $reader = $this->registerAccount('follower@example.test', 'Follower');
        $noteId = $this->sharedNote($owner, 'Shared plan', ['follower@example.test' => $reader]);
        $ownerId = $this->userId('writer@example.test');

        self::assertSame(422, $this->api('POST', '/api/v1/admin/users/'.$this->userId('deputy@example.test').'/lock', ['reason' => 'Coup'], $admin)->status);
        self::assertSame(422, $this->api('POST', '/api/v1/admin/users/'.$this->userId('lead@example.test').'/lock', [], $admin)->status);
        self::assertSame(200, $this->api('POST', "/api/v1/admin/users/$ownerId/lock", ['reason' => 'Spam'], $admin)->status);

        self::assertSame(404, $this->api('GET', "/api/v1/shared-notes/$noteId", [], $reader)->status);
        self::assertSame([], $this->data($this->api('GET', '/api/v1/shared-notes', [], $reader))['notes']);
        $listed = array_values(array_filter(
            $this->data($this->api('GET', '/api/v1/admin/users?q=writer', [], $deputy)),
            static fn (array $user): bool => $user['email'] === 'writer@example.test',
        ))[0];
        self::assertSame([true, 'Lead', 'Spam'], [$listed['locked'], $listed['locked_by'], $listed['locked_reason']]);

        self::assertSame(200, $this->api('POST', "/api/v1/admin/users/$ownerId/unlock", [], $deputy)->status);
        self::assertSame(200, $this->api('GET', "/api/v1/shared-notes/$noteId", [], $reader)->status);
        $log = $this->data($this->api('GET', '/api/v1/admin/actions', [], $admin));
        self::assertSame(['account.unlock', 'account.lock'], array_column($log, 'action'));
        self::assertSame(['Deputy', 'Lead'], array_map(static fn (array $entry): string => $entry['actor']['display_name'], $log));
    }

    public function test_user_reports_can_lock_the_reported_account(): void
    {
        $admin = $this->admin('safety@example.test', 'Safety');
        $this->registerAccount('reporter@example.test', 'Reporter');
        $reported = $this->registerAccount('reported@example.test', 'Reported');
        $reportedId = $this->userId('reported@example.test');
        $this->pdo->prepare("INSERT INTO user_reports (id, reporter_id, target_email, target_user_id, reason, status, created_at) VALUES ('7f9c4b5e-2f3a-4c1d-9e8f-1a2b3c4d5e6f', :reporter, 'reported@example.test', :target, 'Abusive shared content', 'open', NOW(6))")
            ->execute(['reporter' => $this->userId('reporter@example.test'), 'target' => $reportedId]);
        $path = '/api/v1/admin/user-reports/7f9c4b5e-2f3a-4c1d-9e8f-1a2b3c4d5e6f/resolve';
        self::assertSame(422, $this->api('POST', $path, ['status' => 'resolved', 'actions' => ['revoke_shares']], $admin)->status);
        self::assertSame(200, $this->api('POST', $path, ['status' => 'resolved', 'actions' => ['lock_account']], $admin)->status);
        self::assertSame(401, $this->api('GET', '/api/v1/session', [], $reported)->status);
        self::assertSame(['lock_account'], $this->data($this->api('GET', '/api/v1/admin/user-reports?status=resolved', [], $admin))[0]['actions']);
    }

    public function test_console_commands_change_roles_and_registration_and_are_recorded(): void
    {
        $admin = $this->admin('console-admin@example.test', 'Console admin');
        $this->registerAccount('promoted@example.test', 'Promoted');
        self::assertSame(0, $this->console('users:role', 'promoted@example.test', 'admin'));
        self::assertSame('admin', $this->pdo->query("SELECT role FROM users WHERE email = 'promoted@example.test'")->fetchColumn());
        self::assertSame(0, $this->console('registration:mode', 'invite'));
        self::assertSame(2, $this->console('registration:mode', 'sometimes'));
        self::assertSame('invite', $this->data($this->api('GET', '/api/v1/admin/settings', [], $admin))['registration_mode']);

        $log = $this->data($this->api('GET', '/api/v1/admin/actions', [], $admin));
        self::assertSame(['settings.registration_mode', 'account.role'], array_column($log, 'action'));
        self::assertSame([null, null], array_column($log, 'actor'));
        self::assertSame('promoted@example.test → admin', $log[1]['summary']);
    }

    /** Runs bin/console against the test database; returns the exit status. */
    private function console(string ...$arguments): int
    {
        $command = array_merge([PHP_BINARY, dirname(__DIR__, 3).'/bin/console'], $arguments);
        $environment = array_merge(getenv(), ['APP_ENV' => 'testing', 'PLANNER_DB_DATABASE' => 'goals_test', 'PLANNER_DB_ALLOWED' => 'goals_test']);
        $process = proc_open($command, [1 => ['pipe', 'w'], 2 => ['pipe', 'w']], $pipes, null, $environment);
        self::assertIsResource($process);
        stream_get_contents($pipes[1]);
        stream_get_contents($pipes[2]);

        return proc_close($process);
    }

    /** @return array{0:string,1:string} */
    private function admin(string $email, string $name): array
    {
        $auth = $this->registerAccount($email, $name);
        $this->pdo->prepare("UPDATE users SET role = 'admin' WHERE email = :email")->execute(['email' => $email]);

        return $auth;
    }

    /**
     * @param array{0:string,1:string} $owner
     * @param array<string, array{0:string,1:string}> $recipients email => auth, all accepting
     */
    private function sharedNote(array $owner, string $title, array $recipients): string
    {
        $noteId = sprintf('%08x-2f3a-4c1d-9e8f-1a2b3c4d5e6f', random_int(0, 0xffffffff));
        $this->api('POST', '/api/v1/notes', ['id' => $noteId, 'title' => $title, 'content' => "$title content"], $owner);
        foreach ($recipients as $email => $auth) {
            $shareId = $this->data($this->api('POST', "/api/v1/notes/$noteId/shares", ['email' => $email], $owner))[0]['id'];
            $this->api('POST', "/api/v1/shared-notes/invitations/$shareId/accept", [], $auth);
        }

        return $noteId;
    }

    private function attemptRegistration(string $email, string $name = 'Someone'): Response
    {
        // A closed registration page has no form, so the token comes from the login page.
        $page = $this->request('GET', '/login');
        preg_match('/name="_token" value="([a-f0-9]{64})"/', $page->body, $match);

        return $this->request('POST', '/register', [
            '_token' => $match[1],
            'display_name' => $name,
            'email' => $email,
            'password' => 'correct horse battery staple',
            'password_confirmation' => 'correct horse battery staple',
        ], $this->session->id());
    }

    private function userExists(string $email): bool
    {
        $statement = $this->pdo->prepare('SELECT COUNT(*) FROM users WHERE email = :email');
        $statement->execute(['email' => $email]);

        return (int) $statement->fetchColumn() === 1;
    }

    private function userId(string $email): int
    {
        $statement = $this->pdo->prepare('SELECT id FROM users WHERE email = :email');
        $statement->execute(['email' => $email]);

        return (int) $statement->fetchColumn();
    }

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
