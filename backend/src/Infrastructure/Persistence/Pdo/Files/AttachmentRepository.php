<?php

declare(strict_types=1);

namespace Planner\Infrastructure\Persistence\Pdo\Files;

use PDO;
use Planner\Domain\Files\AttachmentRecord;
use Planner\Domain\Files\InspectedUpload;

final readonly class AttachmentRepository
{
    public function __construct(private PDO $pdo) {}

    /** @return list<AttachmentRecord> */
    public function listForActiveNote(int $userId, string $noteId): array
    {
        $statement = $this->pdo->prepare(<<<'SQL'
SELECT a.*
FROM attachments a
JOIN notes n ON n.user_id = a.user_id AND n.id = a.note_id
WHERE a.user_id = :user_id AND a.note_id = :note_id
  AND a.deleted_at IS NULL AND n.deleted_at IS NULL
ORDER BY a.created_at, a.id
SQL);
        $statement->execute(['user_id' => $userId, 'note_id' => $noteId]);

        return array_map($this->hydrate(...), $statement->fetchAll());
    }

    public function findById(string $attachmentId, bool $forUpdate = false): ?AttachmentRecord
    {
        $statement = $this->pdo->prepare(
            'SELECT * FROM attachments WHERE id = :id LIMIT 1'.($forUpdate ? ' FOR UPDATE' : ''),
        );
        $statement->execute(['id' => $attachmentId]);
        $row = $statement->fetch();

        return is_array($row) ? $this->hydrate($row) : null;
    }

    public function findOwnedForNote(
        int $userId,
        string $noteId,
        string $attachmentId,
        bool $forUpdate = false,
    ): ?AttachmentRecord {
        $statement = $this->pdo->prepare(<<<'SQL'
SELECT *
FROM attachments
WHERE user_id = :user_id AND note_id = :note_id AND id = :id
LIMIT 1
SQL.($forUpdate ? ' FOR UPDATE' : ''));
        $statement->execute(['user_id' => $userId, 'note_id' => $noteId, 'id' => $attachmentId]);
        $row = $statement->fetch();

        return is_array($row) ? $this->hydrate($row) : null;
    }

    public function findAuthorizedActive(int $userId, string $attachmentId): ?AttachmentRecord
    {
        $statement = $this->pdo->prepare(<<<'SQL'
SELECT a.*
FROM attachments a
JOIN notes n ON n.user_id = a.user_id AND n.id = a.note_id
WHERE a.user_id = :user_id AND a.id = :id
  AND a.deleted_at IS NULL AND n.deleted_at IS NULL
LIMIT 1
SQL);
        $statement->execute(['user_id' => $userId, 'id' => $attachmentId]);
        $row = $statement->fetch();

        return is_array($row) ? $this->hydrate($row) : null;
    }

    /** @return array{count:int,size:int} */
    public function lockActiveQuota(int $userId, string $noteId): array
    {
        $statement = $this->pdo->prepare(<<<'SQL'
SELECT id, size_bytes
FROM attachments
WHERE user_id = :user_id AND note_id = :note_id AND deleted_at IS NULL
ORDER BY id
FOR UPDATE
SQL);
        $statement->execute(['user_id' => $userId, 'note_id' => $noteId]);
        $rows = $statement->fetchAll();

        return [
            'count' => count($rows),
            'size' => array_sum(array_map(static fn (array $row): int => (int) $row['size_bytes'], $rows)),
        ];
    }

    public function insert(
        string $attachmentId,
        int $userId,
        string $noteId,
        InspectedUpload $upload,
        string $path,
        string $timestamp,
    ): AttachmentRecord {
        $statement = $this->pdo->prepare(<<<'SQL'
INSERT INTO attachments
    (id, user_id, note_id, original_name, path, mime_type, kind, size_bytes, sha256, created_at, updated_at)
VALUES
    (:id, :user_id, :note_id, :original_name, :path, :mime_type, :kind, :size_bytes, :sha256, :created_at, :updated_at)
SQL);
        $statement->execute([
            'id' => $attachmentId,
            'user_id' => $userId,
            'note_id' => $noteId,
            'original_name' => $upload->originalName,
            'path' => $path,
            'mime_type' => $upload->mimeType,
            'kind' => $upload->kind,
            'size_bytes' => $upload->size,
            'sha256' => $upload->sha256,
            'created_at' => $timestamp,
            'updated_at' => $timestamp,
        ]);

        return $this->findOwnedForNote($userId, $noteId, $attachmentId)
            ?? throw new \RuntimeException('Created attachment could not be reloaded.');
    }

    public function tombstone(int $userId, string $attachmentId, string $timestamp): void
    {
        $statement = $this->pdo->prepare(<<<'SQL'
UPDATE attachments
SET original_name = '', path = NULL, mime_type = '', kind = 'file', size_bytes = 0,
    sha256 = NULL, deleted_at = :deleted_at, updated_at = :updated_at
WHERE user_id = :user_id AND id = :id AND deleted_at IS NULL
SQL);
        $statement->execute(['deleted_at' => $timestamp, 'updated_at' => $timestamp, 'user_id' => $userId, 'id' => $attachmentId]);
    }

    /** @return list<string> */
    public function referencedPaths(): array
    {
        return array_values(array_map('strval', $this->pdo->query(
            'SELECT path FROM attachments WHERE path IS NOT NULL',
        )->fetchAll(PDO::FETCH_COLUMN)));
    }

    /** @param array<string, mixed> $row */
    private function hydrate(array $row): AttachmentRecord
    {
        return new AttachmentRecord(
            (string) $row['id'],
            (int) $row['user_id'],
            (string) $row['note_id'],
            (string) $row['original_name'],
            $row['path'] === null ? null : (string) $row['path'],
            (string) $row['mime_type'],
            (string) $row['kind'],
            (int) $row['size_bytes'],
            $row['sha256'] === null ? null : (string) $row['sha256'],
            $row['deleted_at'] === null ? null : (string) $row['deleted_at'],
            (string) $row['created_at'],
            (string) $row['updated_at'],
        );
    }
}
