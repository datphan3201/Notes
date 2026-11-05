<?php

declare(strict_types=1);

namespace Planner\Infrastructure\Persistence\Pdo\Planning;

use PDO;

/** Reads and restores archived Areas, Goals, Milestones, Tasks and Habits of one owner. */
final readonly class PdoArchiveRepository
{
    /** Archived rows per type are capped; the Archive page lists the most recent. */
    public const LIMIT = 500;
    private const TABLES = ['area' => 'areas', 'goal' => 'goals', 'milestone' => 'milestones', 'task' => 'tasks', 'habit' => 'habits'];
    private const COLUMNS = [
        'area' => 'id, name, archived_at, version, NULL AS status',
        'goal' => 'id, name, archived_at, version, status, area_id, parent_goal_id',
        'milestone' => 'id, name, archived_at, version, status, goal_id',
        'task' => 'id, name, archived_at, version, status, goal_id, milestone_id',
        'habit' => 'id, name, archived_at, version, NULL AS status, primary_goal_id',
    ];

    public function __construct(private PDO $pdo)
    {
    }

    /** @return list<array<string,mixed>> archived rows of $type, newest first */
    public function archived(string $type, int $userId, ?int $limit = self::LIMIT): array
    {
        $statement = $this->pdo->prepare('SELECT '.self::COLUMNS[$type].' FROM '.self::TABLES[$type]
            .' WHERE user_id = :user_id AND archived_at IS NOT NULL ORDER BY archived_at DESC, id'.($limit === null ? '' : ' LIMIT '.$limit));
        $statement->execute(['user_id' => $userId]);

        return $statement->fetchAll();
    }

    /** @return array<string,array{name:string,archived_at:?string}> every row of $type by id, archived or not */
    public function names(string $type, int $userId): array
    {
        $statement = $this->pdo->prepare('SELECT id, name, archived_at FROM '.self::TABLES[$type].' WHERE user_id = :user_id');
        $statement->execute(['user_id' => $userId]);
        $names = [];
        foreach ($statement->fetchAll() as $row) {
            $names[(string) $row['id']] = ['name' => (string) $row['name'], 'archived_at' => $row['archived_at']];
        }

        return $names;
    }

    /** @return array<string,mixed>|null the row, archived or not */
    public function find(string $type, int $userId, string $id, bool $forUpdate = false): ?array
    {
        $statement = $this->pdo->prepare('SELECT '.self::COLUMNS[$type].' FROM '.self::TABLES[$type]
            .' WHERE user_id = :user_id AND id = :id'.($forUpdate ? ' FOR UPDATE' : ''));
        $statement->execute(['user_id' => $userId, 'id' => $id]);
        $row = $statement->fetch();

        return is_array($row) ? $row : null;
    }

    public function activeCount(string $type, int $userId): int
    {
        $statement = $this->pdo->prepare('SELECT COUNT(*) FROM '.self::TABLES[$type].' WHERE user_id = :user_id AND archived_at IS NULL');
        $statement->execute(['user_id' => $userId]);

        return (int) $statement->fetchColumn();
    }

    public function restore(string $type, int $userId, string $id, string $timestamp): void
    {
        $statement = $this->pdo->prepare('UPDATE '.self::TABLES[$type]
            .' SET archived_at = NULL, version = version + 1, updated_at = :updated_at WHERE user_id = :user_id AND id = :id AND archived_at IS NOT NULL');
        $statement->execute(['updated_at' => $timestamp, 'user_id' => $userId, 'id' => $id]);
    }
}
