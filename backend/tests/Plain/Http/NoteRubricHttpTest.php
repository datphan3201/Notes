<?php

declare(strict_types=1);

namespace Tests\Plain\Http;

use PDO;
use PHPUnit\Framework\TestCase;
use Planner\Http\Application;
use Planner\Http\Request;
use Planner\Http\Response;
use Planner\Infrastructure\Database\MigrationRunner;
use Planner\Infrastructure\Realtime\RealtimeTicket;
use Planner\Infrastructure\Session\SessionManager;
use RuntimeException;

/**
 * Rubric features on Notes: per-Note passwords, sharing with several validated
 * recipients, attribute-only changes, offline delta sync, realtime admission
 * tickets and the AI endpoints' disabled/authorization boundaries.
 */
final class NoteRubricHttpTest extends TestCase
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

    public function test_note_password_enable_unlock_change_and_disable_protect_every_action(): void
    {
        $owner = $this->registerAccount('owner@example.test', 'Owner');
        $id = $this->createNote($owner, 'Bank codes', 'The vault code is 4321');

        $mismatch = $this->api('PUT', "/api/v1/notes/$id/lock", ['password' => 'secret1', 'password_confirmation' => 'secret2'], $owner);
        self::assertSame(422, $mismatch->status);
        self::assertArrayHasKey('password_confirmation', $this->errors($mismatch));
        self::assertSame(422, $this->api('PUT', "/api/v1/notes/$id/lock", ['password' => 'abc', 'password_confirmation' => 'abc'], $owner)->status);
        $locked = $this->api('PUT', "/api/v1/notes/$id/lock", ['password' => 'secret1', 'password_confirmation' => 'secret1'], $owner);
        self::assertSame(200, $locked->status);
        self::assertTrue($this->data($locked)['is_locked']);
        self::assertSame(2, $this->data($locked)['version']);
        self::assertStringNotContainsString('$2y$', $locked->body);
        self::assertSame(409, $this->api('PUT', "/api/v1/notes/$id/lock", ['password' => 'secret9', 'password_confirmation' => 'secret9'], $owner)->status);

        // Enabling keeps the owner's open note usable; forgetting the unlock locks every action.
        self::assertSame(200, $this->api('GET', "/api/v1/notes/$id", [], $owner)->status);
        self::assertSame(204, $this->api('POST', "/api/v1/notes/$id/relock", [], $owner)->status);
        $card = $this->data($this->api('GET', '/api/v1/notes', [], $owner))[0];
        self::assertTrue($card['is_locked']);
        self::assertSame('', $card['content_preview']);
        $show = $this->api('GET', "/api/v1/notes/$id", [], $owner);
        self::assertSame(423, $show->status);
        self::assertSame('NOTE_LOCKED', json_decode($show->body, true)['code']);
        self::assertStringNotContainsString('4321', $show->body);
        $update = ['base_version' => 2, 'title' => 'Bank codes', 'content' => 'Changed', 'color' => 'neutral', 'is_pinned' => false, 'label_ids' => []];
        self::assertSame(423, $this->api('PATCH', "/api/v1/notes/$id", $update, $owner)->status);
        self::assertSame(423, $this->api('PATCH', "/api/v1/notes/$id/attributes", ['is_pinned' => true], $owner)->status);
        self::assertSame(423, $this->api('DELETE', "/api/v1/notes/$id", ['base_version' => 2], $owner)->status);
        self::assertSame(423, $this->api('GET', "/api/v1/notes/$id/attachments", [], $owner)->status);
        self::assertSame(423, $this->api('GET', "/api/v1/notes/$id/summary", [], $owner)->status);
        // Search matches a locked note's title but never its protected content.
        self::assertSame([], $this->data($this->api('GET', '/api/v1/notes?q=4321', [], $owner)));
        self::assertCount(1, $this->data($this->api('GET', '/api/v1/notes?q=Bank', [], $owner)));

        $wrong = $this->api('POST', "/api/v1/notes/$id/unlock", ['password' => 'nope'], $owner);
        self::assertSame(422, $wrong->status);
        self::assertSame(200, $this->api('POST', "/api/v1/notes/$id/unlock", ['password' => 'secret1'], $owner)->status);
        self::assertSame('The vault code is 4321', $this->data($this->api('GET', "/api/v1/notes/$id", [], $owner))['content']);

        // Changing needs the current password and the new one twice; old unlocks stop working.
        self::assertSame(422, $this->api('PATCH', "/api/v1/notes/$id/lock", ['current_password' => 'nope', 'password' => 'secret2', 'password_confirmation' => 'secret2'], $owner)->status);
        self::assertSame(422, $this->api('PATCH', "/api/v1/notes/$id/lock", ['current_password' => 'secret1', 'password' => 'secret2', 'password_confirmation' => 'secret3'], $owner)->status);
        $other = $this->loginAgain('owner@example.test');
        self::assertSame(200, $this->api('POST', "/api/v1/notes/$id/unlock", ['password' => 'secret1'], $other)->status);
        self::assertSame(200, $this->api('PATCH', "/api/v1/notes/$id/lock", ['current_password' => 'secret1', 'password' => 'secret2', 'password_confirmation' => 'secret2'], $owner)->status);
        self::assertSame(423, $this->api('GET', "/api/v1/notes/$id", [], $other)->status);
        self::assertSame(422, $this->api('POST', "/api/v1/notes/$id/unlock", ['password' => 'secret1'], $other)->status);
        self::assertSame(200, $this->api('GET', "/api/v1/notes/$id", [], $owner)->status);

        // Disabling requires the current password as a final confirmation.
        self::assertSame(422, $this->api('DELETE', "/api/v1/notes/$id/lock", [], $owner)->status);
        self::assertSame(422, $this->api('DELETE', "/api/v1/notes/$id/lock", ['current_password' => 'secret1'], $owner)->status);
        $disabled = $this->api('DELETE', "/api/v1/notes/$id/lock", ['current_password' => 'secret2'], $owner);
        self::assertSame(200, $disabled->status);
        self::assertFalse($this->data($disabled)['is_locked']);
        self::assertSame(200, $this->api('GET', "/api/v1/notes/$id", [], $other)->status);
        self::assertSame(409, $this->api('DELETE', "/api/v1/notes/$id/lock", ['current_password' => 'secret2'], $owner)->status);
    }

    public function test_note_password_guesses_are_throttled_and_strangers_see_nothing(): void
    {
        $owner = $this->registerAccount('owner@example.test', 'Owner');
        $stranger = $this->registerAccount('stranger@example.test', 'Stranger');
        $id = $this->createNote($owner, 'Diary', 'Private');
        $this->api('PUT', "/api/v1/notes/$id/lock", ['password' => 'right-one', 'password_confirmation' => 'right-one'], $owner);
        $this->api('POST', "/api/v1/notes/$id/relock", [], $owner);

        self::assertSame(404, $this->api('POST', "/api/v1/notes/$id/unlock", ['password' => 'right-one'], $stranger)->status);
        self::assertSame(404, $this->api('PUT', "/api/v1/notes/$id/lock", ['password' => 'mine1', 'password_confirmation' => 'mine1'], $stranger)->status);
        for ($attempt = 0; $attempt < 8; $attempt++) {
            self::assertSame(422, $this->api('POST', "/api/v1/notes/$id/unlock", ['password' => 'guess'.$attempt], $owner)->status);
        }
        self::assertSame(429, $this->api('POST', "/api/v1/notes/$id/unlock", ['password' => 'right-one'], $owner)->status);
        self::assertSame(423, $this->api('GET', "/api/v1/notes/$id", [], $owner)->status);
    }

    public function test_sharing_validates_registered_recipients_and_locked_notes_need_the_password(): void
    {
        $owner = $this->registerAccount('owner@example.test', 'Owner');
        $friend = $this->registerAccount('friend@example.test', 'Friend');
        $colleague = $this->registerAccount('colleague@example.test', 'Colleague');
        $id = $this->createNote($owner, 'Trip', 'Book the train');

        $partial = $this->api('POST', "/api/v1/notes/$id/shares", ['emails' => ['friend@example.test', 'ghost@example.test'], 'permission' => 'view'], $owner);
        self::assertSame(422, $partial->status);
        self::assertStringContainsString('ghost@example.test', $this->errors($partial)['emails'][0]);
        self::assertSame([], $this->data($this->api('GET', "/api/v1/notes/$id/shares", [], $owner)));
        self::assertSame(422, $this->api('POST', "/api/v1/notes/$id/shares", ['emails' => 'owner@example.test', 'permission' => 'view'], $owner)->status);
        self::assertSame(422, $this->api('POST', "/api/v1/notes/$id/shares", ['emails' => 'not-an-email', 'permission' => 'view'], $owner)->status);

        $shares = $this->data($this->api('POST', "/api/v1/notes/$id/shares", ['emails' => 'Friend@example.test, colleague@example.test', 'permission' => 'edit'], $owner));
        self::assertEqualsCanonicalizing(['colleague@example.test', 'friend@example.test'], array_map(static fn (array $share): string => $share['recipient']['email'], $shares));
        self::assertCount(2, $shares);
        self::assertSame(['edit', 'edit'], array_column($shares, 'permission'));
        self::assertTrue($this->data($this->api('GET', '/api/v1/notes', [], $owner))[0]['is_shared']);
        self::assertTrue($this->data($this->api('GET', "/api/v1/notes/$id", [], $owner))['is_shared']);

        $received = $this->data($this->api('GET', '/api/v1/shared-notes', [], $friend));
        $shareId = $received['invitations'][0]['share_id'];
        self::assertMatchesRegularExpression('/Z$/', $received['invitations'][0]['shared_at']);
        $this->api('POST', "/api/v1/shared-notes/invitations/$shareId/accept", [], $friend);
        $note = $this->data($this->api('GET', '/api/v1/shared-notes', [], $friend))['notes'][0];
        self::assertSame('Owner', $note['owner']['display_name']);
        self::assertSame('edit', $note['permission']);
        self::assertSame('Book the train', $note['excerpt']);

        $this->api('PUT', "/api/v1/notes/$id/lock", ['password' => 'shared-secret', 'password_confirmation' => 'shared-secret'], $owner);
        $lockedCard = $this->data($this->api('GET', '/api/v1/shared-notes', [], $friend))['notes'][0];
        self::assertTrue($lockedCard['is_locked']);
        self::assertSame('', $lockedCard['excerpt']);
        self::assertSame(423, $this->api('GET', "/api/v1/shared-notes/$id", [], $friend)->status);
        self::assertSame(423, $this->api('PATCH', "/api/v1/shared-notes/$id", ['base_version' => 3, 'title' => 'Trip', 'content' => 'x'], $friend)->status);
        // Recipients may unlock with the note's password but never manage it.
        self::assertSame(200, $this->api('POST', "/api/v1/notes/$id/unlock", ['password' => 'shared-secret'], $friend)->status);
        self::assertSame('Book the train', $this->data($this->api('GET', "/api/v1/shared-notes/$id", [], $friend))['content']);
        self::assertSame(404, $this->api('DELETE', "/api/v1/notes/$id/lock", ['current_password' => 'shared-secret'], $friend)->status);
        self::assertSame(404, $this->api('PATCH', "/api/v1/notes/$id/attributes", ['is_pinned' => true], $friend)->status);
    }

    public function test_attribute_changes_keep_text_and_do_not_need_a_base_version(): void
    {
        $owner = $this->registerAccount('owner@example.test', 'Owner');
        $id = $this->createNote($owner, 'Groceries', 'Milk');
        $label = $this->data($this->api('POST', '/api/v1/labels', ['name' => 'Home'], $owner))['id'];

        $pinned = $this->data($this->api('PATCH', "/api/v1/notes/$id/attributes", ['is_pinned' => true, 'color' => '#AABBCC', 'label_ids' => [$label]], $owner));
        self::assertTrue($pinned['is_pinned']);
        self::assertSame('#aabbcc', $pinned['color']);
        self::assertSame('Milk', $pinned['content']);
        self::assertSame(2, $pinned['version']);
        self::assertSame([$label], array_column($pinned['labels'], 'id'));
        $same = $this->data($this->api('PATCH', "/api/v1/notes/$id/attributes", ['is_pinned' => true], $owner));
        self::assertSame(2, $same['version']);
        self::assertSame($pinned['pinned_at'], $same['pinned_at']);
        self::assertSame(422, $this->api('PATCH', "/api/v1/notes/$id/attributes", ['title' => 'x'], $owner)->status);
        self::assertSame(422, $this->api('PATCH', "/api/v1/notes/$id/attributes", [], $owner)->status);
        self::assertSame(422, $this->api('PATCH', "/api/v1/notes/$id/attributes", ['label_ids' => [999999]], $owner)->status);
    }

    public function test_offline_sync_feed_pages_changes_and_reports_deletions(): void
    {
        $owner = $this->registerAccount('owner@example.test', 'Owner');
        $other = $this->registerAccount('other@example.test', 'Other');
        $first = $this->createNote($owner, 'First', 'One');
        $second = $this->createNote($owner, 'Second', 'Two');
        $this->createNote($other, 'Not mine', 'Hidden');

        $full = $this->data($this->api('GET', '/api/v1/notes/sync', [], $owner));
        self::assertEqualsCanonicalizing([$first, $second], array_column($full['notes'], 'id'));
        self::assertSame([], $full['deleted']);
        self::assertFalse($full['has_more']);
        self::assertNotNull($full['cursor']);
        self::assertSame('One', array_column($full['notes'], 'content', 'id')[$first]);

        $empty = $this->data($this->api('GET', '/api/v1/notes/sync?cursor='.$full['cursor'], [], $owner));
        self::assertSame([], $empty['notes']);
        self::assertSame($full['cursor'], $empty['cursor']);

        $version = $this->data($this->api('GET', "/api/v1/notes/$first", [], $owner))['version'];
        $this->api('DELETE', "/api/v1/notes/$first", ['base_version' => $version], $owner);
        $this->api('PUT', "/api/v1/notes/$second/lock", ['password' => 'lock-it', 'password_confirmation' => 'lock-it'], $owner);
        $delta = $this->data($this->api('GET', '/api/v1/notes/sync?cursor='.$full['cursor'], [], $owner));
        self::assertSame([$first], $delta['deleted']);
        self::assertSame([$second], array_column($delta['notes'], 'id'));
        self::assertTrue($delta['notes'][0]['is_locked']);
        self::assertSame('', $delta['notes'][0]['content']);
        self::assertSame(422, $this->api('GET', '/api/v1/notes/sync?cursor=garbage', [], $owner)->status);
    }

    public function test_realtime_tickets_are_issued_only_for_accessible_unlocked_notes(): void
    {
        $owner = $this->registerAccount('owner@example.test', 'Owner');
        $friend = $this->registerAccount('friend@example.test', 'Friend');
        $stranger = $this->registerAccount('stranger@example.test', 'Stranger');
        $id = $this->createNote($owner, 'Plan', 'Draft');
        /** @var RealtimeTicket $tickets */
        $tickets = $this->runtime['realtime_tickets'];

        $ownerTicket = $this->data($this->api('POST', "/api/v1/notes/$id/realtime", [], $owner));
        $claims = $tickets->verify($ownerTicket['ticket'], time());
        self::assertSame('owner', $claims['permission']);
        self::assertSame($id, $claims['note_id']);
        self::assertNull($tickets->verify($ownerTicket['ticket'].'x', time()));
        self::assertNull($tickets->verify($ownerTicket['ticket'], time() + RealtimeTicket::TTL_SECONDS + 1));
        self::assertSame(404, $this->api('POST', "/api/v1/notes/$id/realtime", [], $stranger)->status);

        $share = $this->data($this->api('POST', "/api/v1/notes/$id/shares", ['email' => 'friend@example.test', 'permission' => 'view'], $owner))[0];
        self::assertSame(404, $this->api('POST', "/api/v1/notes/$id/realtime", [], $friend)->status);
        $this->api('POST', "/api/v1/shared-notes/invitations/{$share['id']}/accept", [], $friend);
        $friendClaims = $tickets->verify($this->data($this->api('POST', "/api/v1/notes/$id/realtime", [], $friend))['ticket'], time());
        self::assertSame('view', $friendClaims['permission']);
        self::assertSame((int) $this->data($this->api('GET', '/api/v1/session', [], $owner))['user']['id'], $friendClaims['owner_id']);

        $this->api('PUT', "/api/v1/notes/$id/lock", ['password' => 'locked-1', 'password_confirmation' => 'locked-1'], $owner);
        self::assertSame(423, $this->api('POST', "/api/v1/notes/$id/realtime", [], $friend)->status);
    }

    public function test_ai_note_endpoints_respect_access_and_report_a_disabled_provider(): void
    {
        $owner = $this->registerAccount('owner@example.test', 'Owner');
        $stranger = $this->registerAccount('stranger@example.test', 'Stranger');
        $id = $this->createNote($owner, 'Meeting', 'We agreed to ship on Friday.');

        self::assertNull($this->data($this->api('GET', "/api/v1/notes/$id/summary", [], $owner))['summary']);
        self::assertSame(404, $this->api('GET', "/api/v1/notes/$id/summary", [], $stranger)->status);
        self::assertSame(404, $this->api('POST', "/api/v1/notes/$id/summary", [], $stranger)->status);
        $disabled = $this->api('POST', "/api/v1/notes/$id/summary", [], $owner);
        self::assertSame(503, $disabled->status);
        self::assertSame('AI_DISABLED', json_decode($disabled->body, true)['code']);
        self::assertSame(422, $this->api('POST', '/api/v1/notes/ask', ['question' => '?'], $owner)->status);
        self::assertSame(422, $this->api('POST', '/api/v1/notes/ask', ['question' => 'When do we ship?', 'extra' => 1], $owner)->status);
        self::assertSame(503, $this->api('POST', '/api/v1/notes/ask', ['question' => 'When do we ship?'], $owner)->status);
    }

    /** @param array{0:string,1:string} $auth */
    private function createNote(array $auth, string $title, string $content): string
    {
        $id = strtolower(\Ramsey\Uuid\Uuid::uuid4()->toString());
        $response = $this->api('POST', '/api/v1/notes', ['id' => $id, 'title' => $title, 'content' => $content], $auth);
        self::assertSame(201, $response->status, $response->body);

        return $id;
    }

    /** @return array{0:string,1:string} a second, independent session for an existing account */
    private function loginAgain(string $email): array
    {
        $this->session->close();
        session_id('');
        $_SESSION = [];
        $page = $this->request('GET', '/login');
        preg_match('/name="_token" value="([a-f0-9]{64})"/', $page->body, $match);
        $this->request('POST', '/login', ['_token' => $match[1], 'email' => $email, 'password' => 'correct horse battery staple'], $this->session->id());
        $cookie = $this->session->id();
        $csrf = $this->data($this->request('GET', '/api/v1/session', cookie: $cookie))['csrf_token'];

        return [$cookie, $csrf];
    }

    /** @return array<string, list<string>> */
    private function errors(Response $response): array
    {
        return json_decode($response->body, true, flags: JSON_THROW_ON_ERROR)['errors'] ?? [];
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
