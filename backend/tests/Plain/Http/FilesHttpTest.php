<?php

declare(strict_types=1);

namespace Tests\Plain\Http;

use PDO;
use PHPUnit\Framework\TestCase;
use Planner\Application\Files\PruneFiles;
use Planner\Http\Application;
use Planner\Http\Request;
use Planner\Http\Response;
use Planner\Infrastructure\Database\MigrationRunner;
use Planner\Infrastructure\Session\SessionManager;
use Planner\Infrastructure\Storage\LocalPrivateStorage;
use Psr\Log\NullLogger;
use Ramsey\Uuid\Uuid;
use RuntimeException;

final class FilesHttpTest extends TestCase
{
    private Application $application;

    private SessionManager $session;

    private PDO $pdo;

    private LocalPrivateStorage $storage;

    /** @var array<string, mixed> */
    private array $runtime;

    /** @var list<string> */
    private array $temporaryFiles = [];

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
        $this->storage = $this->runtime['private_storage'];
        self::assertSame('/tmp/planner-private-tests', $this->storage->root());
        self::assertSame('goals_test', $this->pdo->query('SELECT DATABASE()')->fetchColumn());
        $this->wipeTargetDatabase();
        (new MigrationRunner(
            $this->pdo,
            dirname(__DIR__, 3).'/database/plain-migrations',
            'goals_test',
        ))->migrate();
        $this->clearManagedStorage();
    }

    protected function tearDown(): void
    {
        $this->session->close();
        session_id('');
        $_SESSION = [];
        $_COOKIE = [];

        foreach ($this->temporaryFiles as $path) {
            if (is_file($path) || is_link($path)) {
                unlink($path);
            }
        }

        $this->clearManagedStorage();
    }

    public function test_attachment_replay_stream_ranges_owner_scope_and_tombstone(): void
    {
        [$cookie, $csrf, $userId] = $this->registerAccount('files@example.test');
        $noteId = $this->createNote($cookie, $csrf);
        $attachmentId = strtolower(Uuid::uuid4()->toString());
        $bytes = "Hello private file\n";
        $originalNote = $this->pdo->query('SELECT version, updated_at FROM notes WHERE id = '.$this->pdo->quote($noteId))->fetch();

        $created = $this->multipart('POST', '/api/v1/notes/'.$noteId.'/attachments', [
            'id' => $attachmentId,
        ], ['file' => $this->upload('study-material.txt', $bytes)], $cookie, $csrf);
        self::assertSame(201, $created->status);
        $createdData = $this->json($created)['data'];
        self::assertSame('study-material.txt', $createdData['original_name']);
        self::assertSame('text/plain', $createdData['mime_type']);
        self::assertSame('file', $createdData['kind']);
        self::assertNull($createdData['preview_url']);
        $path = $this->pdo->query('SELECT path FROM attachments WHERE id = '.$this->pdo->quote($attachmentId))->fetchColumn();
        self::assertIsString($path);
        self::assertSame($bytes, file_get_contents($this->storage->resolve($path)));

        $replay = $this->multipart('POST', '/api/v1/notes/'.$noteId.'/attachments', [
            'id' => $attachmentId,
        ], ['file' => $this->upload('study-material.txt', $bytes)], $cookie, $csrf);
        self::assertSame(200, $replay->status);
        self::assertTrue($this->json($replay)['meta']['replayed']);
        self::assertCount(1, $this->storage->managedFiles());

        $conflict = $this->multipart('POST', '/api/v1/notes/'.$noteId.'/attachments', [
            'id' => $attachmentId,
        ], ['file' => $this->upload('study-material.txt', 'different bytes')], $cookie, $csrf);
        self::assertSame(409, $conflict->status);
        self::assertSame('UPLOAD_ID_REUSED', $this->json($conflict)['code']);
        self::assertCount(1, $this->storage->managedFiles());

        $download = $this->request('GET', '/files/attachments/'.$attachmentId.'/download', cookie: $cookie);
        self::assertSame(200, $download->status);
        self::assertSame($bytes, $download->captureStream());
        self::assertSame((string) strlen($bytes), $download->headers['Content-Length']);
        self::assertSame('bytes', $download->headers['Accept-Ranges']);
        self::assertStringContainsString('attachment;', $download->headers['Content-Disposition']);
        self::assertStringContainsString("filename*=UTF-8''", $download->headers['Content-Disposition']);
        self::assertStringNotContainsString("\r", $download->headers['Content-Disposition']);
        self::assertStringNotContainsString("\n", $download->headers['Content-Disposition']);

        $rangeCases = [
            ['bytes=0-2', substr($bytes, 0, 3), 'bytes 0-2/'.strlen($bytes)],
            ['bytes=4-', substr($bytes, 4), 'bytes 4-'.(strlen($bytes) - 1).'/'.strlen($bytes)],
            ['bytes=-4', substr($bytes, -4), 'bytes '.(strlen($bytes) - 4).'-'.(strlen($bytes) - 1).'/'.strlen($bytes)],
        ];

        foreach ($rangeCases as [$rangeHeader, $expected, $contentRange]) {
            $range = $this->request(
                'GET',
                '/files/attachments/'.$attachmentId.'/download',
                cookie: $cookie,
                extraHeaders: ['range' => $rangeHeader],
            );
            self::assertSame(206, $range->status);
            self::assertSame($expected, $range->captureStream());
            self::assertSame($contentRange, $range->headers['Content-Range']);
        }

        foreach (['bytes=999-', 'bytes=0-1,4-5', 'items=0-1', 'bytes=-0'] as $invalidRange) {
            $range = $this->request(
                'GET',
                '/files/attachments/'.$attachmentId.'/download',
                cookie: $cookie,
                extraHeaders: ['range' => $invalidRange],
            );
            self::assertSame(416, $range->status);
            self::assertSame('bytes */'.strlen($bytes), $range->headers['Content-Range']);
        }

        $head = $this->request('HEAD', '/files/attachments/'.$attachmentId.'/download', cookie: $cookie);
        ob_start();
        $head->emit(true);
        self::assertSame('', (string) ob_get_clean());
        self::assertSame((string) strlen($bytes), $head->headers['Content-Length']);
        self::assertSame(404, $this->request('GET', '/files/attachments/'.$attachmentId.'/preview', cookie: $cookie)->status);

        $otherId = $this->seedAccount('other-files@example.test');
        [$otherCookie, $otherCsrf] = $this->sessionForUser($otherId);
        self::assertSame(404, $this->request('GET', '/files/attachments/'.$attachmentId.'/download', cookie: $otherCookie)->status);
        self::assertSame(404, $this->request('GET', '/api/v1/notes/'.$noteId.'/attachments', cookie: $otherCookie)->status);
        $otherNote = $this->createNote($otherCookie, $otherCsrf);
        self::assertSame(404, $this->multipart('POST', '/api/v1/notes/'.$otherNote.'/attachments', [
            'id' => $attachmentId,
        ], ['file' => $this->upload('collision.txt', 'foreign collision')], $otherCookie, $otherCsrf)->status);
        self::assertCount(1, $this->storage->managedFiles());

        $otherNote = $this->createNote($cookie, $csrf);
        self::assertSame(404, $this->api(
            'DELETE',
            '/api/v1/notes/'.$otherNote.'/attachments/'.$attachmentId,
            [],
            $cookie,
            $csrf,
        )->status);
        self::assertNull($this->pdo->query('SELECT deleted_at FROM attachments WHERE id = '.$this->pdo->quote($attachmentId))->fetchColumn());

        self::assertSame(204, $this->api(
            'DELETE',
            '/api/v1/notes/'.$noteId.'/attachments/'.$attachmentId,
            [],
            $cookie,
            $csrf,
        )->status);
        self::assertSame(204, $this->api(
            'DELETE',
            '/api/v1/notes/'.$noteId.'/attachments/'.$attachmentId,
            [],
            $cookie,
            $csrf,
        )->status);
        $deleted = $this->pdo->query('SELECT * FROM attachments WHERE id = '.$this->pdo->quote($attachmentId))->fetch();
        self::assertSame('', $deleted['original_name']);
        self::assertNull($deleted['path']);
        self::assertNotNull($deleted['deleted_at']);
        self::assertSame(0, (int) $this->pdo->query('SELECT COUNT(*) FROM pending_file_deletions')->fetchColumn());
        self::assertSame([], $this->storage->managedFiles());
        $currentNote = $this->pdo->query('SELECT version, updated_at FROM notes WHERE id = '.$this->pdo->quote($noteId))->fetch();
        self::assertSame((int) $originalNote['version'], (int) $currentNote['version']);
        self::assertSame($originalNote['updated_at'], $currentNote['updated_at']);
        self::assertSame(404, $this->request('GET', '/files/attachments/'.$attachmentId.'/download', cookie: $cookie)->status);
        self::assertSame(410, $this->multipart('POST', '/api/v1/notes/'.$noteId.'/attachments', [
            'id' => $attachmentId,
        ], ['file' => $this->upload('study-material.txt', $bytes)], $cookie, $csrf)->status);
    }

    public function test_invalid_files_quota_and_unknown_fields_leave_no_orphan_bytes(): void
    {
        [$cookie, $csrf, $userId] = $this->registerAccount('validation-files@example.test');
        $noteId = $this->createNote($cookie, $csrf);
        $invalid = [
            ['empty.txt', '', 413],
            ['script.txt', '<!doctype html><script>alert(1)</script>', 422],
            ['corrupt.png', 'not an image', 422],
            ['unsupported.exe', 'MZ executable', 422],
            ['nul.txt', "valid\0invalid", 422],
        ];

        foreach ($invalid as [$name, $bytes, $expectedStatus]) {
            $response = $this->multipart('POST', '/api/v1/notes/'.$noteId.'/attachments', [
                'id' => strtolower(Uuid::uuid4()->toString()),
            ], ['file' => $this->upload($name, $bytes)], $cookie, $csrf);
            self::assertSame($expectedStatus, $response->status, $name);
            self::assertSame($expectedStatus === 413 ? 'PAYLOAD_TOO_LARGE' : 'VALIDATION_FAILED', $this->json($response)['code']);
        }

        $unknown = $this->multipart('POST', '/api/v1/notes/'.$noteId.'/attachments', [
            'id' => strtolower(Uuid::uuid4()->toString()),
            'path' => '/tmp/attacker',
        ], ['file' => $this->upload('valid.txt', 'valid')], $cookie, $csrf);
        self::assertSame(422, $unknown->status);
        self::assertSame([], $this->storage->managedFiles());

        $insert = $this->pdo->prepare(<<<'SQL'
INSERT INTO attachments
    (id, user_id, note_id, original_name, path, mime_type, kind, size_bytes, sha256, created_at, updated_at)
VALUES
    (?, ?, ?, ?, ?, 'text/plain', 'file', 1, ?, NOW(6), NOW(6))
SQL);

        for ($index = 1; $index <= 20; $index++) {
            $insert->execute([
                strtolower(Uuid::uuid4()->toString()),
                $userId,
                $noteId,
                'existing-'.$index.'.txt',
                'attachments/existing-'.$index.'.bin',
                hash('sha256', 'existing-'.$index),
            ]);
        }

        $overQuota = $this->multipart('POST', '/api/v1/notes/'.$noteId.'/attachments', [
            'id' => strtolower(Uuid::uuid4()->toString()),
        ], ['file' => $this->upload('over-limit.txt', 'valid')], $cookie, $csrf);
        self::assertSame(422, $overQuota->status);
        self::assertArrayHasKey('file', $this->json($overQuota)['errors']);
        self::assertSame(20, (int) $this->pdo->query('SELECT COUNT(*) FROM attachments WHERE deleted_at IS NULL')->fetchColumn());
        self::assertSame([], $this->storage->managedFiles());
    }

    public function test_avatar_is_reencoded_replaced_safely_streamed_and_removed(): void
    {
        [$cookie, $csrf] = $this->registerAccount('avatar@example.test');
        $png = base64_decode(
            'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNk+A8AAQUBAScY42YAAAAASUVORK5CYII=',
            true,
        );
        self::assertIsString($png);
        $avatar = $this->multipart('POST', '/api/v1/profile/avatar', [], [
            'avatar' => $this->upload('avatar.png', $png),
        ], $cookie, $csrf);
        self::assertSame(200, $avatar->status);
        self::assertSame('/files/avatar', $this->json($avatar)['data']['avatar_url']);
        $path = $this->pdo->query("SELECT avatar_path FROM users WHERE email = 'avatar@example.test'")->fetchColumn();
        self::assertIsString($path);
        $absolute = $this->storage->resolve($path);
        self::assertSame('image/jpeg', (new \finfo(FILEINFO_MIME_TYPE))->file($absolute));
        $dimensions = getimagesize($absolute);
        self::assertSame(512, $dimensions[0]);
        self::assertSame(512, $dimensions[1]);
        $originalBytes = file_get_contents($absolute);

        $served = $this->request('GET', '/files/avatar', cookie: $cookie);
        self::assertSame(200, $served->status);
        self::assertSame('image/jpeg', $served->headers['Content-Type']);
        self::assertSame($originalBytes, $served->captureStream());

        $invalid = $this->multipart('POST', '/api/v1/profile/avatar', [], [
            'avatar' => $this->upload('avatar.png', 'corrupt'),
        ], $cookie, $csrf);
        self::assertSame(422, $invalid->status);
        self::assertSame($path, $this->pdo->query("SELECT avatar_path FROM users WHERE email = 'avatar@example.test'")->fetchColumn());
        self::assertSame($originalBytes, file_get_contents($absolute));

        $unknownDelete = $this->api('DELETE', '/api/v1/profile/avatar', ['avatar_path' => null], $cookie, $csrf);
        self::assertSame(422, $unknownDelete->status);
        self::assertSame($path, $this->pdo->query("SELECT avatar_path FROM users WHERE email = 'avatar@example.test'")->fetchColumn());
        self::assertSame(204, $this->api('DELETE', '/api/v1/profile/avatar', [], $cookie, $csrf)->status);
        self::assertFalse(file_exists($absolute));
        self::assertFalse((bool) $this->pdo->query("SELECT avatar_path IS NOT NULL FROM users WHERE email = 'avatar@example.test'")->fetchColumn());
        self::assertSame(404, $this->request('GET', '/files/avatar', cookie: $cookie)->status);
    }

    public function test_image_attachment_preview_serves_detected_type_and_original_bytes(): void
    {
        [$cookie, $csrf] = $this->registerAccount('preview@example.test');
        $noteId = $this->createNote($cookie, $csrf);
        $attachmentId = strtolower(Uuid::uuid4()->toString());
        $png = base64_decode(
            'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNk+A8AAQUBAScY42YAAAAASUVORK5CYII=',
            true,
        );
        self::assertIsString($png);
        $created = $this->multipart('POST', '/api/v1/notes/'.$noteId.'/attachments', [
            'id' => $attachmentId,
        ], ['file' => $this->upload('pixel.png', $png)], $cookie, $csrf);
        self::assertSame(201, $created->status);
        self::assertSame('image', $this->json($created)['data']['kind']);
        self::assertSame('/files/attachments/'.$attachmentId.'/preview', $this->json($created)['data']['preview_url']);

        $preview = $this->request('GET', '/files/attachments/'.$attachmentId.'/preview', cookie: $cookie);
        self::assertSame(200, $preview->status);
        self::assertSame('image/png', $preview->headers['Content-Type']);
        self::assertSame('inline', $preview->headers['Content-Disposition']);
        self::assertSame($png, $preview->captureStream());
    }

    public function test_pending_cleanup_retries_and_prune_preserves_referenced_or_recent_files(): void
    {
        [$cookie, $csrf, $userId] = $this->registerAccount('prune@example.test');
        $noteId = $this->createNote($cookie, $csrf);
        $pendingPath = $this->storage->putBytes('attachments', 'pending', 'bin');
        $pendingAbsolute = $this->storage->resolve($pendingPath);
        $outside = $this->upload('outside.bin', 'outside')['tmp_name'];
        unlink($pendingAbsolute);
        symlink($outside, $pendingAbsolute);
        $timestamp = gmdate('Y-m-d H:i:s').'.000000';
        $this->runtime['pending_deletion_repository']->queue($userId, $pendingPath, $timestamp);

        $failed = $this->runtime['file_cleanup']->handle([$pendingPath]);
        self::assertSame(['completed' => 0, 'failed' => 1], $failed);
        self::assertSame(1, (int) $this->pdo->query(
            'SELECT attempts FROM pending_file_deletions WHERE path = '.$this->pdo->quote($pendingPath),
        )->fetchColumn());
        self::assertFileExists($outside);

        unlink($pendingAbsolute);
        file_put_contents($pendingAbsolute, 'retry bytes');
        $retried = $this->runtime['file_cleanup']->handle([$pendingPath]);
        self::assertSame(['completed' => 1, 'failed' => 0], $retried);
        self::assertFileDoesNotExist($pendingAbsolute);
        self::assertSame(0, (int) $this->pdo->query('SELECT COUNT(*) FROM pending_file_deletions')->fetchColumn());

        $referenced = $this->storage->putBytes('attachments', 'referenced', 'bin');
        $orphan = $this->storage->putBytes('attachments', 'old orphan', 'bin');
        $recent = $this->storage->putBytes('avatars', 'recent orphan', 'jpg');
        $referencedAbsolute = $this->storage->resolve($referenced);
        $orphanAbsolute = $this->storage->resolve($orphan);
        $recentAbsolute = $this->storage->resolve($recent);
        touch($referencedAbsolute, time() - 7200);
        touch($orphanAbsolute, time() - 7200);
        clearstatcache(true);
        $insert = $this->pdo->prepare(<<<'SQL'
INSERT INTO attachments
    (id, user_id, note_id, original_name, path, mime_type, kind, size_bytes, sha256, created_at, updated_at)
VALUES
    (?, ?, ?, 'kept.txt', ?, 'text/plain', 'file', 10, ?, NOW(6), NOW(6))
SQL);
        $insert->execute([
            strtolower(Uuid::uuid4()->toString()),
            $userId,
            $noteId,
            $referenced,
            hash('sha256', 'referenced'),
        ]);
        $prune = new PruneFiles(
            $this->runtime['file_cleanup'],
            $this->runtime['attachment_repository'],
            $this->runtime['account_repository'],
            $this->storage,
            $this->runtime['clock'],
            new NullLogger,
        );
        $result = $prune->run();
        self::assertSame(1, $result['orphans_deleted']);
        self::assertFileExists($referencedAbsolute);
        self::assertFileDoesNotExist($orphanAbsolute);
        self::assertFileExists($recentAbsolute);

        $second = $prune->run();
        self::assertSame(0, $second['orphans_deleted']);
        self::assertSame(0, $second['pending_completed']);
    }

    public function test_competing_uploads_serialize_the_final_quota_slot(): void
    {
        [$cookie, $csrf, $userId] = $this->registerAccount('concurrent-quota@example.test');
        $noteId = $this->createNote($cookie, $csrf);
        $this->seedAttachments($userId, $noteId, 19);
        $uploadOne = $this->upload('one.txt', 'one concurrent upload')['tmp_name'];
        $uploadTwo = $this->upload('two.txt', 'two concurrent upload')['tmp_name'];
        $results = $this->runWorkers([
            ['upload', $userId, $noteId, strtolower(Uuid::uuid4()->toString()), $uploadOne],
            ['upload', $userId, $noteId, strtolower(Uuid::uuid4()->toString()), $uploadTwo],
        ]);
        $statuses = array_column($results, 'status');
        sort($statuses);

        self::assertSame([201, 422], $statuses);
        self::assertSame(20, (int) $this->pdo->query(
            'SELECT COUNT(*) FROM attachments WHERE user_id = '.$userId.' AND note_id = '.$this->pdo->quote($noteId).' AND deleted_at IS NULL',
        )->fetchColumn());
        self::assertCount(1, $this->storage->managedFiles());
    }

    public function test_upload_racing_delete_preserves_quota_and_file_metadata_integrity(): void
    {
        [$cookie, $csrf, $userId] = $this->registerAccount('concurrent-delete@example.test');
        $noteId = $this->createNote($cookie, $csrf);
        $existingIds = $this->seedAttachments($userId, $noteId, 20);
        $upload = $this->upload('replacement.txt', 'replacement bytes')['tmp_name'];
        $results = $this->runWorkers([
            ['upload', $userId, $noteId, strtolower(Uuid::uuid4()->toString()), $upload],
            ['delete', $userId, $noteId, $existingIds[0], ''],
        ]);
        $uploadResult = $results[0];
        $deleteResult = $results[1];

        self::assertContains($uploadResult['status'], [201, 422]);
        self::assertSame(204, $deleteResult['status']);
        $active = (int) $this->pdo->query(
            'SELECT COUNT(*) FROM attachments WHERE user_id = '.$userId.' AND note_id = '.$this->pdo->quote($noteId).' AND deleted_at IS NULL',
        )->fetchColumn();
        self::assertContains($active, [19, 20]);
        self::assertLessThanOrEqual(20, $active);
        self::assertCount($uploadResult['status'] === 201 ? 1 : 0, $this->storage->managedFiles());
        self::assertSame(0, (int) $this->pdo->query('SELECT COUNT(*) FROM pending_file_deletions')->fetchColumn());
    }

    /** @return array{string,string,int} */
    private function registerAccount(string $email): array
    {
        $page = $this->request('GET', '/register');
        preg_match('/name="_token" value="([a-f0-9]{64})"/', $page->body, $match);
        $cookie = $this->session->id();
        $this->request('POST', '/register', [
            '_token' => $match[1],
            'display_name' => 'File User',
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

    /** @return array{string,string} */
    private function sessionForUser(int $userId): array
    {
        $this->session->start(new Request('GET', '/', server: ['REMOTE_ADDR' => '198.51.100.30']));
        $this->session->login($userId, 1);
        $cookie = $this->session->id();
        $csrf = $this->session->csrfToken();
        $this->session->close();

        return [$cookie, $csrf];
    }

    private function createNote(string $cookie, string $csrf): string
    {
        $id = strtolower(Uuid::uuid4()->toString());
        $response = $this->api('POST', '/api/v1/notes', [
            'id' => $id,
            'title' => 'File note',
            'content' => 'Body remains unchanged',
            'color' => 'neutral',
        ], $cookie, $csrf);
        self::assertSame(201, $response->status);

        return $id;
    }

    /** @return list<string> */
    private function seedAttachments(int $userId, string $noteId, int $count): array
    {
        $insert = $this->pdo->prepare(<<<'SQL'
INSERT INTO attachments
    (id, user_id, note_id, original_name, path, mime_type, kind, size_bytes, sha256, created_at, updated_at)
VALUES
    (?, ?, ?, ?, ?, 'text/plain', 'file', 1, ?, NOW(6), NOW(6))
SQL);
        $ids = [];

        for ($index = 1; $index <= $count; $index++) {
            $id = strtolower(Uuid::uuid4()->toString());
            $ids[] = $id;
            $insert->execute([
                $id,
                $userId,
                $noteId,
                'existing-'.$index.'.txt',
                'attachments/existing-'.$index.'.bin',
                hash('sha256', 'existing-'.$index),
            ]);
        }

        return $ids;
    }

    /**
     * @param  list<array{string,int,string,string,string}>  $workers
     * @return list<array{status:int,code?:string}>
     */
    private function runWorkers(array $workers): array
    {
        $barrier = tempnam('/tmp', 'planner-barrier-');

        if (! is_string($barrier)) {
            throw new RuntimeException('Unable to create concurrency barrier.');
        }

        unlink($barrier);
        $this->temporaryFiles[] = $barrier;
        $processes = [];

        foreach ($workers as [$operation, $userId, $noteId, $attachmentId, $uploadPath]) {
            $pipes = [];
            $process = proc_open([
                PHP_BINARY,
                dirname(__DIR__).'/Fixtures/file-concurrency-worker.php',
                $operation,
                $barrier,
                (string) $userId,
                $noteId,
                $attachmentId,
                $uploadPath,
            ], [
                0 => ['pipe', 'r'],
                1 => ['pipe', 'w'],
                2 => ['pipe', 'w'],
            ], $pipes, dirname(__DIR__, 3));

            if (! is_resource($process)) {
                throw new RuntimeException('Unable to start concurrency worker.');
            }

            fclose($pipes[0]);
            $processes[] = [$process, $pipes];
        }

        touch($barrier);
        $results = [];

        foreach ($processes as [$process, $pipes]) {
            $stdout = stream_get_contents($pipes[1]);
            $stderr = stream_get_contents($pipes[2]);
            fclose($pipes[1]);
            fclose($pipes[2]);
            $exit = proc_close($process);

            if ($exit !== 0 || ! is_string($stdout)) {
                throw new RuntimeException('Concurrency worker failed: '.(string) $stderr);
            }

            $result = json_decode($stdout, true, flags: JSON_THROW_ON_ERROR);

            if (! is_array($result) || ! is_int($result['status'] ?? null)) {
                throw new RuntimeException('Concurrency worker returned invalid output.');
            }

            $results[] = $result;
        }

        return $results;
    }

    /** @return array{name:string,tmp_name:string,error:int,size:int,type:string} */
    private function upload(string $name, string $bytes): array
    {
        $path = tempnam('/tmp', 'planner-upload-');

        if (! is_string($path)) {
            throw new RuntimeException('Unable to create test upload.');
        }

        file_put_contents($path, $bytes);
        $this->temporaryFiles[] = $path;

        return [
            'name' => $name,
            'tmp_name' => $path,
            'error' => UPLOAD_ERR_OK,
            'size' => strlen($bytes),
            'type' => 'application/octet-stream',
        ];
    }

    /** @param array<string, mixed> $form @param array<string, mixed> $files */
    private function multipart(
        string $method,
        string $url,
        array $form,
        array $files,
        string $cookie,
        string $csrf,
    ): Response {
        return $this->request($method, $url, $form, $cookie, $csrf, false, [], $files);
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

    /**
     * @param  array<string, mixed>  $input
     * @param  array<string, string>  $extraHeaders
     * @param  array<string, mixed>  $files
     */
    private function request(
        string $method,
        string $url,
        array $input = [],
        ?string $cookie = null,
        ?string $csrf = null,
        bool $json = false,
        array $extraHeaders = [],
        array $files = [],
    ): Response {
        $path = parse_url($url, PHP_URL_PATH);
        parse_str((string) parse_url($url, PHP_URL_QUERY), $query);
        $headers = [
            'accept' => str_starts_with((string) $path, '/api/') ? 'application/json' : '*/*',
            ...$extraHeaders,
        ];
        $form = $input;
        $body = '';

        if ($json && $method !== 'GET' && $method !== 'HEAD') {
            $headers['content-type'] = 'application/json';
            $body = json_encode($input === [] ? (object) [] : $input, JSON_THROW_ON_ERROR);
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
            files: $files,
            server: ['REMOTE_ADDR' => '198.51.100.30'],
            rawBody: $body,
        ));
    }

    /** @param array<mixed> $query @return array<string, string|list<string>> */
    private function queryStrings(array $query): array
    {
        $result = [];

        foreach ($query as $key => $value) {
            if (is_string($key)) {
                $result[$key] = is_array($value)
                    ? array_values(array_map('strval', $value))
                    : (string) $value;
            }
        }

        return $result;
    }

    /** @return array<string, mixed> */
    private function json(Response $response): array
    {
        return json_decode($response->body, true, flags: JSON_THROW_ON_ERROR);
    }

    private function clearManagedStorage(): void
    {
        foreach (['attachments', 'avatars'] as $directory) {
            $path = $this->storage->root().'/'.$directory;

            foreach (new \FilesystemIterator($path, \FilesystemIterator::SKIP_DOTS) as $item) {
                if ($item->isDir() && ! $item->isLink()) {
                    throw new RuntimeException('Unexpected directory in test private storage.');
                }

                unlink($item->getPathname());
            }
        }
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
