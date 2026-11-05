<?php

declare(strict_types=1);

namespace Planner\Infrastructure\Persistence\Pdo\AI;

use PDO;

final readonly class PdoAIActionRepository
{
    public function __construct(private PDO $pdo)
    {
    }

    public function consented(int $userId): bool
    {
        $statement = $this->pdo->prepare(
            'SELECT ai_consent_at IS NOT NULL FROM user_preferences WHERE user_id = :user_id',
        );
        $statement->execute(['user_id' => $userId]);

        return (bool) $statement->fetchColumn();
    }

    public function consent(int $userId, string $timestamp): void
    {
        $statement = $this->pdo->prepare(
            'UPDATE user_preferences SET ai_consent_at = :consent_at, updated_at = :updated_at WHERE user_id = :user_id',
        );
        $statement->execute([
            'consent_at' => $timestamp,
            'updated_at' => $timestamp,
            'user_id' => $userId,
        ]);
    }

    /** @param array<string, mixed> $values @return array<string, mixed> */
    public function insert(array $values): array
    {
        $columns = array_keys($values);
        $placeholders = array_map(static fn (string $column): string => ':'.$column, $columns);
        $statement = $this->pdo->prepare(
            'INSERT INTO ai_actions ('.implode(', ', $columns).') VALUES ('.implode(', ', $placeholders).')',
        );
        $statement->execute($values);

        return $this->find((int) $values['user_id'], (string) $values['id'])
            ?? throw new \RuntimeException('AI action missing after insert.');
    }

    /** @return array<string, mixed>|null */
    public function find(int $userId, string $id, bool $lock = false): ?array
    {
        $statement = $this->pdo->prepare(
            'SELECT * FROM ai_actions WHERE user_id = :user_id AND id = :id'.($lock ? ' FOR UPDATE' : ''),
        );
        $statement->execute(['user_id' => $userId, 'id' => $id]);
        $row = $statement->fetch();

        return is_array($row) ? $row : null;
    }

    /** @param array<string, mixed> $changes @return array<string, mixed> */
    public function update(int $userId, string $id, array $changes, string $timestamp): array
    {
        $assignments = array_map(
            static fn (string $column): string => "$column = :$column",
            array_keys($changes),
        );
        $assignments[] = 'version = version + 1';
        $assignments[] = 'updated_at = :updated_at';
        $statement = $this->pdo->prepare(
            'UPDATE ai_actions SET '.implode(', ', $assignments).' WHERE user_id = :user_id AND id = :id',
        );
        $statement->execute([
            ...$changes,
            'updated_at' => $timestamp,
            'user_id' => $userId,
            'id' => $id,
        ]);

        return $this->find($userId, $id)
            ?? throw new \RuntimeException('AI action missing after update.');
    }

    /** @return array{areas:list<array<string,mixed>>,goals:list<array<string,mixed>>,milestones:list<array<string,mixed>>,open_tasks:list<array<string,mixed>>,recent_notes:list<array<string,mixed>>,habits:list<array<string,mixed>>} bounded owner-only facts */
    public function assistantSummary(int $userId): array
    {
        $read = function (string $sql) use ($userId): array {
            $statement = $this->pdo->prepare($sql);
            $statement->execute(['user' => $userId]);

            return $statement->fetchAll();
        };

        return [
            'areas' => $read('SELECT id, name FROM areas WHERE user_id = :user AND archived_at IS NULL ORDER BY position LIMIT 30'),
            // Parent columns let the assistant see the structure: Goal > Milestone > Task, or Inbox when both are null.
            'goals' => $read('SELECT id, name, status, deadline, area_id, parent_goal_id FROM goals WHERE user_id = :user AND archived_at IS NULL ORDER BY updated_at DESC LIMIT 50'),
            'milestones' => $read('SELECT m.id, m.goal_id, m.name, m.status, m.deadline FROM milestones m JOIN goals g ON g.id = m.goal_id AND g.user_id = m.user_id AND g.archived_at IS NULL WHERE m.user_id = :user AND m.archived_at IS NULL ORDER BY g.updated_at DESC, m.goal_id, m.position, m.id LIMIT 100'),
            'open_tasks' => $read("SELECT id, name, status, deadline, importance, goal_id, milestone_id FROM tasks WHERE user_id = :user AND archived_at IS NULL AND status <> 'Done' ORDER BY deadline IS NULL, deadline, updated_at DESC LIMIT 100"),
            'recent_notes' => $read('SELECT id, title FROM notes WHERE user_id = :user AND deleted_at IS NULL ORDER BY updated_at DESC LIMIT 30'),
            'habits' => $read('SELECT id, name, period, target_frequency FROM habits WHERE user_id = :user AND archived_at IS NULL ORDER BY position LIMIT 50'),
        ];
    }

    /** The user's preferred time zone, used for new Habits and "today" check-ins. */
    public function timezone(int $userId): string
    {
        $statement = $this->pdo->prepare('SELECT timezone FROM user_preferences WHERE user_id = :user');
        $statement->execute(['user' => $userId]);
        $timezone = $statement->fetchColumn();

        return is_string($timezone) && $timezone !== '' ? $timezone : 'UTC';
    }

    /** @return list<array<string,mixed>> owner-only, non-archived Goals matching the text */
    public function searchGoals(int $userId, string $query, bool $includeCompleted): array
    {
        $statement = $this->pdo->prepare(
            'SELECT id, name, status, deadline, importance, area_id, parent_goal_id FROM goals WHERE user_id = :user AND archived_at IS NULL'
            .($includeCompleted ? '' : " AND status <> 'Completed'")
            .($query === '' ? '' : ' AND (name LIKE :name OR description LIKE :description)')
            .' ORDER BY updated_at DESC LIMIT 30',
        );
        $statement->execute(['user' => $userId, ...$this->likeParameters($query, ['name', 'description'])]);

        return $statement->fetchAll();
    }

    /** @return list<array<string,mixed>> owner-only, non-archived Habits matching the text */
    public function searchHabits(int $userId, string $query): array
    {
        $statement = $this->pdo->prepare(
            'SELECT id, name, period, target_frequency, importance, primary_goal_id FROM habits WHERE user_id = :user AND archived_at IS NULL'
            .($query === '' ? '' : ' AND (name LIKE :name OR description LIKE :description)')
            .' ORDER BY position LIMIT 30',
        );
        $statement->execute(['user' => $userId, ...$this->likeParameters($query, ['name', 'description'])]);

        return $statement->fetchAll();
    }

    /** @return list<array<string,mixed>> owner-only, non-archived Tasks matching the text */
    public function searchTasks(int $userId, string $query, bool $includeDone): array
    {
        $statement = $this->pdo->prepare(
            'SELECT id, name, status, start_date, deadline, scheduled_start, scheduled_end, importance FROM tasks WHERE user_id = :user AND archived_at IS NULL'
            .($includeDone ? '' : " AND status <> 'Done'")
            .($query === '' ? '' : ' AND (name LIKE :name OR description LIKE :description)')
            .' ORDER BY deadline IS NULL, deadline, updated_at DESC LIMIT 30',
        );
        $statement->execute(['user' => $userId, ...$this->likeParameters($query, ['name', 'description'])]);

        return $statement->fetchAll();
    }

    /** @param list<string> $names @return array<string,string> */
    private function likeParameters(string $query, array $names): array
    {
        if ($query === '') {
            return [];
        }
        $like = '%'.addcslashes($query, '%_\\').'%';

        return array_fill_keys($names, $like);
    }

    /** @return list<array<string,mixed>> owner-only, non-deleted Notes matching the text */
    public function searchNotes(int $userId, string $query): array
    {
        $statement = $this->pdo->prepare(
            // Password-protected Notes are invisible to the assistant.
            'SELECT id, title, LEFT(content, 200) AS excerpt FROM notes WHERE user_id = :user AND deleted_at IS NULL AND lock_hash IS NULL'
            .($query === '' ? '' : ' AND (title LIKE :title OR content LIKE :content)')
            .' ORDER BY updated_at DESC LIMIT 30',
        );
        $statement->execute(['user' => $userId, ...$this->likeParameters($query, ['title', 'content'])]);

        return $statement->fetchAll();
    }
}
