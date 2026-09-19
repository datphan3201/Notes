<?php

declare(strict_types=1);

namespace Planner\Infrastructure\Persistence\Pdo\Tags;

use PDO;
use Planner\Domain\Tags\TagRecord;

final readonly class PdoTagRepository
{
    public function __construct(private PDO $pdo) {}

    /** @return list<TagRecord> */
    public function listForOwner(int $userId): array
    {
        $statement = $this->pdo->prepare(
            'SELECT * FROM labels WHERE user_id = :user_id AND archived_at IS NULL ORDER BY position, name, id',
        );
        $statement->execute(['user_id' => $userId]);

        return array_map($this->hydrate(...), $statement->fetchAll());
    }

    public function countForOwner(int $userId): int
    {
        $statement = $this->pdo->prepare('SELECT COUNT(*) FROM labels WHERE user_id = :user_id AND archived_at IS NULL');
        $statement->execute(['user_id' => $userId]);

        return (int) $statement->fetchColumn();
    }

    public function findOwned(int $userId, int $labelId, bool $forUpdate = false): ?TagRecord
    {
        $statement = $this->pdo->prepare(
            'SELECT * FROM labels WHERE user_id = :user_id AND id = :id AND archived_at IS NULL LIMIT 1'.($forUpdate ? ' FOR UPDATE' : ''),
        );
        $statement->execute(['user_id' => $userId, 'id' => $labelId]);
        $row = $statement->fetch();

        return is_array($row) ? $this->hydrate($row) : null;
    }

    /**
     * Locks requested labels in stable ID order and returns only owner-visible IDs.
     *
     * @param  list<int>  $labelIds
     * @return list<int>
     */
    public function lockOwnedIds(int $userId, array $labelIds): array
    {
        if ($labelIds === []) {
            return [];
        }

        sort($labelIds, SORT_NUMERIC);
        $placeholders = implode(', ', array_fill(0, count($labelIds), '?'));
        $statement = $this->pdo->prepare(
            "SELECT id FROM labels WHERE user_id = ? AND archived_at IS NULL AND id IN ($placeholders) ORDER BY id FOR UPDATE",
        );
        $statement->execute([$userId, ...$labelIds]);

        return array_map('intval', $statement->fetchAll(PDO::FETCH_COLUMN));
    }

    /** @param list<int> $labelIds @return list<int> */
    public function ownedIds(int $userId, array $labelIds): array
    {
        if ($labelIds === []) {
            return [];
        }

        sort($labelIds, SORT_NUMERIC);
        $placeholders = implode(', ', array_fill(0, count($labelIds), '?'));
        $statement = $this->pdo->prepare(
            "SELECT id FROM labels WHERE user_id = ? AND archived_at IS NULL AND id IN ($placeholders) ORDER BY id",
        );
        $statement->execute([$userId, ...$labelIds]);

        return array_map('intval', $statement->fetchAll(PDO::FETCH_COLUMN));
    }

    public function insert(int $userId, string $name, string $timestamp): TagRecord
    {
        $statement = $this->pdo->prepare(<<<'SQL'
INSERT INTO labels (user_id, name, version, created_at, updated_at)
VALUES (:user_id, :name, 1, :created_at, :updated_at)
SQL);
        $statement->execute([
            'user_id' => $userId,
            'name' => $name,
            'created_at' => $timestamp,
            'updated_at' => $timestamp,
        ]);

        return $this->findOwned($userId, (int) $this->pdo->lastInsertId())
            ?? throw new \RuntimeException('Created label could not be reloaded.');
    }

    public function insertTag(
        int $userId,
        string $name,
        ?int $parentId,
        string $color,
        int $position,
        string $timestamp,
    ): TagRecord {
        $statement = $this->pdo->prepare(<<<'SQL'
INSERT INTO labels (user_id, parent_id, name, color, position, version, created_at, updated_at)
VALUES (:user_id, :parent_id, :name, :color, :position, 1, :created_at, :updated_at)
SQL);
        $statement->execute([
            'user_id' => $userId,
            'parent_id' => $parentId,
            'name' => $name,
            'color' => $color,
            'position' => $position,
            'created_at' => $timestamp,
            'updated_at' => $timestamp,
        ]);

        return $this->findOwned($userId, (int) $this->pdo->lastInsertId())
            ?? throw new \RuntimeException('Created Tag could not be reloaded.');
    }

    public function rename(int $userId, int $labelId, string $name, int $version, string $timestamp): TagRecord
    {
        $statement = $this->pdo->prepare(<<<'SQL'
UPDATE labels
SET name = :name, version = :version, updated_at = :updated_at
WHERE user_id = :user_id AND id = :id
SQL);
        $statement->execute([
            'name' => $name,
            'version' => $version,
            'updated_at' => $timestamp,
            'user_id' => $userId,
            'id' => $labelId,
        ]);

        return $this->findOwned($userId, $labelId)
            ?? throw new \RuntimeException('Updated label could not be reloaded.');
    }

    /** @return list<string> */
    public function attachedNoteIds(int $userId, int $labelId): array
    {
        $statement = $this->pdo->prepare(<<<'SQL'
SELECT note_id
FROM label_note
WHERE user_id = :user_id AND label_id = :label_id
ORDER BY note_id
SQL);
        $statement->execute(['user_id' => $userId, 'label_id' => $labelId]);

        return array_values(array_map('strval', $statement->fetchAll(PDO::FETCH_COLUMN)));
    }

    /** @return list<string> */
    public function lockAttachedNoteIds(int $userId, int $labelId): array
    {
        $statement = $this->pdo->prepare(<<<'SQL'
SELECT note_id
FROM label_note
WHERE user_id = :user_id AND label_id = :label_id
ORDER BY note_id
FOR UPDATE
SQL);
        $statement->execute(['user_id' => $userId, 'label_id' => $labelId]);

        return array_values(array_map('strval', $statement->fetchAll(PDO::FETCH_COLUMN)));
    }

    public function delete(int $userId, int $labelId): void
    {
        $statement = $this->pdo->prepare('DELETE FROM labels WHERE user_id = :user_id AND id = :id');
        $statement->execute(['user_id' => $userId, 'id' => $labelId]);
    }

    public function updateTag(
        int $userId,
        int $tagId,
        string $name,
        ?int $parentId,
        string $color,
        int $position,
        int $version,
        string $timestamp,
    ): TagRecord {
        $statement = $this->pdo->prepare(<<<'SQL'
UPDATE labels
SET name = :name, parent_id = :parent_id, color = :color, position = :position,
    version = :version, updated_at = :updated_at
WHERE user_id = :user_id AND id = :id AND archived_at IS NULL
SQL);
        $statement->execute([
            'name' => $name,
            'parent_id' => $parentId,
            'color' => $color,
            'position' => $position,
            'version' => $version,
            'updated_at' => $timestamp,
            'user_id' => $userId,
            'id' => $tagId,
        ]);

        return $this->findOwned($userId, $tagId)
            ?? throw new \RuntimeException('Updated Tag could not be reloaded.');
    }

    public function archiveTag(int $userId, int $tagId, int $version, string $timestamp): void
    {
        $statement = $this->pdo->prepare(<<<'SQL'
UPDATE labels SET archived_at = :archived_at, version = :version, updated_at = :updated_at
WHERE user_id = :user_id AND id = :id AND archived_at IS NULL
SQL);
        $statement->execute([
            'archived_at' => $timestamp,
            'version' => $version,
            'updated_at' => $timestamp,
            'user_id' => $userId,
            'id' => $tagId,
        ]);
    }

    public function activeChildCount(int $userId, int $tagId): int
    {
        $statement = $this->pdo->prepare(
            'SELECT COUNT(*) FROM labels WHERE user_id = :user_id AND parent_id = :parent_id AND archived_at IS NULL',
        );
        $statement->execute(['user_id' => $userId, 'parent_id' => $tagId]);

        return (int) $statement->fetchColumn();
    }

    /** @return list<array{0: string, 1: string}> */
    public function hierarchyEdges(int $userId): array
    {
        $statement = $this->pdo->prepare(
            'SELECT id, parent_id FROM labels WHERE user_id = :user_id AND archived_at IS NULL AND parent_id IS NOT NULL ORDER BY id',
        );
        $statement->execute(['user_id' => $userId]);

        return array_map(
            static fn (array $row): array => [(string) $row['id'], (string) $row['parent_id']],
            $statement->fetchAll(),
        );
    }

    /** @param array<string, mixed> $row */
    private function hydrate(array $row): TagRecord
    {
        return new TagRecord(
            (int) $row['id'],
            (int) $row['user_id'],
            (string) $row['name'],
            (int) $row['version'],
            (string) $row['created_at'],
            (string) $row['updated_at'],
            $row['parent_id'] === null ? null : (int) $row['parent_id'],
            (string) $row['color'],
            (int) $row['position'],
            $row['archived_at'] === null ? null : (string) $row['archived_at'],
        );
    }
}
