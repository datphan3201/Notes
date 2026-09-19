<?php

declare(strict_types=1);

namespace Tests\Plain\Integration;

use DateTimeZone;
use PDO;
use PHPUnit\Framework\TestCase;
use Planner\Infrastructure\Database\MigrationRunner;
use Planner\Infrastructure\Persistence\Pdo\Account\PdoAccountRepository;
use RuntimeException;

final class HabitsRecurrenceTest extends TestCase
{
    private array $runtime;
    private PDO $pdo;
    private int $owner;

    protected function setUp(): void
    {
        if (session_status() === PHP_SESSION_ACTIVE) session_write_close();
        session_id(''); $_SESSION = []; $_COOKIE = [];
        $this->runtime = require dirname(__DIR__, 3).'/bootstrap/http.php';
        $this->pdo = $this->runtime['pdo'];
        self::assertSame('goals_test', $this->pdo->query('SELECT DATABASE()')->fetchColumn());
        $this->wipeTargetDatabase();
        (new MigrationRunner($this->pdo, dirname(__DIR__, 3).'/database/plain-migrations', 'goals_test'))->migrate();
        $this->owner = (new PdoAccountRepository($this->pdo))->insertUser(
            'habits@example.test', 'Habit Owner', password_hash('correct horse battery staple', PASSWORD_BCRYPT), '2026-09-17 12:00:00.000000',
        )->id;
    }

    protected function tearDown(): void
    {
        $this->runtime['session']->close(); session_id(''); $_SESSION = []; $_COOKIE = [];
    }

    public function test_habit_check_in_and_undo_are_idempotent_and_freeze_period_timezone(): void
    {
        $habits = $this->runtime['habit_service'];
        $habit = $habits->create($this->owner, [
            'name' => 'Exercise', 'period' => 'weekly', 'target_frequency' => 3,
            'timezone' => 'America/Mexico_City',
        ]);
        $first = $habits->checkIn($this->owner, $habit['id'], '2026-01-05');
        $again = $habits->checkIn($this->owner, $habit['id'], '2026-01-05');
        self::assertSame($first['id'], $again['id']);
        self::assertSame(1, (int) $this->pdo->query("SELECT COUNT(*) FROM activities WHERE action = 'completed'")->fetchColumn());

        $current = $habits->show($this->owner, $habit['id']);
        try {
            $habits->update($this->owner, $habit['id'], ['base_version' => $current['version'], 'timezone' => 'UTC']);
            self::fail('Timezone must freeze after first check-in.');
        } catch (\Planner\Http\ValidationException) {
            self::assertTrue(true);
        }

        $habits->undoCheckIn($this->owner, $habit['id'], '2026-01-05');
        $habits->undoCheckIn($this->owner, $habit['id'], '2026-01-05');
        self::assertSame(0, count($habits->history($this->owner, $habit['id'])));
        self::assertSame(1, (int) $this->pdo->query("SELECT COUNT(*) FROM activities WHERE action = 'reversed'")->fetchColumn());
    }

    public function test_materializer_copies_templates_and_is_retry_safe(): void
    {
        $today = $this->runtime['clock']->now()->setTimezone(new DateTimeZone('UTC'))->format('Y-m-d');
        $series = $this->runtime['task_series_service']->create($this->owner, [
            'name' => 'Daily plan', 'frequency' => 'daily', 'interval_count' => 1,
            'weekdays' => [], 'start_date' => $today, 'end_date' => $today,
            'timezone' => 'UTC', 'local_time' => '09:00', 'duration_minutes' => 30,
            'deadline_offset_days' => 0,
            'checklist' => [['title' => 'Open planner']],
        ]);

        $concurrent = $this->runConcurrentMaterializers();
        $created = array_column($concurrent, 'created');
        sort($created);
        self::assertSame([0, 1], $created);
        self::assertSame([[], []], array_column($concurrent, 'failed'));
        $retry = $this->runtime['task_series_service']->materialize();
        self::assertSame(0, $retry['created']);
        self::assertSame(1, (int) $this->pdo->query('SELECT COUNT(*) FROM tasks')->fetchColumn());
        self::assertSame(1, (int) $this->pdo->query('SELECT COUNT(*) FROM checklist_items')->fetchColumn());
        self::assertSame($series['id'], (string) $this->pdo->query('SELECT series_id FROM tasks')->fetchColumn());
    }

    public function test_series_pause_resume_and_end_archives_acknowledged_future_occurrences(): void
    {
        $today = $this->runtime['clock']->now()->setTimezone(new DateTimeZone('UTC'))->format('Y-m-d');
        $nextWeek = (new \DateTimeImmutable($today))->modify('+7 days')->format('Y-m-d');
        $series = $this->runtime['task_series_service']->create($this->owner, [
            'name' => 'Finite daily plan',
            'frequency' => 'daily',
            'interval_count' => 1,
            'weekdays' => [],
            'start_date' => $today,
            'end_date' => $nextWeek,
            'timezone' => 'UTC',
        ]);
        $this->runtime['task_series_service']->materialize();

        $paused = $this->runtime['task_series_service']->transition($this->owner, $series['id'], 'pause', [
            'base_version' => $series['version'],
        ]);
        self::assertSame('Paused', $paused['state']);
        $resumed = $this->runtime['task_series_service']->transition($this->owner, $series['id'], 'resume', [
            'base_version' => $paused['version'],
        ]);
        self::assertSame('Active', $resumed['state']);

        try {
            $this->runtime['task_series_service']->transition($this->owner, $series['id'], 'end', [
                'base_version' => $resumed['version'],
                'end_date' => $today,
                'archive_future' => false,
            ]);
            self::fail('Ending a series with future occurrences requires explicit acknowledgement.');
        } catch (\Planner\Http\ValidationException $exception) {
            self::assertArrayHasKey('archive_future', $exception->errors);
        }

        $ended = $this->runtime['task_series_service']->transition($this->owner, $series['id'], 'end', [
            'base_version' => $resumed['version'],
            'end_date' => $today,
            'archive_future' => true,
        ]);
        self::assertSame('Ended', $ended['state']);
        $activeFuture = $this->pdo->prepare(
            'SELECT COUNT(*) FROM tasks WHERE series_id = :series_id AND occurrence_date > :today AND archived_at IS NULL',
        );
        $activeFuture->execute(['series_id' => $series['id'], 'today' => $today]);
        self::assertSame(0, (int) $activeFuture->fetchColumn());
    }

    /** @return list<array{created:int,failed:list<string>}> */
    private function runConcurrentMaterializers(): array
    {
        $barrier = tempnam('/tmp', 'planner-recurrence-barrier-');
        if (! is_string($barrier)) {
            throw new RuntimeException('Unable to create recurrence concurrency barrier.');
        }
        unlink($barrier);
        $processes = [];

        try {
            for ($worker = 0; $worker < 2; $worker++) {
                $pipes = [];
                $process = proc_open([
                    PHP_BINARY,
                    dirname(__DIR__).'/Fixtures/recurrence-concurrency-worker.php',
                    $barrier,
                ], [
                    0 => ['pipe', 'r'],
                    1 => ['pipe', 'w'],
                    2 => ['pipe', 'w'],
                ], $pipes, dirname(__DIR__, 3));
                if (! is_resource($process)) {
                    throw new RuntimeException('Unable to start recurrence concurrency worker.');
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
                    throw new RuntimeException('Recurrence concurrency worker failed: '.(string) $stderr);
                }
                $result = json_decode($stdout, true, flags: JSON_THROW_ON_ERROR);
                if (! is_array($result) || ! is_int($result['created'] ?? null) || ! is_array($result['failed'] ?? null)) {
                    throw new RuntimeException('Recurrence concurrency worker returned invalid output.');
                }
                $results[] = $result;
            }

            return $results;
        } finally {
            if (is_file($barrier)) {
                unlink($barrier);
            }
        }
    }

    private function wipeTargetDatabase(): void
    {
        $tables = $this->pdo->query("SELECT table_name FROM information_schema.tables WHERE table_schema = 'goals_test' AND table_type = 'BASE TABLE'")->fetchAll(PDO::FETCH_COLUMN);
        $this->pdo->exec('SET FOREIGN_KEY_CHECKS = 0');
        try {
            foreach ($tables as $table) {
                if (!is_string($table) || preg_match('/^[a-z0-9_]+$/', $table) !== 1) throw new RuntimeException('Unsafe test table name.');
                $this->pdo->exec("DROP TABLE `$table`");
            }
        } finally {
            $this->pdo->exec('SET FOREIGN_KEY_CHECKS = 1');
        }
    }
}
