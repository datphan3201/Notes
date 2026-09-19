<?php

declare(strict_types=1);

namespace Planner\Application\Habits;

use DateTimeImmutable;
use DateTimeZone;
use Planner\Http\HttpException;
use Planner\Http\ValidationException;
use Planner\Infrastructure\Database\TransactionManager;
use Planner\Infrastructure\Persistence\Pdo\Activity\PdoActivityRepository;
use Planner\Infrastructure\Persistence\Pdo\Habits\PdoHabitRepository;
use Planner\Infrastructure\Persistence\Pdo\Planning\PdoPlanningRepository;
use Planner\Support\Clock;
use Planner\Support\TextNormalizer;
use Planner\Support\Timestamp;
use Planner\Support\UuidGenerator;

final readonly class HabitService
{
    public function __construct(
        private PdoHabitRepository $habits,
        private PdoPlanningRepository $planning,
        private PdoActivityRepository $activities,
        private TransactionManager $transactions,
        private UuidGenerator $uuid,
        private Clock $clock,
    ) {}

    /** @return list<array<string, mixed>> */
    public function list(int $userId): array
    {
        return array_map(fn (array $row): array => $this->serialize($row), $this->habits->list($userId));
    }

    /** @return array<string, mixed> */
    public function show(int $userId, string $id): array
    {
        return $this->serialize($this->owned($userId, $id));
    }

    /** @param array<string, mixed> $input @return array<string, mixed> */
    public function create(int $userId, array $input): array
    {
        $this->keys($input, ['primary_goal_id', 'name', 'description', 'importance', 'period', 'target_frequency', 'timezone', 'position', 'tag_ids']);
        $values = $this->validate($input, true);

        return $this->transactions->run(function () use ($userId, $values): array {
            $this->planning->lockOwner($userId);
            $tagIds = $values['tag_ids'];
            unset($values['tag_ids']);
            $this->validateReferences($userId, $values['primary_goal_id'], $tagIds);
            $row = $this->habits->insert($userId, $this->uuid->generate(), $values, $this->now());
            $this->habits->setTags($userId, (string) $row['id'], $tagIds);

            return $this->serialize($row);
        });
    }

    /** @param array<string, mixed> $input @return array<string, mixed> */
    public function update(int $userId, string $id, array $input): array
    {
        $this->keys($input, ['base_version', 'primary_goal_id', 'name', 'description', 'importance', 'period', 'target_frequency', 'timezone', 'position', 'tag_ids']);
        $baseVersion = $this->version($input);
        unset($input['base_version']);
        $changes = $this->validate($input, false);

        return $this->transactions->run(function () use ($userId, $id, $baseVersion, $changes): array {
            $this->planning->lockOwner($userId);
            $current = $this->owned($userId, $id, true);
            if ($current['first_check_in_at'] !== null
                && ((isset($changes['period']) && $changes['period'] !== $current['period'])
                    || (isset($changes['timezone']) && $changes['timezone'] !== $current['timezone']))) {
                throw new ValidationException(['period' => ['The period and time zone cannot change after the first check-in.']]);
            }
            $nextPeriod = (string) ($changes['period'] ?? $current['period']);
            $nextTarget = (int) ($changes['target_frequency'] ?? $current['target_frequency']);
            if (($nextPeriod === 'daily' && $nextTarget !== 1) || ($nextPeriod === 'weekly' && ($nextTarget < 1 || $nextTarget > 7))) {
                throw new ValidationException(['target_frequency' => ['The target frequency is invalid for this period.']]);
            }
            $tagIds = $changes['tag_ids'] ?? null;
            unset($changes['tag_ids']);
            $currentTags = $this->habits->tagIds($userId, $id);
            if ($this->same($current, $changes) && ($tagIds === null || $tagIds === $currentTags)) {
                return $this->serialize($current);
            }
            $this->assertVersion($current, $baseVersion);
            $this->validateReferences($userId, $changes['primary_goal_id'] ?? $current['primary_goal_id'], $tagIds ?? $currentTags);
            if ($tagIds !== null) {
                $this->habits->setTags($userId, $id, $tagIds);
            }

            return $this->serialize($this->habits->update($userId, $id, $changes, $this->now()));
        });
    }

    /** @param array<string, mixed> $input @return array<string, mixed> */
    public function archive(int $userId, string $id, array $input): array
    {
        $this->keys($input, ['base_version']);

        return $this->transactions->run(function () use ($userId, $id, $input): array {
            $this->planning->lockOwner($userId);
            $current = $this->owned($userId, $id, true);
            $this->assertVersion($current, $this->version($input));

            return $this->serialize($this->habits->archive($userId, $id, $this->now()));
        });
    }

    /** @return array<string, mixed> */
    public function checkIn(int $userId, string $habitId, string $date): array
    {
        return $this->transactions->run(function () use ($userId, $habitId, $date): array {
            $this->planning->lockOwner($userId);
            $habit = $this->owned($userId, $habitId, true);
            $this->assertDate($date, (string) $habit['timezone']);
            $existing = $this->habits->checkIn($userId, $habitId, $date, true);
            if ($existing !== null) {
                return $this->serializeCheckIn($existing);
            }
            $timestamp = $this->now();
            $checkIn = $this->habits->insertCheckIn($this->uuid->generate(), $userId, $habitId, $date, (string) $habit['timezone'], $timestamp);
            if ($habit['first_check_in_at'] === null) {
                $habit = $this->habits->update($userId, $habitId, ['first_check_in_at' => $timestamp], $timestamp);
            }
            $this->activities->insert($this->uuid->generate(), $userId, 'habit', (string) $checkIn['id'], 1, 'completed', $timestamp, $date, (string) $habit['timezone'], metadata: ['habit_id' => $habitId]);

            return $this->serializeCheckIn($checkIn);
        });
    }

    public function undoCheckIn(int $userId, string $habitId, string $date): void
    {
        $this->transactions->run(function () use ($userId, $habitId, $date): void {
            $this->planning->lockOwner($userId);
            $habit = $this->owned($userId, $habitId, true);
            $this->assertCalendarDate($date);
            $existing = $this->habits->checkIn($userId, $habitId, $date, true);
            if ($existing === null) {
                return;
            }
            $this->habits->deleteCheckIn($userId, $habitId, $date);
            $checkInId = (string) $existing['id'];
            $this->activities->insert(
                $this->uuid->generate(), $userId, 'habit', $checkInId, 1, 'reversed',
                $this->now(), $date, (string) $habit['timezone'],
                $this->activities->completionId($userId, 'habit', $checkInId, $date),
                ['habit_id' => $habitId],
            );
        });
    }

    /** @return list<array<string, mixed>> */
    public function history(int $userId, string $habitId): array
    {
        $this->owned($userId, $habitId);

        return array_map($this->serializeCheckIn(...), $this->habits->history($userId, $habitId));
    }

    /** @param array<string, mixed> $input @return array<string, mixed> */
    public function addContribution(int $userId, string $habitId, array $input): array
    {
        $this->keys($input, ['goal_id', 'base_version']);
        $goalId = $this->uuidValue($input['goal_id'] ?? null, 'goal_id');

        return $this->transactions->run(function () use ($userId, $habitId, $input, $goalId): array {
            $this->planning->lockOwner($userId);
            $habit = $this->owned($userId, $habitId, true);
            if ($this->habits->contributionExists($userId, $habitId, $goalId)) {
                return $this->serialize($habit);
            }
            $this->assertVersion($habit, $this->version($input));
            if ($this->planning->find('goal', $userId, $goalId, true) === null) {
                throw new ValidationException(['goal_id' => ['The Goal was not found.']]);
            }
            $this->habits->addContribution($userId, $habitId, $goalId, $this->now());

            return $this->serialize($this->habits->update($userId, $habitId, [], $this->now()));
        });
    }

    /** @param array<string, mixed> $input @return array<string, mixed> */
    public function removeContribution(int $userId, string $habitId, string $goalId, array $input): array
    {
        $this->keys($input, ['base_version']);

        return $this->transactions->run(function () use ($userId, $habitId, $goalId, $input): array {
            $this->planning->lockOwner($userId);
            $habit = $this->owned($userId, $habitId, true);
            if (!$this->habits->contributionExists($userId, $habitId, $goalId)) {
                return $this->serialize($habit);
            }
            $this->assertVersion($habit, $this->version($input));
            $this->habits->removeContribution($userId, $habitId, $goalId);

            return $this->serialize($this->habits->update($userId, $habitId, [], $this->now()));
        });
    }

    /** @param array<string, mixed> $input @return array<string, mixed> */
    private function validate(array $input, bool $create): array
    {
        $result = [];
        foreach ($input as $field => $value) {
            $result[$field] = match ($field) {
                'name' => $this->text($value, 'name', 200, true),
                'description' => $this->text($value, 'description', 10_000, false),
                'importance' => $this->integer($value, 'importance', 1, 5),
                'period' => in_array($value, ['daily', 'weekly'], true) ? $value : throw new ValidationException(['period' => ['The period is invalid.']]),
                'target_frequency' => $this->integer($value, 'target_frequency', 1, 7),
                'timezone' => $this->timezone($value),
                'position' => $this->integer($value, 'position', 0, PHP_INT_MAX),
                'primary_goal_id' => $value === null ? null : $this->uuidValue($value, 'primary_goal_id'),
                'tag_ids' => $this->tagIds($value),
                default => throw new \LogicException('Unexpected Habit input.'),
            };
        }
        if ($create) {
            $result += ['primary_goal_id' => null, 'description' => '', 'importance' => 3, 'period' => 'daily', 'target_frequency' => 1, 'timezone' => 'UTC', 'position' => 0, 'tag_ids' => [], 'first_check_in_at' => null];
            if (!isset($result['name'])) {
                throw new ValidationException(['name' => ['The name is required.']]);
            }
        }
        $period = $result['period'] ?? null;
        $target = $result['target_frequency'] ?? null;
        if (($period === 'daily' && $target !== null && $target !== 1) || ($period === 'weekly' && $target !== null && ($target < 1 || $target > 7))) {
            throw new ValidationException(['target_frequency' => ['The target frequency is invalid for this period.']]);
        }

        return $result;
    }

    /** @param list<int> $tagIds */
    private function validateReferences(int $userId, ?string $goalId, array $tagIds): void
    {
        if ($goalId !== null && $this->planning->find('goal', $userId, $goalId, true) === null) {
            throw new ValidationException(['primary_goal_id' => ['The Goal was not found.']]);
        }
        if ($this->planning->lockOwnedTagIds($userId, $tagIds) !== $tagIds) {
            throw new ValidationException(['tag_ids' => ['One or more Tags are unavailable.']]);
        }
    }

    /** @return array<string, mixed> */
    private function owned(int $userId, string $id, bool $forUpdate = false): array
    {
        return $this->habits->find($userId, $id, $forUpdate)
            ?? throw new HttpException(404, 'NOT_FOUND', 'The requested resource was not found.');
    }

    /** @param array<string, mixed> $row @return array<string, mixed> */
    private function serialize(array $row): array
    {
        foreach (['id', 'primary_goal_id'] as $field) {
            if (array_key_exists($field, $row) && $row[$field] !== null) {
                $row[$field] = (string) $row[$field];
            }
        }
        foreach (['importance', 'target_frequency', 'position', 'version'] as $field) {
            if (array_key_exists($field, $row)) {
                $row[$field] = (int) $row[$field];
            }
        }
        foreach (['created_at', 'updated_at', 'archived_at', 'first_check_in_at'] as $field) {
            if (array_key_exists($field, $row)) {
                $row[$field] = Timestamp::api($row[$field] === null ? null : (string) $row[$field]);
            }
        }
        if (isset($row['id'])) {
            $row['tag_ids'] = array_map('strval', $this->habits->tagIds((int) $row['user_id'], (string) $row['id']));
            $row['contribution_goal_ids'] = $this->habits->contributionGoalIds((int) $row['user_id'], (string) $row['id']);
        }
        unset($row['user_id']);

        return $row;
    }

    /** @param array<string, mixed> $row @return array<string, mixed> */
    private function serializeCheckIn(array $row): array
    {
        return ['id' => (string) $row['id'], 'habit_id' => (string) $row['habit_id'], 'date' => (string) $row['local_date'], 'timezone' => (string) $row['timezone'], 'recorded_at' => Timestamp::api((string) $row['recorded_at'])];
    }

    private function assertDate(string $date, string $timezone): void
    {
        $value = $this->assertCalendarDate($date, new DateTimeZone($timezone));
        if ($value > $this->clock->now()->setTimezone(new DateTimeZone($timezone))->setTime(0, 0)) {
            throw new ValidationException(['date' => ['A future date cannot be checked in.']]);
        }
    }

    private function assertCalendarDate(string $date, ?DateTimeZone $zone = null): DateTimeImmutable
    {
        $value = DateTimeImmutable::createFromFormat('!Y-m-d', $date, $zone ?? new DateTimeZone('UTC'));
        if (!$value instanceof DateTimeImmutable || $value->format('Y-m-d') !== $date) {
            throw new ValidationException(['date' => ['The date is invalid.']]);
        }

        return $value;
    }

    /** @param array<string, mixed> $input */
    private function version(array $input): int
    {
        return $this->integer($input['base_version'] ?? null, 'base_version', 1, PHP_INT_MAX);
    }

    /** @param array<string, mixed> $row @param array<string, mixed> $changes */
    private function same(array $row, array $changes): bool
    {
        foreach ($changes as $field => $value) {
            if (($row[$field] ?? null) != $value) {
                return false;
            }
        }

        return true;
    }

    /** @param array<string, mixed> $row */
    private function assertVersion(array $row, int $baseVersion): void
    {
        if ((int) $row['version'] !== $baseVersion) {
            throw new HttpException(409, 'VERSION_CONFLICT', 'The resource has changed.', payload: ['current' => $this->serialize($row)]);
        }
    }

    private function text(mixed $value, string $field, int $max, bool $required): string
    {
        if (!is_string($value)) {
            throw new ValidationException([$field => ['The value must be a string.']]);
        }
        $value = TextNormalizer::nfc(trim($value));
        if (($required && $value === '') || TextNormalizer::codePoints($value) > $max) {
            throw new ValidationException([$field => ['The value is invalid.']]);
        }

        return $value;
    }

    private function integer(mixed $value, string $field, int $min, int $max): int
    {
        if (!is_int($value) || $value < $min || $value > $max) {
            throw new ValidationException([$field => ['The integer is invalid.']]);
        }

        return $value;
    }

    private function timezone(mixed $value): string
    {
        if (!is_string($value)) {
            throw new ValidationException(['timezone' => ['The time zone is invalid.']]);
        }
        try {
            new DateTimeZone($value);
        } catch (\Exception) {
            throw new ValidationException(['timezone' => ['The time zone is invalid.']]);
        }

        return $value;
    }

    private function uuidValue(mixed $value, string $field): string
    {
        if (!is_string($value) || preg_match('/^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/D', $value) !== 1) {
            throw new ValidationException([$field => ['The identifier is invalid.']]);
        }

        return $value;
    }

    /** @return list<int> */
    private function tagIds(mixed $value): array
    {
        if (!is_array($value) || !array_is_list($value)) {
            throw new ValidationException(['tag_ids' => ['The Tag list is invalid.']]);
        }
        $ids = [];
        foreach ($value as $id) {
            if ((!is_int($id) && !is_string($id)) || !ctype_digit((string) $id) || (int) $id < 1) {
                throw new ValidationException(['tag_ids' => ['The Tag list is invalid.']]);
            }
            $ids[] = (int) $id;
        }
        $ids = array_values(array_unique($ids));
        sort($ids, SORT_NUMERIC);

        return $ids;
    }

    /** @param array<string, mixed> $input @param list<string> $allowed */
    private function keys(array $input, array $allowed): void
    {
        $unknown = array_diff(array_keys($input), $allowed);
        if ($unknown !== []) {
            throw new ValidationException(['request' => ['Unsupported field: '.implode(', ', $unknown)]]);
        }
    }

    private function now(): string
    {
        return Timestamp::database($this->clock->now());
    }
}
