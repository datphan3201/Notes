<?php

declare(strict_types=1);

namespace Tests\Plain\Integration;

use PDO;
use PHPUnit\Framework\TestCase;
use Planner\Application\Notes\NoteCollaborationService;
use Planner\Application\Notes\NoteValidator;
use Planner\Domain\Realtime\TextOperation;
use Planner\Http\Validation\InputValidator;
use Planner\Infrastructure\Database\MigrationRunner;
use Planner\Infrastructure\Persistence\Pdo\Account\PdoAccountRepository;
use Planner\Infrastructure\Persistence\Pdo\Notes\PdoNoteShareRepository;
use Planner\Infrastructure\Realtime\CollaborationHub;
use Ramsey\Uuid\Uuid;
use RuntimeException;

/** The realtime sequencer over real MySQL, without sockets. */
final class CollaborationHubTest extends TestCase
{
    /** @var array<string, mixed> */
    private array $runtime;

    private PDO $pdo;

    private int $owner;

    private int $friend;

    private string $noteId;

    private string $shareId;

    /** @var array<int, list<array<string, mixed>>> */
    private array $sent = [];

    /** @var array<int, int> */
    private array $closed = [];

    private CollaborationHub $hub;

    protected function setUp(): void
    {
        if (session_status() === PHP_SESSION_ACTIVE) {
            session_write_close();
        }
        session_id('');
        $_SESSION = [];
        $this->runtime = require dirname(__DIR__, 3).'/bootstrap/http.php';
        $this->pdo = $this->runtime['pdo'];
        self::assertSame('goals_test', $this->pdo->query('SELECT DATABASE()')->fetchColumn());
        $this->wipe();
        (new MigrationRunner($this->pdo, dirname(__DIR__, 3).'/database/plain-migrations', 'goals_test'))->migrate();
        $accounts = new PdoAccountRepository($this->pdo);
        $hash = password_hash('correct horse battery staple', PASSWORD_BCRYPT);
        $this->owner = $accounts->insertUser('owner@example.test', 'Owner', $hash, '2026-11-01 08:00:00.000000')->id;
        $this->friend = $accounts->insertUser('friend@example.test', 'Friend', $hash, '2026-11-01 08:00:00.000000')->id;
        foreach ([$this->owner, $this->friend] as $user) {
            $this->pdo->prepare('INSERT INTO user_preferences (user_id, created_at, updated_at) VALUES (?, UTC_TIMESTAMP(6), UTC_TIMESTAMP(6)) ON DUPLICATE KEY UPDATE user_id = user_id')->execute([$user]);
        }
        $this->noteId = strtolower(Uuid::uuid4()->toString());
        $this->pdo->prepare("INSERT INTO notes (id, user_id, title, content, color, version, created_at, updated_at) VALUES (?, ?, 'Plan', 'abc', 'neutral', 1, UTC_TIMESTAMP(6), UTC_TIMESTAMP(6))")->execute([$this->noteId, $this->owner]);
        $this->shareId = strtolower(Uuid::uuid4()->toString());
        $this->pdo->prepare("INSERT INTO note_shares (id, owner_id, note_id, recipient_id, permission, status, created_at, updated_at) VALUES (?, ?, ?, ?, 'edit', 'accepted', UTC_TIMESTAMP(6), UTC_TIMESTAMP(6))")->execute([$this->shareId, $this->owner, $this->noteId, $this->friend]);
        $service = new NoteCollaborationService($this->runtime['note_repository'], new PdoNoteShareRepository($this->pdo), $this->runtime['note_service'], new NoteValidator(new InputValidator));
        $this->hub = new CollaborationHub(
            $service,
            function (int $client, array $message): void {
                $this->sent[$client][] = $message;
            },
            function (int $client, int $code): void {
                $this->closed[$client] = $code;
            },
        );
    }

    protected function tearDown(): void
    {
        $this->runtime['session']->close();
        session_id('');
        $_SESSION = [];
    }

    public function test_concurrent_edits_converge_and_are_saved_after_typing_pauses(): void
    {
        $this->hub->join(1, $this->claims($this->owner, 'owner'), 0);
        $this->hub->join(2, $this->claims($this->friend, 'edit'), 0);
        $init = $this->sent[1][0];
        self::assertSame('init', $init['type']);
        self::assertSame('abc', $init['content']);
        self::assertSame(['title' => 0, 'content' => 0], $init['revisions']);
        self::assertCount(2, $this->last(1, 'peers')['peers']);

        // Both type at revision 0 without seeing each other.
        $this->hub->message(1, ['type' => 'op', 'field' => 'content', 'rev' => 0, 'op' => [3, ' owner']], 100);
        $this->hub->message(2, ['type' => 'op', 'field' => 'content', 'rev' => 0, 'op' => ['friend ', 3]], 150);
        self::assertSame(['type' => 'ack', 'field' => 'content', 'rev' => 1], $this->last(1, 'ack'));
        self::assertSame(2, $this->last(2, 'ack')['rev']);

        // Each client converges by applying the other's broadcast operation.
        $client1 = (string) TextOperation::fromWire([3, ' owner'])->apply('abc');
        $client1 = (string) TextOperation::fromWire($this->last(1, 'op')['op'])->apply($client1);
        // Client 2 still awaited its own acknowledgement, so (like the browser client) it
        // transforms the incoming operation over its outstanding one before applying it.
        $outstanding = TextOperation::fromWire(['friend ', 3]);
        $client2 = (string) $outstanding->apply('abc');
        $incoming = TextOperation::transform($outstanding, TextOperation::fromWire($this->last(2, 'op')['op']))[1];
        $client2 = (string) $incoming->apply($client2);
        self::assertSame('friend abc owner', $client1);
        self::assertSame($client1, $client2);
        self::assertSame($client1, $this->hub->roomState($this->noteId)['docs']['content']['text']);

        $this->hub->tick(500);
        self::assertSame('abc', $this->column('content'), 'not saved while typing');
        $this->hub->tick(900);
        self::assertSame('friend abc owner', $this->column('content'));
        self::assertSame(2, (int) $this->column('version'));
        self::assertSame(['type' => 'saved', 'version' => 2], array_intersect_key($this->last(1, 'saved'), ['type' => 1, 'version' => 1]));
        // The owner learns that a collaborator changed the shared note.
        self::assertSame(1, (int) $this->pdo->query("SELECT COUNT(*) FROM notifications WHERE type = 'shared_note_updated' AND user_id = {$this->owner}")->fetchColumn());
    }

    public function test_view_only_clients_cannot_edit_and_stale_operations_resync(): void
    {
        $this->hub->join(1, $this->claims($this->friend, 'view'), 0);
        $this->hub->message(1, ['type' => 'op', 'field' => 'content', 'rev' => 0, 'op' => [3, '!']], 10);
        self::assertSame('READ_ONLY', $this->last(1, 'error')['code']);

        $this->hub->join(2, $this->claims($this->owner, 'owner'), 0);
        $this->hub->message(2, ['type' => 'op', 'field' => 'content', 'rev' => 0, 'op' => [99, '!']], 10);
        self::assertSame(['type' => 'resync', 'field' => 'content', 'rev' => 0, 'text' => 'abc'], $this->last(2, 'resync'));
        $this->hub->message(2, ['type' => 'op', 'field' => 'notes', 'rev' => 0, 'op' => ['x']], 10);
        self::assertSame('BAD_OPERATION', $this->last(2, 'error')['code']);
        $this->hub->message(2, ['type' => 'cursor', 'field' => 'content', 'sel' => [1, 2]], 10);
        self::assertSame(['field' => 'content', 'sel' => [1, 2]], $this->last(1, 'cursor')['cursor']);
    }

    public function test_invalid_text_is_not_saved_and_revoked_recipients_are_disconnected(): void
    {
        $this->hub->join(1, $this->claims($this->owner, 'owner'), 0);
        $this->hub->join(2, $this->claims($this->friend, 'edit'), 0);
        $this->hub->message(1, ['type' => 'op', 'field' => 'title', 'rev' => 0, 'op' => [-4]], 0);
        $this->hub->tick(1000);
        self::assertSame('invalid', $this->last(2, 'save_state')['state']);
        self::assertSame('Plan', $this->column('title'));

        $this->pdo->exec("DELETE FROM note_shares WHERE id = '{$this->shareId}'");
        $this->hub->tick(6000);
        self::assertSame('revoked', $this->last(2, 'revoked')['type']);
        self::assertSame(4403, $this->closed[2]);
        self::assertCount(1, $this->last(1, 'peers')['peers']);

        // Fixing the title and leaving saves the merged text.
        $this->hub->message(1, ['type' => 'op', 'field' => 'title', 'rev' => 1, 'op' => ['Trip']], 7000);
        $this->hub->leave(1, 7100);
        self::assertSame('Trip', $this->column('title'));
        self::assertSame(0, $this->hub->roomCount());
    }

    public function test_deleted_notes_close_the_room(): void
    {
        $this->pdo->exec("UPDATE notes SET deleted_at = UTC_TIMESTAMP(6) WHERE id = '{$this->noteId}'");
        $this->hub->join(1, $this->claims($this->owner, 'owner'), 0);
        self::assertSame('gone', $this->sent[1][0]['type']);
        self::assertSame(4404, $this->closed[1]);
    }

    /** @return array{user_id:int,name:string,owner_id:int,note_id:string,permission:string} */
    private function claims(int $user, string $permission): array
    {
        return ['user_id' => $user, 'name' => $user === $this->owner ? 'Owner' : 'Friend', 'owner_id' => $this->owner, 'note_id' => $this->noteId, 'permission' => $permission];
    }

    /** @return array<string, mixed> */
    private function last(int $client, string $type): array
    {
        foreach (array_reverse($this->sent[$client] ?? []) as $message) {
            if ($message['type'] === $type) {
                return $message;
            }
        }
        self::fail("Client $client received no $type message.");
    }

    private function column(string $name): string
    {
        return (string) $this->pdo->query("SELECT $name FROM notes WHERE id = '{$this->noteId}'")->fetchColumn();
    }

    private function wipe(): void
    {
        $tables = $this->pdo->query("SELECT table_name FROM information_schema.tables WHERE table_schema = 'goals_test' AND table_type = 'BASE TABLE'")->fetchAll(PDO::FETCH_COLUMN);
        $this->pdo->exec('SET FOREIGN_KEY_CHECKS = 0');
        try {
            foreach ($tables as $table) {
                if (! is_string($table) || preg_match('/^[a-z0-9_]+$/', $table) !== 1) {
                    throw new RuntimeException('Unsafe table.');
                }
                $this->pdo->exec("DROP TABLE `$table`");
            }
        } finally {
            $this->pdo->exec('SET FOREIGN_KEY_CHECKS = 1');
        }
    }
}
