<?php

declare(strict_types=1);

namespace Planner\Infrastructure\Persistence\Pdo\Habits;

use PDO;

final readonly class PdoHabitRepository
{
    private const COLUMNS = [
        'primary_goal_id', 'name', 'description', 'importance', 'period',
        'target_frequency', 'timezone', 'position', 'first_check_in_at',
    ];

    public function __construct(private PDO $pdo) {}

    /** @return list<array<string, mixed>> */
    public function list(int $userId): array
    {
        $statement = $this->pdo->prepare('SELECT * FROM habits WHERE user_id = :user_id AND archived_at IS NULL ORDER BY position, id');
        $statement->execute(['user_id' => $userId]);

        return $statement->fetchAll();
    }

    /** @return array<string, mixed>|null */
    public function find(int $userId, string $id, bool $forUpdate = false): ?array
    {
        $statement = $this->pdo->prepare('SELECT * FROM habits WHERE user_id = :user_id AND id = :id AND archived_at IS NULL'.($forUpdate ? ' FOR UPDATE' : ''));
        $statement->execute(['user_id' => $userId, 'id' => $id]);
        $row = $statement->fetch();

        return is_array($row) ? $row : null;
    }

    /** @param array<string, mixed> $values @return array<string, mixed> */
    public function insert(int $userId, string $id, array $values, string $timestamp): array
    {
        $values = $this->safe($values);
        $columns = ['id', 'user_id', ...array_keys($values), 'created_at', 'updated_at'];
        $bindings = ['id' => $id, 'user_id' => $userId, ...$values, 'created_at' => $timestamp, 'updated_at' => $timestamp];
        $statement = $this->pdo->prepare('INSERT INTO habits ('.implode(', ', $columns).') VALUES ('.implode(', ', array_map(static fn (string $column): string => ':'.$column, $columns)).')');
        $statement->execute($bindings);

        return $this->find($userId, $id) ?? throw new \RuntimeException('Created Habit could not be reloaded.');
    }

    /** @param array<string, mixed> $changes @return array<string, mixed> */
    public function update(int $userId, string $id, array $changes, string $timestamp): array
    {
        $changes = $this->safe($changes);
        $assignments = array_map(static fn (string $column): string => "$column = :$column", array_keys($changes));
        $assignments[] = 'version = version + 1';
        $assignments[] = 'updated_at = :updated_at';
        $statement = $this->pdo->prepare('UPDATE habits SET '.implode(', ', $assignments).' WHERE user_id = :user_id AND id = :id AND archived_at IS NULL');
        $statement->execute([...$changes, 'updated_at' => $timestamp, 'user_id' => $userId, 'id' => $id]);

        return $this->find($userId, $id) ?? throw new \RuntimeException('Updated Habit could not be reloaded.');
    }

    /** @return array<string, mixed> */
    public function archive(int $userId, string $id, string $timestamp): array
    {
        $statement = $this->pdo->prepare('UPDATE habits SET archived_at = :timestamp, version = version + 1, updated_at = :timestamp WHERE user_id = :user_id AND id = :id AND archived_at IS NULL');
        $statement->execute(['timestamp' => $timestamp, 'user_id' => $userId, 'id' => $id]);
        $statement = $this->pdo->prepare('SELECT * FROM habits WHERE user_id = :user_id AND id = :id');
        $statement->execute(['user_id' => $userId, 'id' => $id]);

        return $statement->fetch() ?: throw new \RuntimeException('Archived Habit could not be reloaded.');
    }

    /** @return array<string, mixed>|null */
    public function checkIn(int $userId, string $habitId, string $date, bool $forUpdate = false): ?array
    {
        $statement = $this->pdo->prepare('SELECT * FROM habit_check_ins WHERE user_id = :user_id AND habit_id = :habit_id AND local_date = :local_date'.($forUpdate ? ' FOR UPDATE' : ''));
        $statement->execute(['user_id' => $userId, 'habit_id' => $habitId, 'local_date' => $date]);
        $row = $statement->fetch();

        return is_array($row) ? $row : null;
    }

    /** @return array<string, mixed> */
    public function insertCheckIn(string $id, int $userId, string $habitId, string $date, string $timezone, string $timestamp): array
    {
        $statement = $this->pdo->prepare('INSERT INTO habit_check_ins (id, user_id, habit_id, local_date, timezone, recorded_at) VALUES (:id, :user_id, :habit_id, :local_date, :timezone, :recorded_at)');
        $statement->execute(['id' => $id, 'user_id' => $userId, 'habit_id' => $habitId, 'local_date' => $date, 'timezone' => $timezone, 'recorded_at' => $timestamp]);

        return $this->checkIn($userId, $habitId, $date) ?? throw new \RuntimeException('Check-in could not be reloaded.');
    }

    public function deleteCheckIn(int $userId, string $habitId, string $date): void
    {
        $statement = $this->pdo->prepare('DELETE FROM habit_check_ins WHERE user_id = :user_id AND habit_id = :habit_id AND local_date = :local_date');
        $statement->execute(['user_id' => $userId, 'habit_id' => $habitId, 'local_date' => $date]);
    }

    /** @return list<array<string, mixed>> */
    public function history(int $userId, string $habitId, ?string $from = null, ?string $to = null): array
    {
        $conditions = ['user_id = :user_id', 'habit_id = :habit_id'];
        $bindings = ['user_id' => $userId, 'habit_id' => $habitId];
        if ($from !== null) {
            $conditions[] = 'local_date >= :from_date';
            $bindings['from_date'] = $from;
        }
        if ($to !== null) {
            $conditions[] = 'local_date <= :to_date';
            $bindings['to_date'] = $to;
        }
        $statement = $this->pdo->prepare('SELECT * FROM habit_check_ins WHERE '.implode(' AND ', $conditions).' ORDER BY local_date DESC');
        $statement->execute($bindings);

        return $statement->fetchAll();
    }

    public function setTags(int $userId, string $habitId, array $tagIds): void
    {
        $delete = $this->pdo->prepare('DELETE FROM habit_tags WHERE user_id = :user_id AND habit_id = :habit_id');
        $delete->execute(['user_id' => $userId, 'habit_id' => $habitId]);
        $insert = $this->pdo->prepare('INSERT INTO habit_tags (user_id, habit_id, tag_id) VALUES (:user_id, :habit_id, :tag_id)');
        foreach ($tagIds as $tagId) {
            $insert->execute(['user_id' => $userId, 'habit_id' => $habitId, 'tag_id' => $tagId]);
        }
    }

    /** @return list<int> */
    public function tagIds(int $userId, string $habitId): array
    {
        $statement = $this->pdo->prepare(<<<'SQL'
SELECT edge.tag_id FROM habit_tags edge
JOIN labels tag ON tag.user_id = edge.user_id AND tag.id = edge.tag_id AND tag.archived_at IS NULL
WHERE edge.user_id = :user_id AND edge.habit_id = :habit_id ORDER BY edge.tag_id
SQL);
        $statement->execute(['user_id' => $userId, 'habit_id' => $habitId]);

        return array_map('intval', $statement->fetchAll(PDO::FETCH_COLUMN));
    }

    /** @return list<string> */
    public function contributionGoalIds(int $userId, string $habitId): array
    {
        $statement = $this->pdo->prepare(<<<'SQL'
SELECT edge.goal_id FROM habit_contributions edge
JOIN goals goal ON goal.user_id = edge.user_id AND goal.id = edge.goal_id AND goal.archived_at IS NULL
WHERE edge.user_id = :user_id AND edge.habit_id = :habit_id ORDER BY edge.goal_id
SQL);
        $statement->execute(['user_id' => $userId, 'habit_id' => $habitId]);

        return array_map('strval', $statement->fetchAll(PDO::FETCH_COLUMN));
    }

    public function contributionExists(int $userId, string $habitId, string $goalId): bool
    {
        $statement = $this->pdo->prepare('SELECT 1 FROM habit_contributions WHERE user_id = :user_id AND habit_id = :habit_id AND goal_id = :goal_id');
        $statement->execute(['user_id' => $userId, 'habit_id' => $habitId, 'goal_id' => $goalId]);

        return $statement->fetchColumn() !== false;
    }

    public function addContribution(int $userId, string $habitId, string $goalId, string $timestamp): void
    {
        $statement = $this->pdo->prepare('INSERT INTO habit_contributions (user_id, habit_id, goal_id, created_at) VALUES (:user_id, :habit_id, :goal_id, :created_at)');
        $statement->execute(['user_id' => $userId, 'habit_id' => $habitId, 'goal_id' => $goalId, 'created_at' => $timestamp]);
    }

    public function removeContribution(int $userId, string $habitId, string $goalId): void
    {
        $statement = $this->pdo->prepare('DELETE FROM habit_contributions WHERE user_id = :user_id AND habit_id = :habit_id AND goal_id = :goal_id');
        $statement->execute(['user_id' => $userId, 'habit_id' => $habitId, 'goal_id' => $goalId]);
    }

    /** @param array<string, mixed> $values @return array<string, mixed> */
    private function safe(array $values): array
    {
        if (array_diff(array_keys($values), self::COLUMNS) !== []) {
            throw new \LogicException('Unsafe Habit persistence column.');
        }

        return $values;
    }
}
