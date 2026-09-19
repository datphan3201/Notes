<?php

declare(strict_types=1);

namespace Planner\Infrastructure\Persistence\Pdo\Files;

use PDO;

final readonly class PendingDeletionRepository
{
    public function __construct(private PDO $pdo) {}

    public function queue(?int $userId, string $path, string $timestamp): void
    {
        $statement = $this->pdo->prepare(<<<'SQL'
INSERT INTO pending_file_deletions (user_id, path, attempts, created_at, updated_at)
VALUES (:user_id, :path, 0, :created_at, :updated_at)
ON DUPLICATE KEY UPDATE path = VALUES(path)
SQL);
        $statement->execute([
            'user_id' => $userId,
            'path' => $path,
            'created_at' => $timestamp,
            'updated_at' => $timestamp,
        ]);
    }

    /** @param list<string> $paths @return list<array{id:int,path:string,attempts:int}> */
    public function pending(array $paths = []): array
    {
        $bindings = [];
        $where = '';

        if ($paths !== []) {
            $where = ' WHERE path IN ('.implode(', ', array_fill(0, count($paths), '?')).')';
            $bindings = $paths;
        }

        $statement = $this->pdo->prepare('SELECT id, path, attempts FROM pending_file_deletions'.$where.' ORDER BY id');
        $statement->execute($bindings);

        return array_map(static fn (array $row): array => [
            'id' => (int) $row['id'],
            'path' => (string) $row['path'],
            'attempts' => (int) $row['attempts'],
        ], $statement->fetchAll());
    }

    public function completed(int $id): void
    {
        $statement = $this->pdo->prepare('DELETE FROM pending_file_deletions WHERE id = :id');
        $statement->execute(['id' => $id]);
    }

    public function failed(int $id, string $timestamp): void
    {
        $statement = $this->pdo->prepare(<<<'SQL'
UPDATE pending_file_deletions
SET attempts = attempts + 1, updated_at = :updated_at
WHERE id = :id
SQL);
        $statement->execute(['updated_at' => $timestamp, 'id' => $id]);
    }
}
