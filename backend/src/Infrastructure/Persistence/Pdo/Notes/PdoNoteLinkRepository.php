<?php

declare(strict_types=1);

namespace Planner\Infrastructure\Persistence\Pdo\Notes;

use PDO;

/** Owner-scoped links from Notes to one Goal or one Task (note_links). */
final readonly class PdoNoteLinkRepository
{
    public function __construct(private PDO $pdo)
    {
    }

    /** Inserts or replaces the Note's link; exactly one of $goalId and $taskId is set. */
    public function save(int $userId, string $noteId, ?string $goalId, ?string $taskId, string $now): void
    {
        $statement = $this->pdo->prepare(<<<'SQL'
INSERT INTO note_links (user_id, note_id, goal_id, task_id, created_at, updated_at)
VALUES (:user_id, :note_id, :goal_id, :task_id, :created_at, :updated_at)
ON DUPLICATE KEY UPDATE goal_id = VALUES(goal_id), task_id = VALUES(task_id), updated_at = VALUES(updated_at)
SQL);
        $statement->execute(['user_id' => $userId, 'note_id' => $noteId, 'goal_id' => $goalId, 'task_id' => $taskId, 'created_at' => $now, 'updated_at' => $now]);
    }

    public function delete(int $userId, string $noteId): void
    {
        $statement = $this->pdo->prepare('DELETE FROM note_links WHERE user_id = :user_id AND note_id = :note_id');
        $statement->execute(['user_id' => $userId, 'note_id' => $noteId]);
    }

    /**
     * Links of the given Notes with the target's name; archived targets are omitted so a Note
     * never points at work the user no longer sees.
     *
     * @param list<string> $noteIds
     * @return array<string, array{type:string,id:string,name:string}>
     */
    public function forNotes(int $userId, array $noteIds): array
    {
        if ($noteIds === []) {
            return [];
        }
        $placeholders = implode(', ', array_fill(0, count($noteIds), '?'));
        $statement = $this->pdo->prepare(<<<SQL
SELECT l.note_id, l.goal_id, l.task_id, g.name AS goal_name, t.name AS task_name
FROM note_links l
LEFT JOIN goals g ON g.user_id = l.user_id AND g.id = l.goal_id AND g.archived_at IS NULL
LEFT JOIN tasks t ON t.user_id = l.user_id AND t.id = l.task_id AND t.archived_at IS NULL
WHERE l.user_id = ? AND l.note_id IN ($placeholders)
SQL);
        $statement->execute([$userId, ...$noteIds]);
        $links = [];
        foreach ($statement->fetchAll() as $row) {
            if ($row['goal_id'] !== null && $row['goal_name'] !== null) {
                $links[(string) $row['note_id']] = ['type' => 'goal', 'id' => (string) $row['goal_id'], 'name' => (string) $row['goal_name']];
            } elseif ($row['task_id'] !== null && $row['task_name'] !== null) {
                $links[(string) $row['note_id']] = ['type' => 'task', 'id' => (string) $row['task_id'], 'name' => (string) $row['task_name']];
            }
        }

        return $links;
    }

    /**
     * Active Notes linked to one Goal or Task, most recently updated first.
     *
     * @return list<array{id:string,title:string,content:string,color:string,updated_at:string}>
     */
    public function notesFor(int $userId, string $type, string $targetId): array
    {
        $column = $type === 'goal' ? 'goal_id' : 'task_id';
        $statement = $this->pdo->prepare(<<<SQL
SELECT n.id, n.title, n.content, n.color, n.updated_at
FROM note_links l
JOIN notes n ON n.user_id = l.user_id AND n.id = l.note_id AND n.deleted_at IS NULL
WHERE l.user_id = :user_id AND l.$column = :target_id
ORDER BY n.updated_at DESC, n.id
LIMIT 50
SQL);
        $statement->execute(['user_id' => $userId, 'target_id' => $targetId]);

        return $statement->fetchAll();
    }
}
