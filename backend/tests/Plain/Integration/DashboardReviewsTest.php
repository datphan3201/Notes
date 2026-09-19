<?php

declare(strict_types=1);

namespace Tests\Plain\Integration;

use PDO;
use PHPUnit\Framework\TestCase;
use Planner\Http\ValidationException;
use Planner\Infrastructure\Database\MigrationRunner;
use Planner\Infrastructure\Persistence\Pdo\Account\PdoAccountRepository;
use RuntimeException;

final class DashboardReviewsTest extends TestCase
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
        $this->owner = (new PdoAccountRepository($this->pdo))->insertUser('dashboard@example.test', 'Dashboard Owner', password_hash('correct horse battery staple', PASSWORD_BCRYPT), '2026-09-17 12:00:00.000000')->id;
    }

    protected function tearDown(): void { $this->runtime['session']->close(); session_id(''); $_SESSION = []; $_COOKIE = []; }

    public function test_activity_grid_uses_unreversed_completion_facts(): void
    {
        $planning = $this->runtime['planning_service'];
        $task = $planning->create('task', $this->owner, ['goal_id' => null, 'milestone_id' => null, 'name' => 'Finish']);
        $task = $planning->transition('task', $this->owner, $task['id'], 'complete', ['base_version' => $task['version']]);
        $month = $this->runtime['clock']->now()->format('Y-m');
        self::assertCount(1, $this->runtime['dashboard_service']->dashboard($this->owner, $month)['activity_days']);
        $planning->transition('task', $this->owner, $task['id'], 'reopen', ['base_version' => $task['version']]);
        self::assertSame([], $this->runtime['dashboard_service']->dashboard($this->owner, $month)['activity_days']);
    }

    public function test_weekly_selection_reorder_requires_exact_active_set(): void
    {
        $planning = $this->runtime['planning_service'];
        $one = $planning->create('task', $this->owner, ['goal_id' => null, 'milestone_id' => null, 'name' => 'One']);
        $two = $planning->create('task', $this->owner, ['goal_id' => null, 'milestone_id' => null, 'name' => 'Two']);
        $dashboard = $this->runtime['dashboard_service'];
        $dashboard->addSelection('task', $this->owner, ['id' => $one['id'], 'position' => 0]);
        $dashboard->addSelection('task', $this->owner, ['id' => $two['id'], 'position' => 1]);
        self::assertSame([$two['id'], $one['id']], array_column($dashboard->reorder('task', $this->owner, ['ids' => [$two['id'], $one['id']]]), 'id'));

        $this->expectException(ValidationException::class);
        $dashboard->reorder('task', $this->owner, ['ids' => [$one['id']]]);
    }

    public function test_finalized_review_snapshot_is_stable_until_reopened_and_refreshed(): void
    {
        $reviews = $this->runtime['review_service'];
        $today = $this->runtime['clock']->now()->format('Y-m-d');
        $review = $reviews->create($this->owner, ['kind' => 'Daily', 'date' => $today]);
        $review = $reviews->update($this->owner, $review['id'], ['base_version' => $review['version'], 'reflection' => 'Learned', 'went_well' => '', 'went_wrong' => '', 'change_next' => 'Continue']);
        $review = $reviews->transition($this->owner, $review['id'], 'finalize', ['base_version' => $review['version']]);
        $snapshot = $review['snapshot'];
        try {
            $reviews->transition($this->owner, $review['id'], 'refresh', ['base_version' => $review['version']]);
            self::fail('Finalized review must not refresh.');
        } catch (ValidationException) {
            self::assertSame($snapshot, $reviews->show($this->owner, $review['id'])['snapshot']);
        }
        $review = $reviews->transition($this->owner, $review['id'], 'reopen', ['base_version' => $review['version']]);
        self::assertSame($snapshot, $review['snapshot']);
        self::assertSame('Learned', $review['reflection']);
    }

    public function test_goal_snapshot_capture_is_idempotent(): void
    {
        $area = $this->runtime['planning_service']->create('area', $this->owner, ['name' => 'Area']);
        $this->runtime['planning_service']->create('goal', $this->owner, ['area_id' => $area['id'], 'parent_goal_id' => null, 'name' => 'Goal']);
        self::assertSame(1, $this->runtime['goal_snapshot_service']->capture()['created']);
        self::assertSame(0, $this->runtime['goal_snapshot_service']->capture()['created']);
    }

    public function test_dashboard_shows_only_goal_related_habits_with_period_specific_counts(): void
    {
        $planning = $this->runtime['planning_service'];
        $area = $planning->create('area', $this->owner, ['name' => 'Health']);
        $goal = $planning->create('goal', $this->owner, [
            'area_id' => $area['id'],
            'parent_goal_id' => null,
            'name' => 'Feel healthier',
        ]);
        $habits = $this->runtime['habit_service'];
        $daily = $habits->create($this->owner, [
            'primary_goal_id' => $goal['id'],
            'name' => 'Walk',
            'period' => 'daily',
            'target_frequency' => 1,
            'timezone' => 'UTC',
        ]);
        $weekly = $habits->create($this->owner, [
            'name' => 'Strength training',
            'period' => 'weekly',
            'target_frequency' => 3,
            'timezone' => 'UTC',
        ]);
        $weekly = $habits->addContribution($this->owner, $weekly['id'], [
            'goal_id' => $goal['id'],
            'base_version' => $weekly['version'],
        ]);
        $habits->create($this->owner, [
            'name' => 'Unrelated habit',
            'period' => 'daily',
            'target_frequency' => 1,
            'timezone' => 'UTC',
        ]);
        $today = $this->runtime['clock']->now()->format('Y-m-d');
        $weekStart = $this->runtime['clock']->now()->modify('monday this week')->format('Y-m-d');
        $secondWeekday = $this->runtime['clock']->now()->modify('tuesday this week')->format('Y-m-d');
        $habits->checkIn($this->owner, $daily['id'], $weekStart);
        $habits->checkIn($this->owner, $daily['id'], $today);
        $habits->checkIn($this->owner, $weekly['id'], $weekStart);
        $habits->checkIn($this->owner, $weekly['id'], $secondWeekday);

        $dashboard = $this->runtime['dashboard_service']->dashboard($this->owner, null);
        $byName = array_column($dashboard['habits'], null, 'name');
        $names = array_keys($byName);
        sort($names);

        self::assertSame(['Strength training', 'Walk'], $names);
        self::assertSame(1, $byName['Walk']['completed_days']);
        self::assertSame(2, $byName['Strength training']['completed_days']);
        self::assertSame(3, $byName['Strength training']['target_frequency']);
    }

    private function wipeTargetDatabase(): void
    {
        $tables = $this->pdo->query("SELECT table_name FROM information_schema.tables WHERE table_schema = 'goals_test' AND table_type = 'BASE TABLE'")->fetchAll(PDO::FETCH_COLUMN);
        $this->pdo->exec('SET FOREIGN_KEY_CHECKS = 0');
        try { foreach ($tables as $table) { if (!is_string($table) || preg_match('/^[a-z0-9_]+$/', $table) !== 1) throw new RuntimeException('Unsafe test table name.'); $this->pdo->exec("DROP TABLE `$table`"); } }
        finally { $this->pdo->exec('SET FOREIGN_KEY_CHECKS = 1'); }
    }
}
