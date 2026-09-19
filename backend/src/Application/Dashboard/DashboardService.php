<?php

declare(strict_types=1);

namespace Planner\Application\Dashboard;

use DateTimeImmutable;
use DateTimeZone;
use Planner\Http\HttpException;
use Planner\Http\ValidationException;
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
    ) {}

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

        return [
            'timezone' => $timezone, 'month' => $month, 'today' => $today,
            'activity_days' => array_values($activity),
            'today_tasks' => $this->serializeRows($this->dashboard->todayTasks($userId, $today, Timestamp::database($dayStart), Timestamp::database($dayEnd))),
            'overdue_tasks' => $this->serializeRows($this->dashboard->overdueTasks($userId, $today)),
            'week_start' => $weekStart,
            'selected_tasks' => $this->serializeRows($this->dashboard->selections('task', $userId, $weekStart)),
            'selected_milestones' => $this->serializeRows($this->dashboard->selections('milestone', $userId, $weekStart)),
            'habits' => $this->habitRows($this->dashboard->habits($userId, $today, $weekStart, $weekEnd)),
        ];
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
        $expected = $current; $provided = $ids; sort($expected); sort($provided);
        if ($expected !== $provided || count($ids) !== count(array_unique($ids))) throw new ValidationException(['ids' => ['Provide exactly the active selection set.']]);
        $this->transactions->run(function () use ($type, $userId, $ids): void {
            $this->planning->lockOwner($userId);
            $this->dashboard->reorderSelections($type, $userId, $this->weekStart($userId), $ids);
        });
        return $this->selections($type, $userId);
    }

    private function weekStart(int $userId): string { return $this->clock->now()->setTimezone(new DateTimeZone($this->planning->ownerTimezone($userId)))->modify('monday this week')->format('Y-m-d'); }
    private function assertType(string $type): void { if (!in_array($type, ['task', 'milestone'], true)) throw new HttpException(404, 'NOT_FOUND', 'The selection type was not found.'); }
    private function uuid(mixed $value): string { if (!is_string($value) || preg_match('/^[0-9a-f-]{36}$/D', $value) !== 1) throw new ValidationException(['id' => ['The UUID is invalid.']]); return $value; }
    private function keys(array $input, array $allowed): void { if (array_diff(array_keys($input), $allowed) !== []) throw new ValidationException(['_unknown' => ['The request contains an unsupported field.']]); }
    private function serializeRows(array $rows): array { return array_map(function (array $row): array { unset($row['user_id']); foreach (['version', 'position', 'importance', 'selection_position'] as $field) if (isset($row[$field])) $row[$field] = (int) $row[$field]; return $row; }, $rows); }
    private function habitRows(array $rows): array { return array_map(function (array $row): array { $row['completed_days'] = (int) $row['completed_days']; $row['target_frequency'] = (int) $row['target_frequency']; unset($row['user_id']); return $row; }, $rows); }
}
