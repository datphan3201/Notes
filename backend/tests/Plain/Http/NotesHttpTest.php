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
use Ramsey\Uuid\Uuid;
use RuntimeException;

final class NotesHttpTest extends TestCase
{
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
        $runtime = require dirname(__DIR__, 3).'/bootstrap/http.php';
        $this->application = $runtime['application'];
        $this->session = $runtime['session'];
        $this->pdo = $runtime['pdo'];
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

    public function test_create_replay_update_conflict_noop_search_and_tombstone_contract(): void
    {
        [$cookie, $csrf] = $this->registerAccount('owner@example.test');
        $id = strtolower(Uuid::uuid4()->toString());
        $create = [
            'id' => $id,
            'title' => '  Databases  ',
            'content' => "Line one\r\n  <b>%literal</b>",
            'color' => 'sky',
        ];

        $created = $this->api('POST', '/api/v1/notes', $create, $cookie, $csrf);
        self::assertSame(201, $created->status);
        $createdData = $this->json($created)['data'];
        self::assertSame($id, $createdData['id']);
        self::assertSame('Databases', $createdData['title']);
        self::assertSame("Line one\n  <b>%literal</b>", $createdData['content']);
        self::assertSame(1, $createdData['version']);
        self::assertMatchesRegularExpression('/\.\d{6}Z$/', $createdData['created_at']);

        $replay = $this->api('POST', '/api/v1/notes', $create, $cookie, $csrf);
        self::assertSame(200, $replay->status);
        self::assertTrue($this->json($replay)['meta']['replayed']);

        $label = $this->api('POST', '/api/v1/labels', ['name' => 'Work'], $cookie, $csrf);
        self::assertSame(201, $label->status);
        $labelId = $this->json($label)['data']['id'];
        $desired = [
            'base_version' => 1,
            'title' => 'Databases',
            'content' => "Line one\n  <b>%literal</b>",
            'color' => 'mint',
            'is_pinned' => true,
            'label_ids' => [$labelId],
        ];
        $updated = $this->api('PATCH', '/api/v1/notes/'.$id, $desired, $cookie, $csrf);
        self::assertSame(200, $updated->status);
        self::assertSame(2, $this->json($updated)['data']['version']);
        self::assertTrue($this->json($updated)['data']['is_pinned']);
        $updatedAt = $this->json($updated)['data']['updated_at'];

        $conflict = $this->api('PATCH', '/api/v1/notes/'.$id, [
            'base_version' => 1,
            'title' => 'Another version',
            'content' => 'Must not overwrite',
            'color' => 'rose',
            'is_pinned' => false,
            'label_ids' => [],
        ], $cookie, $csrf);
        self::assertSame(409, $conflict->status);
        self::assertSame('NOTE_CONFLICT', $this->json($conflict)['code']);
        self::assertSame(2, $this->json($conflict)['current']['version']);

        $noOp = $this->api('PATCH', '/api/v1/notes/'.$id, $desired, $cookie, $csrf);
        self::assertSame(200, $noOp->status);
        self::assertSame(2, $this->json($noOp)['data']['version']);
        self::assertSame($updatedAt, $this->json($noOp)['data']['updated_at']);

        $search = $this->api('GET', '/api/v1/notes?q='.rawurlencode('%'), cookie: $cookie);
        self::assertSame(200, $search->status);
        self::assertSame([$id], array_column($this->json($search)['data'], 'id'));

        $deleted = $this->api('DELETE', '/api/v1/notes/'.$id, ['base_version' => 2], $cookie, $csrf);
        self::assertSame(204, $deleted->status);
        self::assertSame('', $deleted->body);
        $tombstone = $this->pdo->query('SELECT * FROM notes WHERE id = '.$this->pdo->quote($id))->fetch();
        self::assertSame('', $tombstone['title']);
        self::assertSame('', $tombstone['content']);
        self::assertSame(3, (int) $tombstone['version']);
        self::assertNotNull($tombstone['deleted_at']);

        $showDeleted = $this->api('GET', '/api/v1/notes/'.$id, cookie: $cookie);
        self::assertSame(410, $showDeleted->status);
        self::assertSame('NOTE_DELETED', $this->json($showDeleted)['code']);
        self::assertSame(410, $this->api('POST', '/api/v1/notes', $create, $cookie, $csrf)->status);
        self::assertSame(204, $this->api('DELETE', '/api/v1/notes/'.$id, ['base_version' => 1], $cookie, $csrf)->status);
    }

    public function test_literal_accent_search_any_label_filter_and_owner_isolation(): void
    {
        [$cookie, $csrf, $ownerId] = $this->registerAccount('owner@example.test');
        $otherId = $this->seedAccount('other@example.test');
        $first = $this->createLabel($ownerId, 'One');
        $second = $this->createLabel($ownerId, 'Two');
        $foreign = $this->createLabel($otherId, 'Secret foreign label');
        $percent = $this->createNote($ownerId, 'Plan 100%', 'Regular content');
        $underscore = $this->createNote($ownerId, 'Name with _ underscore', 'Regular content');
        $bang = $this->createNote($ownerId, 'Name with ! bang', 'Regular content');
        $accent = $this->createNote($ownerId, 'Résumé database', str_repeat('x', 260).' end-marker');
        $otherNote = $this->createNote($otherId, '100% owner secret', 'end-marker foreign');
        $this->pdo->prepare('INSERT INTO label_note (user_id, note_id, label_id) VALUES (?, ?, ?)')
            ->execute([$ownerId, $percent, $first]);

        foreach ([
            '%' => $percent,
            '_' => $underscore,
            '!' => $bang,
            'resume database' => $accent,
            'end-marker' => $accent,
        ] as $query => $expectedId) {
            $response = $this->api('GET', '/api/v1/notes?q='.rawurlencode($query), cookie: $cookie);
            self::assertSame(200, $response->status);
            self::assertSame([$expectedId], array_column($this->json($response)['data'], 'id'));
        }

        $any = $this->api('GET', "/api/v1/notes?label_ids[]=$first&label_ids[]=$second", cookie: $cookie);
        self::assertSame([$percent], array_column($this->json($any)['data'], 'id'));
        self::assertSame(422, $this->api('GET', "/api/v1/notes?label_ids[]=$first&label_ids[]=$foreign", cookie: $cookie)->status);
        self::assertSame(404, $this->api('GET', '/api/v1/notes/'.$otherNote, cookie: $cookie)->status);

        $foreignUpdate = $this->api('PATCH', '/api/v1/notes/'.$percent, [
            'base_version' => 1,
            'title' => 'Changed',
            'content' => 'Changed body',
            'color' => 'rose',
            'is_pinned' => true,
            'label_ids' => [$first, $foreign],
        ], $cookie, $csrf);
        self::assertSame(422, $foreignUpdate->status);
        self::assertStringNotContainsString('Secret foreign label', $foreignUpdate->body);
        self::assertSame('Plan 100%', $this->pdo->query('SELECT title FROM notes WHERE id = '.$this->pdo->quote($percent))->fetchColumn());
        self::assertSame(404, $this->api('PATCH', '/api/v1/labels/'.$foreign, [
            'name' => 'Probe', 'base_version' => 1,
        ], $cookie, $csrf)->status);
    }

    public function test_label_uniqueness_conflicts_delete_versions_and_quotas(): void
    {
        [$cookie, $csrf, $userId] = $this->registerAccount('labels@example.test');
        $work = $this->api('POST', '/api/v1/labels', ['name' => 'Work'], $cookie, $csrf);
        self::assertSame(201, $work->status);
        $workId = (int) $this->json($work)['data']['id'];
        self::assertSame(422, $this->api('POST', '/api/v1/labels', ['name' => 'work'], $cookie, $csrf)->status);
        self::assertSame(201, $this->api('POST', '/api/v1/labels', ['name' => 'hoc'], $cookie, $csrf)->status);
        self::assertSame(201, $this->api('POST', '/api/v1/labels', ['name' => 'study'], $cookie, $csrf)->status);

        $first = $this->createNote($userId, 'First', 'Body');
        $second = $this->createNote($userId, 'Second', 'Body');
        $pivot = $this->pdo->prepare('INSERT INTO label_note (user_id, note_id, label_id) VALUES (?, ?, ?)');
        $pivot->execute([$userId, $first, $workId]);
        $pivot->execute([$userId, $second, $workId]);
        $renamed = $this->api('PATCH', '/api/v1/labels/'.$workId, [
            'name' => 'After', 'base_version' => 1,
        ], $cookie, $csrf);
        self::assertSame(200, $renamed->status);
        self::assertSame(2, $this->json($renamed)['data']['version']);
        $renamedAt = $this->pdo->query('SELECT updated_at FROM labels WHERE id = '.$workId)->fetchColumn();
        $renameNoOp = $this->api('PATCH', '/api/v1/labels/'.$workId, [
            'name' => 'After', 'base_version' => 1,
        ], $cookie, $csrf);
        self::assertSame(200, $renameNoOp->status);
        self::assertSame(2, $this->json($renameNoOp)['data']['version']);
        self::assertSame($renamedAt, $this->pdo->query('SELECT updated_at FROM labels WHERE id = '.$workId)->fetchColumn());
        self::assertSame(1, (int) $this->pdo->query('SELECT version FROM notes WHERE id = '.$this->pdo->quote($first))->fetchColumn());

        $stale = $this->api('DELETE', '/api/v1/labels/'.$workId, ['base_version' => 1], $cookie, $csrf);
        self::assertSame(409, $stale->status);
        self::assertSame('LABEL_CONFLICT', $this->json($stale)['code']);
        self::assertSame(204, $this->api('DELETE', '/api/v1/labels/'.$workId, ['base_version' => 2], $cookie, $csrf)->status);
        self::assertSame(2, (int) $this->pdo->query('SELECT version FROM notes WHERE id = '.$this->pdo->quote($first))->fetchColumn());
        self::assertSame(2, (int) $this->pdo->query('SELECT version FROM notes WHERE id = '.$this->pdo->quote($second))->fetchColumn());
        self::assertSame(0, (int) $this->pdo->query('SELECT COUNT(*) FROM label_note WHERE label_id = '.$workId)->fetchColumn());

        $staleAfterLabelDelete = $this->api('PATCH', '/api/v1/notes/'.$first, [
            'base_version' => 1,
            'title' => 'Stale writer',
            'content' => 'Must not restore the deleted label',
            'color' => 'neutral',
            'is_pinned' => false,
            'label_ids' => [$workId],
        ], $cookie, $csrf);
        self::assertSame(409, $staleAfterLabelDelete->status);
        self::assertSame('NOTE_CONFLICT', $this->json($staleAfterLabelDelete)['code']);
        self::assertSame(2, $this->json($staleAfterLabelDelete)['current']['version']);

        for ($index = 3; $index <= 100; $index++) {
            $this->createLabel($userId, 'Label '.$index);
        }

        self::assertSame(100, (int) $this->pdo->query('SELECT COUNT(*) FROM labels WHERE user_id = '.$userId)->fetchColumn());
        self::assertSame(422, $this->api('POST', '/api/v1/labels', ['name' => 'Label 101'], $cookie, $csrf)->status);
    }

    public function test_validation_pagination_order_and_attachment_scrubbing(): void
    {
        [$cookie, $csrf, $userId] = $this->registerAccount('validation@example.test');

        foreach ([
            ['title' => '', 'content' => 'valid body'],
            ['title' => str_repeat('t', 201), 'content' => 'valid body'],
            ['title' => 'Valid', 'content' => '   '],
            ['title' => 'Valid', 'content' => "bad\0control"],
            ['title' => 'Valid', 'content' => str_repeat('b', 50_001)],
        ] as $fields) {
            $response = $this->api('POST', '/api/v1/notes', [
                'id' => strtolower(Uuid::uuid4()->toString()),
                'color' => 'neutral',
                ...$fields,
            ], $cookie, $csrf);
            self::assertSame(422, $response->status);
            self::assertSame('VALIDATION_FAILED', $this->json($response)['code']);
        }

        $unknown = $this->api('POST', '/api/v1/notes', [
            'id' => strtolower(Uuid::uuid4()->toString()),
            'title' => 'Valid', 'content' => 'Valid', 'admin' => true,
        ], $cookie, $csrf);
        self::assertSame(422, $unknown->status);

        $start = new \DateTimeImmutable('-1 hour', new \DateTimeZone('UTC'));
        $ids = [];

        for ($index = 0; $index < 31; $index++) {
            $ids[] = $this->createNote(
                $userId,
                'Note '.$index,
                '<b>literal html '.$index.'</b>',
                $start->modify('+'.$index.' seconds')->format('Y-m-d H:i:s.u'),
            );
        }

        $earlier = $ids[4];
        $later = $ids[5];
        $statement = $this->pdo->prepare('UPDATE notes SET pinned_at = ? WHERE id = ?');
        $statement->execute([$start->modify('+2 hours')->format('Y-m-d H:i:s.u'), $earlier]);
        $statement->execute([$start->modify('+3 hours')->format('Y-m-d H:i:s.u'), $later]);
        $pageOne = $this->api('GET', '/api/v1/notes?page=1', cookie: $cookie);
        self::assertSame(30, count($this->json($pageOne)['data']));
        self::assertSame(31, $this->json($pageOne)['meta']['total']);
        self::assertSame(2, $this->json($pageOne)['meta']['last_page']);
        self::assertSame($later, $this->json($pageOne)['data'][0]['id']);
        self::assertSame($earlier, $this->json($pageOne)['data'][1]['id']);
        self::assertSame('<b>literal html 5</b>', $this->json($pageOne)['data'][0]['content_preview']);

        $lastPage = $this->api('GET', '/api/v1/notes?page=2', cookie: $cookie);
        $lastId = $this->json($lastPage)['data'][0]['id'];
        $attachmentId = strtolower(Uuid::uuid4()->toString());
        $insert = $this->pdo->prepare(<<<'SQL'
INSERT INTO attachments
(id, user_id, note_id, original_name, path, mime_type, kind, size_bytes, sha256, created_at, updated_at)
VALUES (?, ?, ?, 'kept.txt', 'attachments/kept.bin', 'text/plain', 'file', 4, ?, NOW(6), NOW(6))
SQL);
        $insert->execute([$attachmentId, $userId, $lastId, hash('sha256', 'kept')]);
        $version = (int) $this->pdo->query('SELECT version FROM notes WHERE id = '.$this->pdo->quote($lastId))->fetchColumn();
        self::assertSame(204, $this->api('DELETE', '/api/v1/notes/'.$lastId, ['base_version' => $version], $cookie, $csrf)->status);
        $attachment = $this->pdo->query('SELECT * FROM attachments WHERE id = '.$this->pdo->quote($attachmentId))->fetch();
        self::assertSame('', $attachment['original_name']);
        self::assertNull($attachment['path']);
        self::assertSame(0, (int) $attachment['size_bytes']);
        self::assertNotNull($attachment['deleted_at']);
        // M04 cleanup treats a missing private byte as already cleaned and
        // removes the transactional retry row immediately.
        self::assertSame(0, (int) $this->pdo->query("SELECT COUNT(*) FROM pending_file_deletions WHERE path = 'attachments/kept.bin'")->fetchColumn());

        $emptyLastPage = $this->api('GET', '/api/v1/notes?page=2', cookie: $cookie);
        self::assertSame([], $this->json($emptyLastPage)['data']);
        self::assertSame(30, $this->json($emptyLastPage)['meta']['total']);
        self::assertSame(1, $this->json($emptyLastPage)['meta']['last_page']);
    }

    public function test_note_list_query_count_is_bounded_by_page_size_not_note_count(): void
    {
        [$cookie, , $userId] = $this->registerAccount('queries@example.test');
        $this->createNote($userId, 'One', 'Body');
        $before = $this->sessionStatus('Com_select');
        self::assertSame(200, $this->api('GET', '/api/v1/notes', cookie: $cookie)->status);
        $oneNoteSelects = $this->sessionStatus('Com_select') - $before;

        for ($index = 2; $index <= 30; $index++) {
            $this->createNote($userId, 'Note '.$index, 'Body '.$index);
        }

        $before = $this->sessionStatus('Com_select');
        self::assertSame(200, $this->api('GET', '/api/v1/notes', cookie: $cookie)->status);
        $thirtyNoteSelects = $this->sessionStatus('Com_select') - $before;

        self::assertSame($oneNoteSelects, $thirtyNoteSelects);
        self::assertLessThanOrEqual(8, $thirtyNoteSelects);
    }

    /** @return array{string,string,int} */
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
        $session = $this->api('GET', '/api/v1/session', cookie: $cookie);
        $data = $this->json($session)['data'];

        return [$cookie, $data['csrf_token'], (int) $data['user']['id']];
    }

    private function seedAccount(string $email): int
    {
        $timestamp = gmdate('Y-m-d H:i:s').'.000000';
        $statement = $this->pdo->prepare(<<<'SQL'
INSERT INTO users (email, display_name, password, auth_version, created_at, updated_at)
VALUES (?, 'Other User', ?, 1, ?, ?)
SQL);
        $statement->execute([$email, password_hash('correct horse battery staple', PASSWORD_BCRYPT), $timestamp, $timestamp]);
        $id = (int) $this->pdo->lastInsertId();
        $this->pdo->prepare('INSERT INTO user_preferences (user_id, created_at, updated_at) VALUES (?, ?, ?)')
            ->execute([$id, $timestamp, $timestamp]);

        return $id;
    }

    private function createLabel(int $userId, string $name): int
    {
        $statement = $this->pdo->prepare(<<<'SQL'
INSERT INTO labels (user_id, name, version, created_at, updated_at)
VALUES (?, ?, 1, NOW(6), NOW(6))
SQL);
        $statement->execute([$userId, $name]);

        return (int) $this->pdo->lastInsertId();
    }

    private function createNote(int $userId, string $title, string $content, ?string $timestamp = null): string
    {
        $id = strtolower(Uuid::uuid4()->toString());
        $timestamp ??= gmdate('Y-m-d H:i:s').'.000000';
        $statement = $this->pdo->prepare(<<<'SQL'
INSERT INTO notes (id, user_id, title, content, color, version, created_at, updated_at)
VALUES (?, ?, ?, ?, 'neutral', 1, ?, ?)
SQL);
        $statement->execute([$id, $userId, $title, $content, $timestamp, $timestamp]);

        return $id;
    }

    /** @param array<string, mixed> $input */
    private function api(
        string $method,
        string $url,
        array $input = [],
        ?string $cookie = null,
        ?string $csrf = null,
    ): Response {
        return $this->request($method, $url, $input, $cookie, $csrf, true);
    }

    /** @param array<string, mixed> $input */
    private function request(
        string $method,
        string $url,
        array $input = [],
        ?string $cookie = null,
        ?string $csrf = null,
        bool $json = false,
    ): Response {
        $path = parse_url($url, PHP_URL_PATH);
        parse_str((string) parse_url($url, PHP_URL_QUERY), $query);
        $headers = ['accept' => str_starts_with((string) $path, '/api/') ? 'application/json' : 'text/html'];
        $form = $input;
        $body = '';

        if ($json && $method !== 'GET') {
            $headers['content-type'] = 'application/json';
            $body = json_encode($input, JSON_THROW_ON_ERROR);
            $form = [];
        }

        if ($csrf !== null) {
            $headers['x-csrf-token'] = $csrf;
        }

        return $this->application->handle(new Request(
            $method,
            is_string($path) ? $path : '/',
            query: $this->queryStrings($query),
            headers: $headers,
            cookies: $cookie === null ? [] : ['planner_session' => $cookie],
            form: $form,
            server: ['REMOTE_ADDR' => '198.51.100.20'],
            rawBody: $body,
        ));
    }

    /** @param array<mixed> $query @return array<string, string|list<string>> */
    private function queryStrings(array $query): array
    {
        $result = [];

        foreach ($query as $key => $value) {
            if (! is_string($key)) {
                continue;
            }

            if (is_array($value)) {
                $result[$key] = array_values(array_map('strval', $value));
            } else {
                $result[$key] = (string) $value;
            }
        }

        return $result;
    }

    /** @return array<string, mixed> */
    private function json(Response $response): array
    {
        return json_decode($response->body, true, flags: JSON_THROW_ON_ERROR);
    }

    private function sessionStatus(string $name): int
    {
        if ($name !== 'Com_select') {
            throw new RuntimeException('Unexpected status variable.');
        }

        $row = $this->pdo->query("SHOW SESSION STATUS LIKE 'Com_select'")->fetch();

        return (int) $row['Value'];
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
