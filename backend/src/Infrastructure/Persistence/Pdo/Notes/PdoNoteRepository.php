<?php

declare(strict_types=1);

namespace Planner\Infrastructure\Persistence\Pdo\Notes;

use PDO;
use Planner\Domain\Notes\NoteRecord;
use Planner\Domain\Tags\TagRecord;

final readonly class PdoNoteRepository
{
    public function __construct(private PDO $pdo) {}

    public function findById(string $noteId, bool $forUpdate = false): ?NoteRecord
    {
        $statement = $this->pdo->prepare(
            'SELECT * FROM notes WHERE id = :id LIMIT 1'.($forUpdate ? ' FOR UPDATE' : ''),
        );
        $statement->execute(['id' => $noteId]);
        $row = $statement->fetch();

        return is_array($row) ? $this->hydrateOne($row) : null;
    }

    public function findOwned(int $userId, string $noteId, bool $includeDeleted = false, bool $forUpdate = false): ?NoteRecord
    {
        $sql = 'SELECT * FROM notes WHERE user_id = :user_id AND id = :id';

        if (! $includeDeleted) {
            $sql .= ' AND deleted_at IS NULL';
        }

        $sql .= ' LIMIT 1'.($forUpdate ? ' FOR UPDATE' : '');
        $statement = $this->pdo->prepare($sql);
        $statement->execute(['user_id' => $userId, 'id' => $noteId]);
        $row = $statement->fetch();

        return is_array($row) ? $this->hydrateOne($row) : null;
    }

    /**
     * @param  list<int>  $labelIds
     * @return array{items:list<NoteRecord>,total:int,current_page:int,per_page:int,last_page:int}
     */
    public function paginate(int $userId, string $query, array $labelIds, int $page, int $perPage = 30): array
    {
        $where = ['n.user_id = :user_id', 'n.deleted_at IS NULL'];
        $bindings = ['user_id' => $userId];

        if ($query !== '') {
            $escaped = str_replace(['!', '%', '_'], ['!!', '!%', '!_'], $query);
            // Native PDO prepares cannot reuse one named placeholder twice.
            $where[] = "(n.title LIKE :query_title ESCAPE '!' OR n.content LIKE :query_content ESCAPE '!')";
            $bindings['query_title'] = '%'.$escaped.'%';
            $bindings['query_content'] = '%'.$escaped.'%';
        }

        if ($labelIds !== []) {
            $in = [];

            foreach ($labelIds as $index => $labelId) {
                $key = 'label_'.$index;
                $in[] = ':'.$key;
                $bindings[$key] = $labelId;
            }

            $where[] = 'EXISTS (SELECT 1 FROM label_note ln WHERE ln.user_id = n.user_id AND ln.note_id = n.id AND ln.label_id IN ('.implode(', ', $in).'))';
        }

        $predicate = implode(' AND ', $where);
        $count = $this->pdo->prepare("SELECT COUNT(*) FROM notes n WHERE $predicate");
        $count->execute($bindings);
        $total = (int) $count->fetchColumn();
        $offset = ($page - 1) * $perPage;
        $select = $this->pdo->prepare(<<<SQL
SELECT n.*
FROM notes n
WHERE $predicate
ORDER BY (n.pinned_at IS NULL) ASC, n.pinned_at DESC, n.updated_at DESC, n.id DESC
LIMIT :limit OFFSET :offset
SQL);

        foreach ($bindings as $key => $value) {
            $select->bindValue(':'.$key, $value, is_int($value) ? PDO::PARAM_INT : PDO::PARAM_STR);
        }

        $select->bindValue(':limit', $perPage, PDO::PARAM_INT);
        $select->bindValue(':offset', $offset, PDO::PARAM_INT);
        $select->execute();
        $rows = $select->fetchAll();
        $noteIds = array_map(static fn (array $row): string => (string) $row['id'], $rows);
        $labelsByNote = $this->labelsForNotes($userId, $noteIds);
        $countsByNote = $this->attachmentCounts($userId, $noteIds);
        $items = [];

        foreach ($rows as $row) {
            $id = (string) $row['id'];
            $items[] = $this->hydrate(
                $row,
                $labelsByNote[$id] ?? [],
                [],
                $countsByNote[$id] ?? 0,
            );
        }

        return [
            'items' => $items,
            'total' => $total,
            'current_page' => $page,
            'per_page' => $perPage,
            'last_page' => max(1, (int) ceil($total / $perPage)),
        ];
    }

    public function insert(
        string $noteId,
        int $userId,
        string $title,
        string $content,
        string $color,
        string $timestamp,
    ): NoteRecord {
        $statement = $this->pdo->prepare(<<<'SQL'
INSERT INTO notes (id, user_id, title, content, color, version, created_at, updated_at)
VALUES (:id, :user_id, :title, :content, :color, 1, :created_at, :updated_at)
SQL);
        $statement->execute([
            'id' => $noteId,
            'user_id' => $userId,
            'title' => $title,
            'content' => $content,
            'color' => $color,
            'created_at' => $timestamp,
            'updated_at' => $timestamp,
        ]);

        return $this->findOwned($userId, $noteId)
            ?? throw new \RuntimeException('Created note could not be reloaded.');
    }

    /** @param list<int> $labelIds */
    public function updateSnapshot(
        int $userId,
        string $noteId,
        string $title,
        string $content,
        string $color,
        ?string $pinnedAt,
        int $version,
        string $timestamp,
        array $labelIds,
    ): NoteRecord {
        $statement = $this->pdo->prepare(<<<'SQL'
UPDATE notes
SET title = :title, content = :content, color = :color, pinned_at = :pinned_at,
    version = :version, updated_at = :updated_at
WHERE user_id = :user_id AND id = :id AND deleted_at IS NULL
SQL);
        $statement->execute([
            'title' => $title,
            'content' => $content,
            'color' => $color,
            'pinned_at' => $pinnedAt,
            'version' => $version,
            'updated_at' => $timestamp,
            'user_id' => $userId,
            'id' => $noteId,
        ]);

        $delete = $this->pdo->prepare('DELETE FROM label_note WHERE user_id = :user_id AND note_id = :note_id');
        $delete->execute(['user_id' => $userId, 'note_id' => $noteId]);

        if ($labelIds !== []) {
            $insert = $this->pdo->prepare(
                'INSERT INTO label_note (user_id, note_id, label_id) VALUES (:user_id, :note_id, :label_id)',
            );

            foreach ($labelIds as $labelId) {
                $insert->execute(['user_id' => $userId, 'note_id' => $noteId, 'label_id' => $labelId]);
            }
        }

        return $this->findOwned($userId, $noteId)
            ?? throw new \RuntimeException('Updated note could not be reloaded.');
    }

    /** @return list<string> */
    public function tombstone(int $userId, string $noteId, int $version, string $timestamp): array
    {
        $attachmentRows = $this->lockActiveAttachmentRows($userId, $noteId);
        $paths = [];
        $queue = $this->pdo->prepare(<<<'SQL'
INSERT INTO pending_file_deletions (user_id, path, attempts, created_at, updated_at)
VALUES (:user_id, :path, 0, :created_at, :updated_at)
ON DUPLICATE KEY UPDATE path = VALUES(path)
SQL);
        $scrubAttachment = $this->pdo->prepare(<<<'SQL'
UPDATE attachments
SET original_name = '', path = NULL, mime_type = '', kind = 'file', size_bytes = 0,
    sha256 = NULL, deleted_at = :deleted_at, updated_at = :updated_at
WHERE user_id = :user_id AND id = :id
SQL);

        foreach ($attachmentRows as $attachment) {
            $path = $attachment['path'];

            if (is_string($path) && $path !== '') {
                $paths[] = $path;
                $queue->execute([
                    'user_id' => $userId,
                    'path' => $path,
                    'created_at' => $timestamp,
                    'updated_at' => $timestamp,
                ]);
            }

            $scrubAttachment->execute([
                'deleted_at' => $timestamp,
                'updated_at' => $timestamp,
                'user_id' => $userId,
                'id' => $attachment['id'],
            ]);
        }

        $detach = $this->pdo->prepare('DELETE FROM label_note WHERE user_id = :user_id AND note_id = :note_id');
        $detach->execute(['user_id' => $userId, 'note_id' => $noteId]);
        $note = $this->pdo->prepare(<<<'SQL'
UPDATE notes
SET title = '', content = '', color = 'neutral', pinned_at = NULL,
    version = :version, deleted_at = :deleted_at, updated_at = :updated_at
WHERE user_id = :user_id AND id = :id AND deleted_at IS NULL
SQL);
        $note->execute([
            'version' => $version,
            'deleted_at' => $timestamp,
            'updated_at' => $timestamp,
            'user_id' => $userId,
            'id' => $noteId,
        ]);

        return $paths;
    }

    /** @param list<string> $noteIds */
    public function lockNotes(int $userId, array $noteIds): void
    {
        if ($noteIds === []) {
            return;
        }

        sort($noteIds, SORT_STRING);
        $placeholders = implode(', ', array_fill(0, count($noteIds), '?'));
        $statement = $this->pdo->prepare(
            "SELECT id FROM notes WHERE user_id = ? AND id IN ($placeholders) ORDER BY id FOR UPDATE",
        );
        $statement->execute([$userId, ...$noteIds]);
        $statement->fetchAll();
    }

    /** @param list<string> $noteIds */
    public function detachLabelAndTouchActiveNotes(
        int $userId,
        int $labelId,
        array $noteIds,
        string $timestamp,
    ): void {
        $detach = $this->pdo->prepare('DELETE FROM label_note WHERE user_id = :user_id AND label_id = :label_id');
        $detach->execute(['user_id' => $userId, 'label_id' => $labelId]);

        if ($noteIds === []) {
            return;
        }

        $placeholders = implode(', ', array_fill(0, count($noteIds), '?'));
        $update = $this->pdo->prepare(
            "UPDATE notes SET version = version + 1, updated_at = ? WHERE user_id = ? AND deleted_at IS NULL AND id IN ($placeholders)",
        );
        $update->execute([$timestamp, $userId, ...$noteIds]);
    }

    /** @return list<array{id:string,path:?string}> */
    private function lockActiveAttachmentRows(int $userId, string $noteId): array
    {
        $statement = $this->pdo->prepare(<<<'SQL'
SELECT id, path
FROM attachments
WHERE user_id = :user_id AND note_id = :note_id AND deleted_at IS NULL
ORDER BY id
FOR UPDATE
SQL);
        $statement->execute(['user_id' => $userId, 'note_id' => $noteId]);

        /** @var list<array{id:string,path:?string}> */
        return $statement->fetchAll();
    }

    private function hydrateOne(array $row): NoteRecord
    {
        $userId = (int) $row['user_id'];
        $noteId = (string) $row['id'];
        $labels = $this->labelsForNotes($userId, [$noteId])[$noteId] ?? [];
        $attachments = $this->attachmentsForNote($userId, $noteId);

        return $this->hydrate($row, $labels, $attachments, count($attachments));
    }

    /**
     * @param  list<string>  $noteIds
     * @return array<string, list<TagRecord>>
     */
    private function labelsForNotes(int $userId, array $noteIds): array
    {
        if ($noteIds === []) {
            return [];
        }

        $placeholders = implode(', ', array_fill(0, count($noteIds), '?'));
        $statement = $this->pdo->prepare(<<<SQL
SELECT ln.note_id, l.*
FROM label_note ln
JOIN labels l ON l.user_id = ln.user_id AND l.id = ln.label_id
WHERE ln.user_id = ? AND ln.note_id IN ($placeholders)
ORDER BY l.name, l.id
SQL);
        $statement->execute([$userId, ...$noteIds]);
        $result = [];

        foreach ($statement->fetchAll() as $row) {
            $noteId = (string) $row['note_id'];
            $result[$noteId][] = new TagRecord(
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

        return $result;
    }

    /** @param list<string> $noteIds @return array<string, int> */
    private function attachmentCounts(int $userId, array $noteIds): array
    {
        if ($noteIds === []) {
            return [];
        }

        $placeholders = implode(', ', array_fill(0, count($noteIds), '?'));
        $statement = $this->pdo->prepare(
            "SELECT note_id, COUNT(*) AS aggregate FROM attachments WHERE user_id = ? AND deleted_at IS NULL AND note_id IN ($placeholders) GROUP BY note_id",
        );
        $statement->execute([$userId, ...$noteIds]);
        $counts = [];

        foreach ($statement->fetchAll() as $row) {
            $counts[(string) $row['note_id']] = (int) $row['aggregate'];
        }

        return $counts;
    }

    /** @return list<array{id:string,original_name:string,mime_type:string,kind:string,size_bytes:int,created_at:string}> */
    private function attachmentsForNote(int $userId, string $noteId): array
    {
        $statement = $this->pdo->prepare(<<<'SQL'
SELECT id, original_name, mime_type, kind, size_bytes, created_at
FROM attachments
WHERE user_id = :user_id AND note_id = :note_id AND deleted_at IS NULL
ORDER BY created_at, id
SQL);
        $statement->execute(['user_id' => $userId, 'note_id' => $noteId]);

        return array_map(static fn (array $row): array => [
            'id' => (string) $row['id'],
            'original_name' => (string) $row['original_name'],
            'mime_type' => (string) $row['mime_type'],
            'kind' => (string) $row['kind'],
            'size_bytes' => (int) $row['size_bytes'],
            'created_at' => (string) $row['created_at'],
        ], $statement->fetchAll());
    }

    /**
     * @param  array<string, mixed>  $row
     * @param  list<TagRecord>  $labels
     * @param  list<array{id:string,original_name:string,mime_type:string,kind:string,size_bytes:int,created_at:string}>  $attachments
     */
    private function hydrate(array $row, array $labels, array $attachments, int $attachmentCount): NoteRecord
    {
        return new NoteRecord(
            (string) $row['id'],
            (int) $row['user_id'],
            (string) $row['title'],
            (string) $row['content'],
            (string) $row['color'],
            $row['pinned_at'] === null ? null : (string) $row['pinned_at'],
            (int) $row['version'],
            $row['deleted_at'] === null ? null : (string) $row['deleted_at'],
            (string) $row['created_at'],
            (string) $row['updated_at'],
            $labels,
            $attachments,
            $attachmentCount,
        );
    }
}
