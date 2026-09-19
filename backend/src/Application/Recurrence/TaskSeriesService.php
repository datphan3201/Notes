<?php

declare(strict_types=1);

namespace Planner\Application\Recurrence;

use DateTimeImmutable;
use DateTimeZone;
use Planner\Application\Planning\PlanningService;
use Planner\Domain\Recurrence\RecurrenceCalculator;
use Planner\Http\HttpException;
use Planner\Http\ValidationException;
use Planner\Infrastructure\Database\TransactionManager;
use Planner\Infrastructure\Persistence\Pdo\Planning\PdoPlanningRepository;
use Planner\Infrastructure\Persistence\Pdo\Recurrence\PdoTaskSeriesRepository;
use Planner\Support\Clock;
use Planner\Support\TextNormalizer;
use Planner\Support\Timestamp;
use Planner\Support\UuidGenerator;
use Throwable;

final readonly class TaskSeriesService
{
    public function __construct(
        private PdoTaskSeriesRepository $series,
        private PdoPlanningRepository $planningRepository,
        private PlanningService $planning,
        private RecurrenceCalculator $calculator,
        private TransactionManager $transactions,
        private UuidGenerator $uuid,
        private Clock $clock,
    ) {}

    /** @return list<array<string, mixed>> */
    public function list(int $userId): array
    {
        return array_map(fn (array $row): array => $this->serialize($row), $this->series->list($userId));
    }

    /** @return array<string, mixed> */
    public function show(int $userId, string $id): array
    {
        return $this->serialize($this->owned($userId, $id));
    }

    /** @param array<string, mixed> $input @return array<string, mixed> */
    public function create(int $userId, array $input): array
    {
        $values = $this->validateCreate($input);

        return $this->transactions->run(function () use ($userId, $values): array {
            $this->planningRepository->lockOwner($userId);
            $checklist = $values['checklist'];
            $tagIds = $values['tag_ids'];
            $contributionIds = $values['contribution_goal_ids'];
            unset($values['checklist'], $values['tag_ids'], $values['contribution_goal_ids']);
            $this->validateReferences($userId, $values, $tagIds, $contributionIds);
            $id = $this->uuid->generate();
            $row = $this->series->insert($userId, $id, $values, $this->now());
            $this->series->setChecklistTemplate($userId, $id, $checklist, $this->uuid->generate(...));
            $this->series->setTags($userId, $id, $tagIds);
            $this->series->setContributions($userId, $id, $contributionIds);

            return $this->serialize($row);
        });
    }

    /** @param array<string, mixed> $input @return array<string, mixed> */
    public function update(int $userId, string $id, array $input): array
    {
        $this->keys($input, ['base_version', 'name', 'description', 'expected_result', 'completion_criteria', 'importance', 'goal_id', 'milestone_id', 'frequency', 'interval_count', 'weekdays', 'start_date', 'end_date', 'timezone', 'local_time', 'duration_minutes', 'deadline_offset_days', 'checklist', 'tag_ids', 'contribution_goal_ids']);
        $baseVersion = $this->version($input);
        unset($input['base_version']);

        return $this->transactions->run(function () use ($userId, $id, $input, $baseVersion): array {
            $this->planningRepository->lockOwner($userId);
            $current = $this->owned($userId, $id, true);
            if ($this->series->occurrenceCount($userId, $id) > 0) {
                throw new ValidationException(['series' => ['This series has already generated Tasks; end it and create a replacement series.']]);
            }
            $merged = $this->createPayloadFromRow($current, $input);
            $values = $this->validateCreate($merged);
            $checklist = $values['checklist'];
            $tagIds = $values['tag_ids'];
            $contributionIds = $values['contribution_goal_ids'];
            unset($values['checklist'], $values['tag_ids'], $values['contribution_goal_ids'], $values['state'], $values['paused_at'], $values['last_error_code']);
            $this->assertVersion($current, $baseVersion);
            $this->validateReferences($userId, $values, $tagIds, $contributionIds);
            $row = $this->series->update($userId, $id, $values, $this->now());
            $this->series->setChecklistTemplate($userId, $id, $checklist, $this->uuid->generate(...));
            $this->series->setTags($userId, $id, $tagIds);
            $this->series->setContributions($userId, $id, $contributionIds);

            return $this->serialize($row);
        });
    }

    /** @param array<string, mixed> $input @return array<string, mixed> */
    public function transition(int $userId, string $id, string $action, array $input): array
    {
        $allowed = $action === 'end' ? ['base_version', 'end_date', 'archive_future'] : ['base_version'];
        $this->keys($input, $allowed);

        return $this->transactions->run(function () use ($userId, $id, $action, $input): array {
            $this->planningRepository->lockOwner($userId);
            $current = $this->owned($userId, $id, true);
            $this->assertVersion($current, $this->version($input));
            $now = $this->now();
            $changes = match ($action) {
                'pause' => ['state' => 'Paused', 'paused_at' => $now],
                'resume' => ['state' => 'Active', 'paused_at' => null, 'cursor_date' => $this->resumeCursor($current)],
                'end' => ['state' => 'Ended', 'end_date' => $this->requiredDate($input['end_date'] ?? null, 'end_date')],
                default => throw new HttpException(404, 'NOT_FOUND', 'The operation was not found.'),
            };
            if (($action === 'pause' && $current['state'] === 'Paused') || ($action === 'resume' && $current['state'] === 'Active') || ($action === 'end' && $current['state'] === 'Ended')) {
                return $this->serialize($current);
            }
            if ($action === 'end' && ($input['archive_future'] ?? false) !== true) {
                $future = $this->clock->now()->setTimezone(new DateTimeZone((string) $current['timezone']))->format('Y-m-d');
                if ($this->hasFutureNotStarted($userId, $id, $future)) {
                    throw new ValidationException(['archive_future' => ['Confirm that future Tasks which have not started should be archived.']]);
                }
            }
            $row = $this->series->update($userId, $id, $changes, $now);
            if ($action === 'end' && ($input['archive_future'] ?? false) === true) {
                $this->series->archiveFutureNotStarted($userId, $id, (string) $changes['end_date'], $now);
            }

            return $this->serialize($row);
        });
    }

    /** @param array<string, mixed> $input @return list<string> */
    public function preview(array $input, ?string $cursor = null, ?string $horizon = null): array
    {
        $values = $this->validateCreate($input);
        $rule = $this->rule($values);
        $cursor ??= (new DateTimeImmutable((string) $values['start_date']))->modify('-1 day')->format('Y-m-d');
        $horizon ??= (new DateTimeImmutable('now', new DateTimeZone((string) $values['timezone'])))->modify('+35 days')->format('Y-m-d');

        return $this->calculator->dates($rule, $cursor, $horizon);
    }

    /** @return array{created:int,failed:list<string>} */
    public function materialize(): array
    {
        $created = 0;
        $failed = [];
        foreach ($this->series->active() as $candidate) {
            try {
                $created += $this->materializeSeries((int) $candidate['user_id'], (string) $candidate['id']);
            } catch (Throwable) {
                $failed[] = (string) $candidate['id'];
                $this->transactions->run(function () use ($candidate): void {
                    $this->planningRepository->lockOwner((int) $candidate['user_id']);
                    if ($this->series->find((int) $candidate['user_id'], (string) $candidate['id'], true) !== null) {
                        $this->series->update((int) $candidate['user_id'], (string) $candidate['id'], ['last_error_code' => 'MATERIALIZATION_FAILED'], $this->now(), false);
                    }
                });
            }
        }

        return ['created' => $created, 'failed' => $failed];
    }

    private function materializeSeries(int $userId, string $id): int
    {
        return $this->transactions->run(function () use ($userId, $id): int {
            $this->planningRepository->lockOwner($userId);
            $series = $this->owned($userId, $id, true);
            if ($series['state'] !== 'Active') {
                return 0;
            }
            $zone = new DateTimeZone((string) $series['timezone']);
            $horizon = $this->clock->now()->setTimezone($zone)->modify('+35 days')->format('Y-m-d');
            if ($series['end_date'] !== null && $series['end_date'] < $horizon) {
                $horizon = (string) $series['end_date'];
            }
            if ($horizon <= $series['cursor_date']) {
                return 0;
            }
            $dates = $this->calculator->dates($this->rule($series), (string) $series['cursor_date'], $horizon, 200);
            $count = 0;
            foreach ($dates as $date) {
                if ($this->series->occurrence($userId, $id, $date) !== null) {
                    continue;
                }
                $start = $this->calculator->localDateTimeToUtc($date, $series['local_time'] === null ? null : (string) $series['local_time'], (string) $series['timezone']);
                $end = $start !== null && $series['duration_minutes'] !== null ? $start->modify('+'.(int) $series['duration_minutes'].' minutes') : null;
                $deadline = $series['deadline_offset_days'] === null ? null : (new DateTimeImmutable($date))->modify('+'.(int) $series['deadline_offset_days'].' days')->format('Y-m-d');
                $task = $this->planning->create('task', $userId, [
                    'goal_id' => $series['goal_id'],
                    'milestone_id' => $series['milestone_id'],
                    'name' => $series['name'],
                    'description' => $series['description'],
                    'expected_result' => $series['expected_result'],
                    'completion_criteria' => $series['completion_criteria'],
                    'importance' => (int) $series['importance'],
                    'start_date' => $date,
                    'deadline' => $deadline,
                    'scheduled_start' => $start?->format(DATE_ATOM),
                    'scheduled_end' => $end?->format(DATE_ATOM),
                    'tag_ids' => array_map('strval', $this->series->tagIds($userId, $id)),
                ]);
                $this->planningRepository->linkOccurrence($userId, (string) $task['id'], $id, $date, (string) $series['timezone']);
                foreach ($this->series->checklistTemplate($userId, $id) as $item) {
                    $this->planning->createChecklist($userId, (string) $task['id'], ['title' => $item['title'], 'position' => (int) $item['position']]);
                }
                foreach ($this->series->contributionIds($userId, $id) as $goalId) {
                    $task = $this->planning->addContribution('task', $userId, (string) $task['id'], ['goal_id' => $goalId, 'base_version' => $task['version']]);
                }
                $count++;
            }
            $cursor = count($dates) === 200 ? end($dates) : $horizon;
            $this->series->update($userId, $id, ['cursor_date' => $cursor, 'last_error_code' => null], $this->now(), false);

            return $count;
        });
    }

    /** @param array<string, mixed> $input @return array<string, mixed> */
    private function validateCreate(array $input): array
    {
        $this->keys($input, ['name', 'description', 'expected_result', 'completion_criteria', 'importance', 'goal_id', 'milestone_id', 'frequency', 'interval_count', 'weekdays', 'start_date', 'end_date', 'timezone', 'local_time', 'duration_minutes', 'deadline_offset_days', 'checklist', 'tag_ids', 'contribution_goal_ids']);
        $name = $this->text($input['name'] ?? null, 'name', 200, true);
        $frequency = $input['frequency'] ?? null;
        if (!in_array($frequency, ['daily', 'weekly'], true)) {
            throw new ValidationException(['frequency' => ['The frequency is invalid.']]);
        }
        $weekdays = $this->weekdays($input['weekdays'] ?? []);
        if (($frequency === 'daily' && $weekdays !== []) || ($frequency === 'weekly' && $weekdays === [])) {
            throw new ValidationException(['weekdays' => ['The selected weekdays do not match the frequency.']]);
        }
        $start = $this->requiredDate($input['start_date'] ?? null, 'start_date');
        $end = ($input['end_date'] ?? null) === null ? null : $this->requiredDate($input['end_date'], 'end_date');
        if ($end !== null && $end < $start) {
            throw new ValidationException(['end_date' => ['The end date cannot be before the start date.']]);
        }
        $timezone = $this->timezone($input['timezone'] ?? null);
        $goalId = $this->nullableUuid($input['goal_id'] ?? null, 'goal_id');
        $milestoneId = $this->nullableUuid($input['milestone_id'] ?? null, 'milestone_id');
        if ($goalId !== null && $milestoneId !== null) {
            throw new ValidationException(['parent' => ['A series can have only one primary location.']]);
        }
        $localTime = $input['local_time'] ?? null;
        if ($localTime !== null && (!is_string($localTime) || preg_match('/^(?:[01]\d|2[0-3]):[0-5]\d(?::[0-5]\d)?$/D', $localTime) !== 1)) {
            throw new ValidationException(['local_time' => ['The local time is invalid.']]);
        }
        if (is_string($localTime) && strlen($localTime) === 5) {
            $localTime .= ':00';
        }
        $checklist = $this->checklist($input['checklist'] ?? []);

        return [
            'goal_id' => $goalId, 'milestone_id' => $milestoneId, 'name' => $name,
            'description' => $this->text($input['description'] ?? '', 'description', 10_000, false),
            'expected_result' => $this->text($input['expected_result'] ?? '', 'expected_result', 10_000, false),
            'completion_criteria' => $this->text($input['completion_criteria'] ?? '', 'completion_criteria', 10_000, false),
            'importance' => $this->integer($input['importance'] ?? 3, 'importance', 1, 5),
            'frequency' => $frequency, 'interval_count' => $this->integer($input['interval_count'] ?? 1, 'interval_count', 1, 52),
            'weekday_mask' => $this->weekdayMask($weekdays), 'start_date' => $start, 'end_date' => $end,
            'timezone' => $timezone, 'local_time' => $localTime,
            'duration_minutes' => ($input['duration_minutes'] ?? null) === null ? null : $this->integer($input['duration_minutes'], 'duration_minutes', 1, 65_535),
            'deadline_offset_days' => ($input['deadline_offset_days'] ?? null) === null ? null : $this->integer($input['deadline_offset_days'], 'deadline_offset_days', 0, 365),
            'state' => 'Active', 'cursor_date' => (new DateTimeImmutable($start))->modify('-1 day')->format('Y-m-d'),
            'paused_at' => null, 'last_error_code' => null, 'checklist' => $checklist,
            'tag_ids' => $this->numericIds($input['tag_ids'] ?? [], 'tag_ids'),
            'contribution_goal_ids' => $this->uuidIds($input['contribution_goal_ids'] ?? [], 'contribution_goal_ids'),
        ];
    }

    /** @param array<string, mixed> $row @param array<string, mixed> $changes @return array<string, mixed> */
    private function createPayloadFromRow(array $row, array $changes): array
    {
        $payload = [
            'name' => $row['name'], 'description' => $row['description'], 'expected_result' => $row['expected_result'],
            'completion_criteria' => $row['completion_criteria'], 'importance' => (int) $row['importance'],
            'goal_id' => $row['goal_id'], 'milestone_id' => $row['milestone_id'], 'frequency' => $row['frequency'],
            'interval_count' => (int) $row['interval_count'], 'weekdays' => $this->maskWeekdays((int) $row['weekday_mask']),
            'start_date' => $row['start_date'], 'end_date' => $row['end_date'], 'timezone' => $row['timezone'],
            'local_time' => $row['local_time'], 'duration_minutes' => $row['duration_minutes'] === null ? null : (int) $row['duration_minutes'],
            'deadline_offset_days' => $row['deadline_offset_days'] === null ? null : (int) $row['deadline_offset_days'],
            'checklist' => array_map(static fn (array $item): array => ['title' => $item['title'], 'position' => (int) $item['position']], $this->series->checklistTemplate((int) $row['user_id'], (string) $row['id'])),
            'tag_ids' => $this->series->tagIds((int) $row['user_id'], (string) $row['id']),
            'contribution_goal_ids' => $this->series->contributionIds((int) $row['user_id'], (string) $row['id']),
        ];

        return [...$payload, ...$changes];
    }

    /** @param array<string, mixed> $values @param list<int> $tagIds @param list<string> $contributionIds */
    private function validateReferences(int $userId, array $values, array $tagIds, array $contributionIds): void
    {
        foreach ([['goal', $values['goal_id']], ['milestone', $values['milestone_id']]] as [$type, $id]) {
            if ($id !== null && $this->planningRepository->find($type, $userId, (string) $id, true) === null) {
                throw new ValidationException([$type.'_id' => ['The primary location was not found.']]);
            }
        }
        if ($this->planningRepository->lockOwnedTagIds($userId, $tagIds) !== $tagIds) {
            throw new ValidationException(['tag_ids' => ['One or more Tags are unavailable.']]);
        }
        foreach ($contributionIds as $goalId) {
            if ($this->planningRepository->find('goal', $userId, $goalId, true) === null) {
                throw new ValidationException(['contribution_goal_ids' => ['One or more Goals are unavailable.']]);
            }
        }
    }

    /** @param array<string, mixed> $row @return array<string, mixed> */
    private function serialize(array $row): array
    {
        $userId = (int) $row['user_id'];
        $seriesId = (string) $row['id'];
        foreach (['importance', 'interval_count', 'duration_minutes', 'deadline_offset_days', 'version'] as $field) {
            if (array_key_exists($field, $row) && $row[$field] !== null) {
                $row[$field] = (int) $row[$field];
            }
        }
        $row['weekdays'] = $this->maskWeekdays((int) $row['weekday_mask']);
        $row['checklist'] = $this->series->checklistTemplate($userId, $seriesId);
        $row['tag_ids'] = array_map('strval', $this->series->tagIds($userId, $seriesId));
        $row['contribution_goal_ids'] = $this->series->contributionIds($userId, $seriesId);
        unset($row['weekday_mask'], $row['user_id']);
        foreach (['created_at', 'updated_at', 'paused_at', 'archived_at'] as $field) {
            $row[$field] = Timestamp::api($row[$field] === null ? null : (string) $row[$field]);
        }
        return $row;
    }

    /** @param array<string, mixed> $row @return array{frequency:string,interval_count:int,weekdays:list<int>,start_date:string,end_date:?string,timezone:string} */
    private function rule(array $row): array
    {
        return ['frequency' => (string) $row['frequency'], 'interval_count' => (int) $row['interval_count'], 'weekdays' => isset($row['weekdays']) ? $row['weekdays'] : $this->maskWeekdays((int) $row['weekday_mask']), 'start_date' => (string) $row['start_date'], 'end_date' => $row['end_date'] === null ? null : (string) $row['end_date'], 'timezone' => (string) $row['timezone']];
    }

    /** @return array<string, mixed> */
    private function owned(int $userId, string $id, bool $forUpdate = false): array
    {
        return $this->series->find($userId, $id, $forUpdate) ?? throw new HttpException(404, 'NOT_FOUND', 'The requested resource was not found.');
    }

    private function resumeCursor(array $row): string
    {
        $yesterday = $this->clock->now()->setTimezone(new DateTimeZone((string) $row['timezone']))->modify('-1 day')->format('Y-m-d');

        return max((string) $row['cursor_date'], $yesterday);
    }

    private function hasFutureNotStarted(int $userId, string $seriesId, string $date): bool
    {
        foreach ($this->planning->list('task', $userId) as $task) {
            if ($task['series_id'] === $seriesId && $task['occurrence_date'] > $date && $task['status'] === 'NotStarted') {
                return true;
            }
        }

        return false;
    }

    /** @param array<string, mixed> $row */
    private function assertVersion(array $row, int $version): void
    {
        if ((int) $row['version'] !== $version) {
            throw new HttpException(409, 'VERSION_CONFLICT', 'The Task series has changed.');
        }
    }

    /** @param array<string, mixed> $input */
    private function version(array $input): int { return $this->integer($input['base_version'] ?? null, 'base_version', 1, PHP_INT_MAX); }
    private function now(): string { return Timestamp::database($this->clock->now()); }
    private function text(mixed $value, string $field, int $max, bool $required): string
    {
        if (!is_string($value)) throw new ValidationException([$field => ['The value must be a string.']]);
        $value = TextNormalizer::nfc(trim($value));
        if (($required && $value === '') || mb_strlen($value) > $max) throw new ValidationException([$field => ['The value is invalid.']]);
        return $value;
    }
    private function integer(mixed $value, string $field, int $min, int $max): int
    {
        if (!is_int($value) || $value < $min || $value > $max) throw new ValidationException([$field => ['The integer is invalid.']]);
        return $value;
    }
    private function timezone(mixed $value): string
    {
        if (!is_string($value)) throw new ValidationException(['timezone' => ['The time zone is invalid.']]);
        try { new DateTimeZone($value); } catch (\Exception) { throw new ValidationException(['timezone' => ['The time zone is invalid.']]); }
        return $value;
    }
    private function requiredDate(mixed $value, string $field): string
    {
        if (!is_string($value) || !preg_match('/^\d{4}-\d{2}-\d{2}$/D', $value)) throw new ValidationException([$field => ['The date is invalid.']]);
        $date = DateTimeImmutable::createFromFormat('!Y-m-d', $value);
        if (!$date instanceof DateTimeImmutable || $date->format('Y-m-d') !== $value) throw new ValidationException([$field => ['The date is invalid.']]);
        return $value;
    }
    private function nullableUuid(mixed $value, string $field): ?string
    {
        if ($value === null) return null;
        if (!is_string($value) || preg_match('/^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/D', $value) !== 1) throw new ValidationException([$field => ['The UUID is invalid.']]);
        return $value;
    }
    /** @return list<int> */
    private function weekdays(mixed $value): array
    {
        if (!is_array($value) || !array_is_list($value)) throw new ValidationException(['weekdays' => ['The weekday list is invalid.']]);
        foreach ($value as $day) if (!is_int($day) || $day < 1 || $day > 7) throw new ValidationException(['weekdays' => ['The weekday list is invalid.']]);
        $value = array_values(array_unique($value)); sort($value); return $value;
    }
    /** @param list<int> $days */
    private function weekdayMask(array $days): int { return array_reduce($days, static fn (int $mask, int $day): int => $mask | (1 << ($day - 1)), 0); }
    /** @return list<int> */
    private function maskWeekdays(int $mask): array { $days = []; for ($day = 1; $day <= 7; $day++) if (($mask & (1 << ($day - 1))) !== 0) $days[] = $day; return $days; }
    /** @return list<int> */
    private function numericIds(mixed $value, string $field): array
    {
        if (!is_array($value) || !array_is_list($value)) throw new ValidationException([$field => ['The list is invalid.']]);
        $ids = []; foreach ($value as $id) { if ((!is_int($id) && !is_string($id)) || !ctype_digit((string) $id) || (int) $id < 1) throw new ValidationException([$field => ['The list is invalid.']]); $ids[] = (int) $id; }
        $ids = array_values(array_unique($ids)); sort($ids); return $ids;
    }
    /** @return list<string> */
    private function uuidIds(mixed $value, string $field): array
    {
        if (!is_array($value) || !array_is_list($value)) throw new ValidationException([$field => ['The list is invalid.']]);
        $ids = []; foreach ($value as $id) { $id = $this->nullableUuid($id, $field); if ($id !== null) $ids[] = $id; }
        $ids = array_values(array_unique($ids)); sort($ids); return $ids;
    }
    /** @return list<array{title:string,position:int}> */
    private function checklist(mixed $value): array
    {
        if (!is_array($value) || !array_is_list($value) || count($value) > 100) throw new ValidationException(['checklist' => ['The Checklist is invalid.']]);
        $items = []; foreach ($value as $position => $item) { if (!is_array($item) || array_diff(array_keys($item), ['title', 'position']) !== []) throw new ValidationException(['checklist' => ['The Checklist is invalid.']]); $items[] = ['title' => $this->text($item['title'] ?? null, 'checklist', 500, true), 'position' => isset($item['position']) ? $this->integer($item['position'], 'position', 0, PHP_INT_MAX) : $position]; }
        return $items;
    }
    /** @param array<string, mixed> $input @param list<string> $allowed */
    private function keys(array $input, array $allowed): void { if (array_diff(array_keys($input), $allowed) !== []) throw new ValidationException(['_unknown' => ['The request contains an unsupported field.']]); }
}
