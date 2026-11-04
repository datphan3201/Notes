<?php

declare(strict_types=1);

namespace Tests\Plain\Integration;

use PDO;
use PHPUnit\Framework\TestCase;
use Planner\Application\AI\AIProviderInterface;
use Planner\Application\AI\GenerationRequest;
use Planner\Application\AI\GenerationResult;
use Planner\Application\Notes\NoteAIService;
use Planner\Http\HttpException;
use Planner\Infrastructure\Database\MigrationRunner;
use Planner\Infrastructure\Persistence\Pdo\Account\PdoAccountRepository;
use Planner\Infrastructure\Persistence\Pdo\Notes\PdoNoteAIRepository;
use Planner\Infrastructure\Persistence\Pdo\Notes\PdoNoteShareRepository;
use Ramsey\Uuid\Uuid;
use RuntimeException;

/** AI Summary and AI Q&A over real MySQL with a scripted provider (no live AI). */
final class NoteAIServiceTest extends TestCase
{
    /** @var array<string, mixed> */
    private array $runtime;

    private PDO $pdo;

    private int $owner;

    private int $friend;

    protected function setUp(): void
    {
        if (session_status() === PHP_SESSION_ACTIVE) {
            session_write_close();
        }
        session_id('');
        $_SESSION = [];
        $_COOKIE = [];
        $this->runtime = require dirname(__DIR__, 3).'/bootstrap/http.php';
        $this->pdo = $this->runtime['pdo'];
        self::assertSame('goals_test', $this->pdo->query('SELECT DATABASE()')->fetchColumn());
        $this->wipe();
        (new MigrationRunner($this->pdo, dirname(__DIR__, 3).'/database/plain-migrations', 'goals_test'))->migrate();
        $accounts = new PdoAccountRepository($this->pdo);
        $hash = password_hash('correct horse battery staple', PASSWORD_BCRYPT);
        $this->owner = $accounts->insertUser('owner@example.test', 'Owner', $hash, '2026-11-01 08:00:00.000000')->id;
        $this->friend = $accounts->insertUser('friend@example.test', 'Friend', $hash, '2026-11-01 08:00:00.000000')->id;
    }

    protected function tearDown(): void
    {
        $this->runtime['session']->close();
        session_id('');
        $_SESSION = [];
        $_COOKIE = [];
    }

    public function test_summary_is_cleaned_stored_and_goes_stale_only_when_text_changes(): void
    {
        $id = $this->note($this->owner, 'Meeting', 'We agreed to ship on Friday. Lan owns the release notes.');
        $provider = $this->provider(complete: ["## Summary\n- **Ship** on Friday\n- Lan owns the release notes"]);
        $service = $this->service($provider);

        self::assertNull($service->summary($this->owner, $id)['summary']);
        $summary = $service->summarize($this->owner, $id);
        self::assertSame("Summary\n- Ship on Friday\n- Lan owns the release notes", $summary['summary']);
        self::assertFalse($summary['is_stale']);
        self::assertStringContainsString('We agreed to ship on Friday.', $provider->prompts[0]);
        self::assertStringContainsString('never translate', $provider->systems[0]);

        $this->pdo->exec("UPDATE notes SET pinned_at = UTC_TIMESTAMP(6), version = version + 1 WHERE id = '$id'");
        self::assertFalse($service->summary($this->owner, $id)['is_stale']);
        $this->pdo->exec("UPDATE notes SET content = 'We moved the release to Monday.', version = version + 1 WHERE id = '$id'");
        self::assertTrue($service->summary($this->owner, $id)['is_stale']);

        $this->expectException(HttpException::class);
        $service->summary($this->friend, $id);
    }

    public function test_answers_cite_only_retrieved_notes_and_skip_locked_ones(): void
    {
        $train = $this->note($this->owner, 'Travel', 'The train to Hue leaves at 7:15 from platform 2.');
        $this->note($this->owner, 'Groceries', 'Eggs, rice and coffee.');
        $locked = $this->note($this->owner, 'Secret', 'The train password is swordfish.');
        $this->pdo->exec("UPDATE notes SET lock_hash = '\$2y\$10\$abcdefghijklmnopqrstuvabcdefghijklmnopqrstuvwxyzABCDE' WHERE id = '$locked'");
        $shared = $this->note($this->friend, 'Station tips', 'Arrive early: the departure board for trains is near gate B.');
        $this->share($this->friend, $shared, $this->owner);

        $answer = json_encode(['answer' => 'It leaves at 7:15 from platform 2.', 'found' => true, 'citations' => [$train, 'not-a-retrieved-id', $shared, $train]], JSON_THROW_ON_ERROR);
        $provider = $this->provider(complete: [$answer, $answer], embed: static fn (string $text): array => str_contains(mb_strtolower($text), 'train') ? [1.0, 0.1] : [0.0, 1.0]);
        $service = $this->service($provider);

        $result = $service->ask($this->owner, 'What time does my train leave?');
        self::assertSame('It leaves at 7:15 from platform 2.', $result['answer']);
        self::assertTrue($result['found']);
        self::assertSame('semantic', $result['retrieval']);
        self::assertSame([$train, $shared], array_column($result['references'], 'id'));
        self::assertFalse($result['references'][0]['shared']);
        self::assertTrue($result['references'][1]['shared']);
        self::assertSame('Friend', $result['references'][1]['owner_name']);
        self::assertStringContainsString('7:15', $result['references'][0]['excerpt']);
        self::assertStringNotContainsString('swordfish', $provider->prompts[0]);
        self::assertStringNotContainsString($locked, $provider->prompts[0]);
        self::assertSame(4, $provider->embedded, 'three documents and one question');

        // Embeddings are reused while the text is unchanged: only the question is embedded.
        $service->ask($this->owner, 'When is the train?');
        self::assertSame(5, $provider->embedded);
    }

    public function test_keyword_fallback_when_embeddings_fail_and_no_notes_answer_without_ai(): void
    {
        $service = $this->service($this->provider(complete: []));
        $empty = $service->ask($this->owner, 'Anything?');
        self::assertFalse($empty['found']);
        self::assertSame([], $empty['references']);

        $id = $this->note($this->owner, 'Budget', 'Rent is 5 million per month.');
        $provider = $this->provider(
            complete: [json_encode(['answer' => 'The notes do not say.', 'found' => false, 'citations' => [$id]], JSON_THROW_ON_ERROR)],
            embed: static fn (): array => throw new HttpException(503, 'AI_CONFIGURATION', 'No embeddings.'),
        );
        $result = $this->service($provider)->ask($this->owner, 'How much is the rent?');
        self::assertSame('keyword', $result['retrieval']);
        self::assertFalse($result['found']);
        self::assertSame([], $result['references'], 'an answer that says "not found" cites nothing');
        self::assertStringContainsString('Rent is 5 million', $provider->prompts[0]);
    }

    private function service(AIProviderInterface $provider): NoteAIService
    {
        return new NoteAIService(
            $provider,
            $this->runtime['note_repository'],
            new PdoNoteShareRepository($this->pdo),
            new PdoNoteAIRepository($this->pdo),
            $this->runtime['note_lock_gate'],
            $this->runtime['clock'],
        );
    }

    /**
     * @param list<string> $complete queued completions
     * @param (\Closure(string): list<float>)|null $embed
     */
    private function provider(array $complete, ?\Closure $embed = null): AIProviderInterface
    {
        return new class($complete, $embed) implements AIProviderInterface {
            /** @var list<string> */
            public array $prompts = [];

            /** @var list<string> */
            public array $systems = [];

            public int $embedded = 0;

            public function __construct(private array $complete, private ?\Closure $embed)
            {
            }

            public function name(): string
            {
                return 'test';
            }

            public function model(): string
            {
                return 'test-model';
            }

            public function generate(GenerationRequest $request): GenerationResult
            {
                throw new \LogicException('Not used.');
            }

            public function chat(string $system, array $contents, array $tools): array
            {
                throw new \LogicException('Not used.');
            }

            public function complete(string $system, string $prompt, ?array $jsonSchema = null): string
            {
                $this->systems[] = $system;
                $this->prompts[] = $prompt;

                return array_shift($this->complete) ?? throw new \LogicException('Unexpected completion.');
            }

            public function embed(array $texts, string $task): array
            {
                if ($this->embed === null) {
                    throw new HttpException(503, 'AI_CONFIGURATION', 'No embeddings.');
                }
                $this->embedded += count($texts);

                return array_map(fn (string $text): array => ($this->embed)($text), $texts);
            }

            public function embeddingModel(): string
            {
                return 'test-embedding';
            }
        };
    }

    private function note(int $userId, string $title, string $content): string
    {
        $id = strtolower(Uuid::uuid4()->toString());
        $this->pdo->prepare("INSERT INTO notes (id, user_id, title, content, color, version, created_at, updated_at) VALUES (?, ?, ?, ?, 'neutral', 1, UTC_TIMESTAMP(6), UTC_TIMESTAMP(6))")
            ->execute([$id, $userId, $title, $content]);

        return $id;
    }

    private function share(int $ownerId, string $noteId, int $recipientId): void
    {
        $this->pdo->prepare("INSERT INTO note_shares (id, owner_id, note_id, recipient_id, permission, status, created_at, updated_at) VALUES (?, ?, ?, ?, 'view', 'accepted', UTC_TIMESTAMP(6), UTC_TIMESTAMP(6))")
            ->execute([strtolower(Uuid::uuid4()->toString()), $ownerId, $noteId, $recipientId]);
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
