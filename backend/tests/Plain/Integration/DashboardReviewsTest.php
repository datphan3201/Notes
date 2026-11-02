<?php

declare(strict_types=1);

namespace Tests\Plain\Integration;

use DateTimeImmutable;
use PDO;
use PHPUnit\Framework\TestCase;
use Planner\Application\Dashboard\DashboardService;
use Planner\Application\Habits\HabitProgress;
use Planner\Application\Habits\HabitService;
use Planner\Http\ValidationException;
use Planner\Infrastructure\Database\MigrationRunner;
use Planner\Infrastructure\Persistence\Pdo\Account\PdoAccountRepository;
use Planner\Infrastructure\Persistence\Pdo\Dashboard\PdoDashboardRepository;
use Planner\Support\Clock;
use RuntimeException;

final class DashboardReviewsTest extends TestCase
{
    private array $runtime;
    private PDO $pdo;
    private int $owner;

    protected function setUp(): void
    {
        if (session_status() === PHP_SESSION_ACTIVE) session_write_close();
        session_id('');
        $_SESSION = [];
        $_COOKIE = [];
        $this->runtime = require dirname(__DIR__, 3).'/bootstrap/http.php';
        $this->pdo = $this->runtime['pdo'];
        self::assertSame('goals_test', $this->pdo->query('SELECT DATABASE()')->fetchColumn());
        $this->wipeTargetDatabase();
        (new MigrationRunner($this->pdo, dirname(__DIR__, 3).'/database/plain-migrations', 'goals_test'))->migrate();
        $this->owner = (new PdoAccountRepository($this->pdo))->insertUser('dashboard@example.test', 'Dashboard Owner', password_hash('correct horse battery staple', PASSWORD_BCRYPT), '2026-09-17 12:00:00.000000')->id;
    }

    protected function tearDown(): void
    {
        $this->runtime['session']->close();
        session_id('');
        $_SESSION = [];
        $_COOKIE = [];
    }

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

    public function test_dashboard_shows_every_habit_with_period_specific_counts_and_streaks(): void
    {
        // Wednesday provides two distinct non-future weekdays regardless of the
        // host date. Keep both Habit validation and Dashboard projection on it.
        $clock = new class implements Clock {
            public function now(): DateTimeImmutable
            {
                return new DateTimeImmutable('2026-10-28T12:00:00Z');
            }
        };
        $progress = new HabitProgress($this->runtime['habit_repository'], $clock);
        $habits = new HabitService(
            $this->runtime['habit_repository'], $this->runtime['planning_repository'],
            $this->runtime['activity_repository'], $this->runtime['transactions'],
            $this->runtime['uuid'], $clock, $progress,
        );
        $dashboardService = new DashboardService(
            new PdoDashboardRepository($this->pdo), $this->runtime['planning_repository'],
            $this->runtime['transactions'], $clock, $this->runtime['habit_repository'], $progress, $this->runtime['planning_service'],
        );
        $planning = $this->runtime['planning_service'];
        $area = $planning->create('area', $this->owner, ['name' => 'Health']);
        $goal = $planning->create('goal', $this->owner, [
            'area_id' => $area['id'],
            'parent_goal_id' => null,
            'name' => 'Feel healthier',
        ]);
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
        $today = $clock->now()->format('Y-m-d');
        $weekStart = $clock->now()->modify('monday this week')->format('Y-m-d');
        $secondWeekday = $clock->now()->modify('tuesday this week')->format('Y-m-d');
        $habits->checkIn($this->owner, $daily['id'], $weekStart);
        $habits->checkIn($this->owner, $daily['id'], $today);
        $habits->checkIn($this->owner, $weekly['id'], $weekStart);
        $habits->checkIn($this->owner, $weekly['id'], $secondWeekday);

        $dashboard = $dashboardService->dashboard($this->owner, null);
        $byName = array_column($dashboard['habits'], null, 'name');
        $names = array_keys($byName);
        sort($names);

        // Every active Habit is listed, linked to a Goal or not.
        self::assertSame(['Strength training', 'Unrelated habit', 'Walk'], $names);
        // Monday and Wednesday check-ins are separated by an unfinished day.
        self::assertSame(['count' => 1, 'unit' => 'days', 'through_date' => $today], $byName['Walk']['streak']);
        self::assertTrue($byName['Walk']['done_today']);
        self::assertSame(1, $byName['Walk']['completed_days']);
        self::assertSame(2, $byName['Strength training']['completed_days']);
        self::assertSame(3, $byName['Strength training']['target_frequency']);
    }

    public function test_dashboard_streak_deduplicates_habits_respects_owner_and_recalculates_after_undo(): void
    {
        $habits=$this->runtime['habit_service'];
        $first=$habits->create($this->owner,['name'=>'Read','period'=>'daily','target_frequency'=>1,'timezone'=>'UTC']);
        $second=$habits->create($this->owner,['name'=>'Walk','period'=>'daily','target_frequency'=>1,'timezone'=>'UTC']);
        $today=$this->runtime['clock']->now();
        for($offset=0;$offset<4;$offset++) $habits->checkIn($this->owner,$first['id'],$today->modify("-$offset days")->format('Y-m-d'));
        $habits->checkIn($this->owner,$second['id'],$today->format('Y-m-d'));
        $dashboard=$this->runtime['dashboard_service'];
        self::assertSame(4,$dashboard->dashboard($this->owner,null)['habit_streak']['days']);
        $current=$dashboard->dashboard($this->owner,null);
        // Tracking starts at the earliest back-dated check-in.
        self::assertSame($today->modify('-3 days')->format('Y-m-d'),$current['habit_streak']['tracking_since']);
        $habits->undoCheckIn($this->owner,$first['id'],$today->modify('-1 day')->format('Y-m-d'));
        self::assertSame(1,$dashboard->dashboard($this->owner,null)['habit_streak']['days']);
        // Read is now unfinished today and missed yesterday, so no day is complete.
        $habits->undoCheckIn($this->owner,$first['id'],$today->format('Y-m-d'));
        self::assertSame(0,$dashboard->dashboard($this->owner,null)['habit_streak']['days']);
        $habits->undoCheckIn($this->owner,$second['id'],$today->format('Y-m-d'));
        self::assertSame(0,$dashboard->dashboard($this->owner,null)['habit_streak']['days']);
        $other=(new PdoAccountRepository($this->pdo))->insertUser('streak-other@example.test','Other',password_hash('password',PASSWORD_BCRYPT),'2026-09-17 12:00:00.000000')->id;
        self::assertSame(0,$dashboard->dashboard($other,null)['habit_streak']['days']);
        self::assertNull($dashboard->dashboard($other,null)['habit_streak']['tracking_since']);
    }

    public function test_week_and_review_completion_use_real_denominators_and_saved_snapshots(): void
    {
        $planning=$this->runtime['planning_service'];
        $dashboard=$this->runtime['dashboard_service'];
        $reviews=$this->runtime['review_service'];
        $today=$this->runtime['clock']->now()->format('Y-m-d');
        self::assertNull($dashboard->dashboard($this->owner,null)['week_summary']['percentage']);
        $one=$planning->create('task',$this->owner,['name'=>'One','deadline'=>$today]);
        $two=$planning->create('task',$this->owner,['name'=>'Two']);
        foreach([$one,$two] as $task)$dashboard->addSelection('task',$this->owner,['id'=>$task['id']]);
        $one=$planning->transition('task',$this->owner,$one['id'],'complete',['base_version'=>$one['version']]);
        $summary=$dashboard->dashboard($this->owner,null)['week_summary'];
        self::assertSame(2,$summary['total']);
        self::assertSame(1,$summary['completed']);
        self::assertSame(50.0,$summary['percentage']);
        $review=$reviews->create($this->owner,['kind'=>'Weekly','date'=>$today]);
        self::assertSame(['total'=>2,'completed'=>1],$review['snapshot']['task_summary']);
        $snapshot=$review['snapshot'];
        $planning->transition('task',$this->owner,$two['id'],'complete',['base_version'=>$two['version']]);
        self::assertSame($snapshot,$reviews->show($this->owner,$review['id'])['snapshot']);
        $refreshed=$reviews->transition($this->owner,$review['id'],'refresh',['base_version'=>$review['version']]);
        self::assertSame(['total'=>2,'completed'=>2],$refreshed['snapshot']['task_summary']);
    }

    public function test_today_projection_includes_planned_starts_and_overlapping_schedules(): void
    {
        $today=$this->runtime['clock']->now()->format('Y-m-d');
        $yesterday=$this->runtime['clock']->now()->modify('-1 day')->format('Y-m-d');
        $planning=$this->runtime['planning_service'];
        $start=$planning->create('task',$this->owner,['name'=>'Start today','start_date'=>$today]);
        $span=$planning->create('task',$this->owner,['name'=>'Cross midnight','scheduled_start'=>$yesterday.'T23:00:00.000000Z','scheduled_end'=>$today.'T01:00:00.000000Z']);
        $planning->create('task',$this->owner,['name'=>'Old interval','scheduled_start'=>$yesterday.'T01:00:00.000000Z','scheduled_end'=>$yesterday.'T02:00:00.000000Z']);
        $ids=array_column($this->runtime['dashboard_service']->dashboard($this->owner,null)['today_tasks'],'id');
        self::assertCount(2,$ids);
        self::assertContains($start['id'],$ids);
        self::assertContains($span['id'],$ids);
    }

    public function test_daily_selection_is_idempotent_and_adds_week_without_changing_task_fields(): void
    {
        $planning = $this->runtime['planning_service'];
        $task = $planning->create('task', $this->owner, [
            'name' => 'Plan independently', 'deadline' => '2027-02-20',
            'start_date' => '2027-02-01', 'scheduled_start' => '2027-02-02T09:00:00Z',
            'scheduled_end' => '2027-02-02T10:00:00Z',
        ]);
        $dashboard = $this->runtime['dashboard_service'];
        $selected = $dashboard->addDailySelection($this->owner, ['id' => $task['id']]);
        self::assertSame([$task['id']], array_column($selected, 'id'));
        self::assertSame($selected, $dashboard->addDailySelection($this->owner, ['id' => $task['id']]));
        self::assertSame([$task['id']], array_column($dashboard->selections('task', $this->owner), 'id'));
        self::assertSame($task, $planning->show('task', $this->owner, $task['id']));
        self::assertSame(0, (int) $this->pdo->query('SELECT COUNT(*) FROM activities')->fetchColumn());
        self::assertSame(1, (int) $this->pdo->query('SELECT COUNT(*) FROM daily_task_selections')->fetchColumn());
        $dashboard->removeDailySelection($this->owner, $task['id']);
        $dashboard->removeDailySelection($this->owner, $task['id']);
        self::assertSame([], $dashboard->dailySelections($this->owner));
        self::assertSame([$task['id']], array_column($dashboard->selections('task', $this->owner), 'id'));
    }

    public function test_daily_selection_uses_owner_date_and_does_not_carry_into_tomorrow(): void
    {
        $this->pdo->prepare("INSERT INTO user_preferences (user_id, timezone, created_at, updated_at) VALUES (:user, 'America/Los_Angeles', '2026-11-02 00:00:00.000000', '2026-11-02 00:00:00.000000') ON DUPLICATE KEY UPDATE timezone = 'America/Los_Angeles'")->execute(['user' => $this->owner]);
        $clock = new class implements Clock {
            public DateTimeImmutable $instant;

            public function __construct()
            {
                $this->instant = new DateTimeImmutable('2026-11-02T01:00:00Z');
            }

            public function now(): DateTimeImmutable
            {
                return $this->instant;
            }
        };
        $dashboard = new DashboardService(
            new PdoDashboardRepository($this->pdo), $this->runtime['planning_repository'],
            $this->runtime['transactions'], $clock, $this->runtime['habit_repository'],
            new HabitProgress($this->runtime['habit_repository'], $clock), $this->runtime['planning_service'],
        );
        $task = $this->runtime['planning_service']->create('task', $this->owner, ['name' => 'Sunday locally']);
        $dashboard->addDailySelection($this->owner, ['id' => $task['id']]);
        self::assertSame('2026-11-01', $this->pdo->query('SELECT local_date FROM daily_task_selections')->fetchColumn());
        self::assertSame('2026-10-26', $this->pdo->query('SELECT week_start FROM weekly_task_selections')->fetchColumn());
        $clock->instant = new DateTimeImmutable('2026-11-02T09:00:00Z');
        self::assertSame([], $dashboard->dailySelections($this->owner));
        self::assertSame([], $dashboard->selections('task', $this->owner));
        self::assertSame(1, (int) $this->pdo->query('SELECT COUNT(*) FROM daily_task_selections')->fetchColumn());
    }

    public function test_today_checklist_keeps_completed_selections_and_silences_historical_overdue_reminders(): void
    {
        $planning = $this->runtime['planning_service'];
        $dashboard = $this->runtime['dashboard_service'];
        $now = $this->runtime['clock']->now();
        $today = $now->format('Y-m-d');
        $recent = $planning->create('task', $this->owner, ['name' => 'Recent overdue', 'deadline' => $now->modify('-1 day')->format('Y-m-d')]);
        $old = $planning->create('task', $this->owner, ['name' => 'Historical overdue', 'deadline' => $now->modify('-3 days')->format('Y-m-d')]);
        $due = $planning->create('task', $this->owner, ['name' => 'Due today', 'deadline' => $today]);
        $manual = $planning->create('task', $this->owner, ['name' => 'Manually planned']);
        $dashboard->addDailySelection($this->owner, ['id' => $manual['id']]);
        $data = $dashboard->dashboard($this->owner, null);
        self::assertSame([$recent['id']], array_column($data['overdue_tasks'], 'id'));
        $ids = array_column($data['today_tasks'], 'id');
        self::assertContains($recent['id'], $ids);
        self::assertContains($due['id'], $ids);
        self::assertContains($manual['id'], $ids);
        self::assertNotContains($old['id'], $ids);
        $done = $planning->transition('task', $this->owner, $manual['id'], 'complete', ['base_version' => $manual['version']]);
        $data = $dashboard->dashboard($this->owner, null);
        self::assertSame('Done', array_column($data['today_tasks'], null, 'id')[$manual['id']]['status']);
        self::assertSame('Done', $data['selected_tasks'][0]['status']);
        self::assertSame(1, $data['week_summary']['completed']);
        $planning->transition('task', $this->owner, $manual['id'], 'reopen', ['base_version' => $done['version']]);
        self::assertSame(0, $dashboard->dashboard($this->owner, null)['week_summary']['completed']);
        $planning->transition('task', $this->owner, $recent['id'], 'complete', ['base_version' => $recent['version']]);
        self::assertSame([], $dashboard->dashboard($this->owner, null)['overdue_tasks']);
    }

    public function test_reopening_overdue_work_requires_a_new_or_removed_deadline_atomically(): void
    {
        $planning = $this->runtime['planning_service'];
        $now = $this->runtime['clock']->now();
        $task = $planning->create('task', $this->owner, ['name' => 'Replan old work', 'deadline' => $now->modify('-4 days')->format('Y-m-d')]);
        try {
            $planning->transition('task', $this->owner, $task['id'], 'reopen', ['base_version' => $task['version']]);
            self::fail('An old deadline requires an explicit decision.');
        } catch (\Planner\Http\HttpException $error) {
            self::assertSame('REOPEN_DEADLINE_REQUIRED', $error->errorCode);
        }
        self::assertSame($task, $planning->show('task', $this->owner, $task['id']));
        try {
            $planning->transition('task', $this->owner, $task['id'], 'reopen', ['base_version' => $task['version'], 'deadline' => $now->modify('-1 day')->format('Y-m-d')]);
            self::fail('A new deadline cannot already be overdue.');
        } catch (ValidationException $error) {
            self::assertArrayHasKey('deadline', $error->errors);
        }
        $reopened = $planning->transition('task', $this->owner, $task['id'], 'reopen', ['base_version' => $task['version'], 'deadline' => null]);
        self::assertNull($reopened['deadline']);
        self::assertSame('InProgress', $reopened['status']);
        self::assertSame([], $this->runtime['dashboard_service']->dashboard($this->owner, null)['overdue_tasks']);
        self::assertSame(0, (int) $this->pdo->query('SELECT COUNT(*) FROM activities')->fetchColumn());
        $completed = $planning->transition('task', $this->owner, $task['id'], 'complete', ['base_version' => $reopened['version']]);
        $updated = $planning->update('task', $this->owner, $task['id'], ['base_version' => $completed['version'], 'deadline' => $now->modify('-1 day')->format('Y-m-d')]);
        $newDate = $now->modify('+2 days')->format('Y-m-d');
        $reopened = $planning->transition('task', $this->owner, $task['id'], 'reopen', ['base_version' => $updated['version'], 'deadline' => $newDate]);
        self::assertSame($newDate, $reopened['deadline']);
        self::assertSame(1, (int) $this->pdo->query("SELECT COUNT(*) FROM activities WHERE action = 'reversed'")->fetchColumn());
    }

    public function test_completed_history_cutoff_uses_elapsed_hours_across_daylight_saving_change(): void
    {
        $this->pdo->prepare("UPDATE user_preferences SET timezone = 'America/Los_Angeles' WHERE user_id = :user")->execute(['user' => $this->owner]);
        $clock = new class implements Clock {
            public function now(): DateTimeImmutable
            {
                return new DateTimeImmutable('2026-11-02T08:30:00Z');
            }
        };
        $task = $this->runtime['planning_service']->create('task', $this->owner, ['name' => 'Completed before DST boundary', 'start_date' => '2026-11-02']);
        $this->pdo->prepare("UPDATE tasks SET status = 'Done', completed_at = '2026-11-01 08:00:00.000000' WHERE user_id = :user AND id = :id")->execute(['user' => $this->owner, 'id' => $task['id']]);
        $dashboard = new DashboardService(
            new PdoDashboardRepository($this->pdo), $this->runtime['planning_repository'],
            $this->runtime['transactions'], $clock, $this->runtime['habit_repository'],
            new HabitProgress($this->runtime['habit_repository'], $clock), $this->runtime['planning_service'],
        );
        self::assertSame([], $dashboard->dashboard($this->owner, null)['today_tasks']);
    }

    public function test_today_summary_tracks_the_complete_membership_including_checked_tasks(): void
    {
        $dashboard = $this->runtime['dashboard_service'];
        $planning = $this->runtime['planning_service'];
        self::assertSame(['total' => 0, 'completed' => 0, 'percentage' => null], $dashboard->dashboard($this->owner, null)['today_summary']);
        $tasks = [];
        foreach (['First', 'Second', 'Third'] as $name) {
            $tasks[] = $planning->create('task', $this->owner, ['name' => $name]);
            $dashboard->addDailySelection($this->owner, ['id' => $tasks[array_key_last($tasks)]['id']]);
        }
        $done = $planning->transition('task', $this->owner, $tasks[0]['id'], 'complete', ['base_version' => $tasks[0]['version']]);
        $data = $dashboard->dashboard($this->owner, null);
        self::assertSame(['total' => 3, 'completed' => 1, 'percentage' => 33.3], $data['today_summary']);
        self::assertCount(3, $data['today_tasks']);
        self::assertSame(33.3, $data['week_summary']['percentage']);
        $planning->transition('task', $this->owner, $tasks[1]['id'], 'complete', ['base_version' => $tasks[1]['version']]);
        self::assertSame(66.7, $dashboard->dashboard($this->owner, null)['today_summary']['percentage']);
        $planning->transition('task', $this->owner, $tasks[0]['id'], 'reopen', ['base_version' => $done['version']]);
        self::assertSame(33.3, $dashboard->dashboard($this->owner, null)['today_summary']['percentage']);
    }

    public function test_recent_activity_spans_thirty_local_dates_across_years_and_excludes_reversals(): void
    {
        $clock = new class implements Clock {
            public function now(): DateTimeImmutable
            {
                return new DateTimeImmutable('2026-01-01T12:00:00Z');
            }
        };
        $dashboard = new DashboardService(
            new PdoDashboardRepository($this->pdo), $this->runtime['planning_repository'],
            $this->runtime['transactions'], $clock, $this->runtime['habit_repository'],
            new HabitProgress($this->runtime['habit_repository'], $clock), $this->runtime['planning_service'],
        );
        $activity = $this->runtime['activity_repository'];
        foreach (['2025-12-02', '2025-12-03', '2025-12-31', '2026-01-01', '2026-01-02'] as $date) {
            $task = $this->runtime['planning_service']->create('task', $this->owner, ['name' => 'Fact '.$date]);
            $factId = $this->runtime['uuid']->generate();
            $activity->insert($factId, $this->owner, 'task', $task['id'], 1, 'completed', $date.' 12:00:00.000000', $date, 'UTC');
            if ($date === '2025-12-31') {
                $activity->insert($this->runtime['uuid']->generate(), $this->owner, 'task', $task['id'], 2, 'reversed', '2026-01-01 12:00:00.000000', '2026-01-01', 'UTC', $factId);
            }
        }
        $data = $dashboard->dashboard($this->owner, '2025-11');
        self::assertSame('2025-12-03', $data['recent_activity']['from']);
        self::assertSame('2026-01-01', $data['recent_activity']['to']);
        self::assertSame(2, $data['recent_activity']['total']);
        self::assertSame(2, $data['recent_activity']['active_days']);
        self::assertSame(['2025-12-03', '2026-01-01'], array_column($data['recent_activity']['days'], 'date'));
        self::assertSame([], $data['activity_days']);
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
