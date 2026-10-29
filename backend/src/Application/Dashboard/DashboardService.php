<?php

declare(strict_types=1);

namespace Planner\Application\Dashboard;

use DateTimeImmutable;
use DateTimeZone;
use Planner\Http\HttpException;
use Planner\Http\ValidationException;
use Planner\Application\Habits\HabitProgress;
use Planner\Domain\Habits\HabitStreak;
use Planner\Infrastructure\Persistence\Pdo\Habits\PdoHabitRepository;
use Planner\Infrastructure\Database\TransactionManager;
use Planner\Infrastructure\Persistence\Pdo\Dashboard\PdoDashboardRepository;
use Planner\Infrastructure\Persistence\Pdo\Planning\PdoPlanningRepository;
use Planner\Support\Clock;
use Planner\Support\Timestamp;

final readonly class DashboardService
{
    public function __construct(
        private PdoDashboardRepository $dashboard,
        private PdoPlanningRepository $planning,
        private TransactionManager $transactions,
        private Clock $clock,
        private PdoHabitRepository $habits,
        private HabitProgress $progress,
    ) {
    }

    /**
     * A whole local calendar year of completion counts, plus the years the
     * year list can offer (first activity or account year through this year).
     *
     * @return array<string, mixed>
     */
    public function yearActivity(int $userId, mixed $year): array
    {
        $timezone = $this->planning->ownerTimezone($userId);
        $now = $this->clock->now()->setTimezone(new DateTimeZone($timezone));
        $currentYear = (int) $now->format('Y');
        $year ??= (string) $currentYear;
        if (! is_string($year) || preg_match('/^\d{4}$/D', $year) !== 1 || (int) $year > $currentYear || (int) $year < 2000) {
            throw new ValidationException(['year' => ['The year is invalid.']]);
        }
        $days = [];
        $total = 0;
        foreach ($this->dashboard->activity($userId, $year.'-01-01', $year.'-12-31') as $row) {
            $date = (string) $row['effective_date'];
            $days[$date] ??= ['date' => $date, 'total' => 0, 'counts' => []];
            $days[$date]['counts'][(string) $row['source_type']] = (int) $row['count'];
            $days[$date]['total'] += (int) $row['count'];
            $total += (int) $row['count'];
        }
        // The list always contains the requested year, so stepping back with the arrows keeps it selectable.
        $firstYear = min($currentYear, (int) $year, $this->dashboard->firstActivityYear($userId) ?? $currentYear);

        return [
            'year' => (int) $year,
            'timezone' => $timezone,
            'today' => $now->format('Y-m-d'),
            'years' => range($currentYear, $firstYear),
            'total' => $total,
            'active_days' => count($days),
            'days' => array_values($days),
        ];
    }

    /** @return array<string, mixed> */
    public function dashboard(int $userId, ?string $month): array
    {
        $timezone = $this->planning->ownerTimezone($userId);
        $zone = new DateTimeZone($timezone);
        $now = $this->clock->now()->setTimezone($zone);
        $month ??= $now->format('Y-m');
        if (preg_match('/^\d{4}-(?:0[1-9]|1[0-2])$/D', $month) !== 1) {
            throw new ValidationException(['month' => ['The month is invalid.']]);
        }
        $monthStart = new DateTimeImmutable($month.'-01', $zone);
        $monthEnd = $monthStart->modify('last day of this month');
        $today = $now->format('Y-m-d');
        $dayStart = new DateTimeImmutable($today.' 00:00:00', $zone);
        $dayEnd = $dayStart->modify('+1 day');
        $weekStart = $now->modify('monday this week')->format('Y-m-d');
        $weekEnd = (new DateTimeImmutable($weekStart, $zone))->modify('+6 days')->format('Y-m-d');
        $activity = [];
        foreach ($this->dashboard->activity($userId, $monthStart->format('Y-m-d'), $monthEnd->format('Y-m-d')) as $row) {
            $date = (string) $row['effective_date'];
            $activity[$date] ??= ['date' => $date, 'active' => true, 'total' => 0, 'counts' => []];
            $activity[$date]['counts'][(string) $row['source_type']] = (int) $row['count'];
            $activity[$date]['total'] += (int) $row['count'];
        }

        $selected = $this->serializeRows($this->dashboard->selections('task', $userId, $weekStart));
        $previousWeek = (new DateTimeImmutable($weekStart, $zone))->modify('-7 days')->format('Y-m-d');
        $previousSelected = $this->dashboard->selections('task', $userId, $previousWeek);
        $completed = count(array_filter($selected, static fn (array $task): bool => $task['status'] === 'Done'));
        $percentage = count($selected) === 0 ? null : round($completed / count($selected) * 100, 1);
        $previousCompleted = count(array_filter($previousSelected, static fn (array $task): bool => $task['status'] === 'Done'));
        $previousPercentage = count($previousSelected) === 0 ? null : round($previousCompleted / count($previousSelected) * 100, 1);
        $weekActivity = $this->dashboard->activity($userId, $weekStart, $weekEnd);
        $daily = [];
        foreach ($weekActivity as $row) {
            $date = (string) $row['effective_date'];
            $daily[$date] = ($daily[$date] ?? 0) + (int) $row['count'];
        }
        [$habits, $dailyHabits] = $this->habitProgress($userId);
        $streak = (new HabitStreak)->overall($dailyHabits, $today);
        $trackingSince = $dailyHabits === [] ? null : min(array_column($dailyHabits, 'since'));

        return [
            'timezone' => $timezone, 'month' => $month, 'today' => $today,
            'activity_days' => array_values($activity),
            'today_tasks' => $this->serializeRows($this->dashboard->todayTasks($userId, $today, Timestamp::database($dayStart), Timestamp::database($dayEnd))),
            'overdue_tasks' => $this->serializeRows($this->dashboard->overdueTasks($userId, $today)),
            'week_start' => $weekStart,
            'selected_tasks' => $selected,
            'week_summary' => ['total' => count($selected), 'completed' => $completed, 'percentage' => $percentage,
                'previous_percentage' => $previousPercentage,
                'change_points' => $percentage === null || $previousPercentage === null ? null : round($percentage - $previousPercentage, 1),
                'daily_activity' => $daily],
            'habit_streak' => [...$streak, 'tracking_since' => $trackingSince],
            'selected_milestones' => $this->serializeRows($this->dashboard->selections('milestone', $userId, $weekStart)),
            'habits' => $habits,
        ];
    }

    /**
     * Every active Habit with its own streak and current-period count, plus
     * the daily Habits' facts for the combined streak.
     *
     * @return array{0: list<array<string, mixed>>, 1: list<array{since:string,done:array<string,true>,rest:array<string,true>}>}
     */
    private function habitProgress(int $userId): array
    {
        $days = $this->habits->days($userId);
        $rows = [];
        $daily = [];
        foreach ($this->habits->list($userId) as $habit) {
            $id = (string) $habit['id'];
            $done = $days['done'][$id] ?? [];
            $rest = $days['rest'][$id] ?? [];
            $progress = $this->progress->describe($userId, $habit, $days);
            $today = $progress['today'];
            $from = $habit['period'] === 'weekly' ? HabitStreak::monday($today) : $today;
            $rows[] = [
                'id' => $id,
                'name' => (string) $habit['name'],
                'period' => (string) $habit['period'],
                'target_frequency' => (int) $habit['target_frequency'],
                'primary_goal_id' => $habit['primary_goal_id'] === null ? null : (string) $habit['primary_goal_id'],
                'completed_days' => count(array_filter(array_keys($done), static fn (int|string $date): bool => (string) $date >= $from && (string) $date <= $today)),
                'done_today' => isset($done[$today]),
                'rest_today' => isset($rest[$today]),
                'streak' => $progress['streak'],
            ];
            if ($habit['period'] === 'daily') {
                $daily[] = ['since' => $progress['since'], 'done' => $done, 'rest' => $rest];
            }
        }

        return [$rows, $daily];
    }

    /** @return list<array<string, mixed>> */
    public function selections(string $type, int $userId): array
    {
        $this->assertType($type);
        return $this->serializeRows($this->dashboard->selections($type, $userId, $this->weekStart($userId)));
    }

    /** @return list<array<string, mixed>> */
    public function addSelection(string $type, int $userId, array $input): array
    {
        $this->assertType($type);
        $this->keys($input, ['id', 'position']);
        $id = $this->uuid($input['id'] ?? null);
        $position = $input['position'] ?? 0;
        if (!is_int($position) || $position < 0) throw new ValidationException(['position' => ['The position is invalid.']]);
        $week = $this->weekStart($userId);
        $this->transactions->run(function () use ($type, $userId, $id, $position, $week): void {
            $this->planning->lockOwner($userId);
            if ($this->planning->find($type, $userId, $id, true) === null) throw new HttpException(404, 'NOT_FOUND', 'The requested resource was not found.');
            if (!$this->dashboard->selectionExists($type, $userId, $week, $id)) $this->dashboard->addSelection($type, $userId, $week, $id, $position, Timestamp::database($this->clock->now()));
        });
        return $this->selections($type, $userId);
    }

    public function removeSelection(string $type, int $userId, string $id): void
    {
        $this->assertType($type);
        $this->transactions->run(function () use ($type, $userId, $id): void {
            $this->planning->lockOwner($userId);
            $this->dashboard->removeSelection($type, $userId, $this->weekStart($userId), $id);
        });
    }

    /** @return list<array<string, mixed>> */
    public function reorder(string $type, int $userId, array $input): array
    {
        $this->assertType($type);
        $this->keys($input, ['ids']);
        if (!is_array($input['ids'] ?? null) || !array_is_list($input['ids'])) throw new ValidationException(['ids' => ['The ordering is invalid.']]);
        $ids = array_map(fn (mixed $id): string => $this->uuid($id), $input['ids']);
        $current = array_map(static fn (array $row): string => (string) $row['id'], $this->selections($type, $userId));
        $expected = $current;
        $provided = $ids;
        sort($expected);
        sort($provided);
        if ($expected !== $provided || count($ids) !== count(array_unique($ids))) throw new ValidationException(['ids' => ['Provide exactly the active selection set.']]);
        $this->transactions->run(function () use ($type, $userId, $ids): void {
            $this->planning->lockOwner($userId);
            $this->dashboard->reorderSelections($type, $userId, $this->weekStart($userId), $ids);
        });
        return $this->selections($type, $userId);
    }

    private function weekStart(int $userId): string
    {
        return $this->clock->now()->setTimezone(new DateTimeZone($this->planning->ownerTimezone($userId)))->modify('monday this week')->format('Y-m-d');
    }
    private function assertType(string $type): void
    {
        if (!in_array($type, ['task', 'milestone'], true)) throw new HttpException(404, 'NOT_FOUND', 'The selection type was not found.');
    }
    private function uuid(mixed $value): string
    {
        if (!is_string($value) || preg_match('/^[0-9a-f-]{36}$/D', $value) !== 1) throw new ValidationException(['id' => ['The UUID is invalid.']]);
        return $value;
    }
    private function keys(array $input, array $allowed): void
    {
        if (array_diff(array_keys($input), $allowed) !== []) throw new ValidationException(['_unknown' => ['The request contains an unsupported field.']]);
    }
    private function serializeRows(array $rows): array
    {
        return array_map(function (array $row): array {
            unset($row['user_id']);
            foreach (['version', 'position', 'importance', 'selection_position', 'estimated_minutes'] as $field) if (isset($row[$field])) $row[$field] = (int) $row[$field];
            foreach (['scheduled_start', 'scheduled_end'] as $field) if (array_key_exists($field, $row)) $row[$field] = Timestamp::api($row[$field] === null ? null : (string) $row[$field]);
            return $row;
        }, $rows);
    }
}
