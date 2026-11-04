<?php

declare(strict_types=1);

namespace Planner\Infrastructure\Persistence\Pdo\Notes;

use PDO;

/** Stored AI summaries, retrieval embeddings and the shared Notes a question may read. */
final readonly class PdoNoteAIRepository
{
    public function __construct(private PDO $pdo)
    {
    }

    /** @return array{summary:string,source_hash:string,model:string,generated_at:string}|null */
    public function summary(int $ownerId, string $noteId): ?array
    {
        $statement = $this->pdo->prepare('SELECT summary, source_hash, model, generated_at FROM note_summaries WHERE user_id = :user_id AND note_id = :note_id');
        $statement->execute(['user_id' => $ownerId, 'note_id' => $noteId]);
        $row = $statement->fetch();

        return is_array($row) ? [
            'summary' => (string) $row['summary'],
            'source_hash' => (string) $row['source_hash'],
            'model' => (string) $row['model'],
            'generated_at' => (string) $row['generated_at'],
        ] : null;
    }

    public function saveSummary(int $ownerId, string $noteId, string $summary, string $hash, string $model, string $now): void
    {
        $statement = $this->pdo->prepare(<<<'SQL'
INSERT INTO note_summaries (user_id, note_id, summary, source_hash, model, generated_at)
VALUES (:user_id, :note_id, :summary, :hash, :model, :generated_at)
ON DUPLICATE KEY UPDATE summary = VALUES(summary), source_hash = VALUES(source_hash),
    model = VALUES(model), generated_at = VALUES(generated_at)
SQL);
        $statement->execute([
            'user_id' => $ownerId, 'note_id' => $noteId, 'summary' => $summary,
            'hash' => $hash, 'model' => $model, 'generated_at' => $now,
        ]);
    }

    /**
     * @param list<array{owner_id:int,note_id:string}> $keys
     * @return array<string, array{source_hash:string,model:string,vector:list<float>}> keyed by note id
     */
    public function embeddings(array $keys): array
    {
        if ($keys === []) {
            return [];
        }
        $clauses = [];
        $bindings = [];
        foreach (array_values($keys) as $index => $key) {
            $clauses[] = "(user_id = :u$index AND note_id = :n$index)";
            $bindings["u$index"] = $key['owner_id'];
            $bindings["n$index"] = $key['note_id'];
        }
        $statement = $this->pdo->prepare('SELECT note_id, source_hash, model, vector FROM note_embeddings WHERE '.implode(' OR ', $clauses));
        $statement->execute($bindings);
        $result = [];
        foreach ($statement->fetchAll() as $row) {
            $vector = unpack('g*', (string) $row['vector']);
            $result[(string) $row['note_id']] = [
                'source_hash' => (string) $row['source_hash'],
                'model' => (string) $row['model'],
                'vector' => $vector === false ? [] : array_values(array_map('floatval', $vector)),
            ];
        }

        return $result;
    }

    /** @param list<float> $vector */
    public function saveEmbedding(int $ownerId, string $noteId, string $hash, string $model, array $vector, string $now): void
    {
        $statement = $this->pdo->prepare(<<<'SQL'
INSERT INTO note_embeddings (user_id, note_id, source_hash, model, vector, updated_at)
VALUES (:user_id, :note_id, :hash, :model, :vector, :updated_at)
ON DUPLICATE KEY UPDATE source_hash = VALUES(source_hash), model = VALUES(model),
    vector = VALUES(vector), updated_at = VALUES(updated_at)
SQL);
        $statement->bindValue(':user_id', $ownerId, PDO::PARAM_INT);
        $statement->bindValue(':note_id', $noteId);
        $statement->bindValue(':hash', $hash);
        $statement->bindValue(':model', $model);
        $statement->bindValue(':vector', pack('g*', ...$vector), PDO::PARAM_LOB);
        $statement->bindValue(':updated_at', $now);
        $statement->execute();
    }

    /**
     * Unlocked, live Notes other people shared with this user (accepted shares).
     *
     * @return list<array{id:string,owner_id:int,owner_name:string,title:string,content:string,version:int,updated_at:string}>
     */
    public function sharedWith(int $recipientId, int $limit): array
    {
        $statement = $this->pdo->prepare(<<<'SQL'
SELECT n.id, n.user_id AS owner_id, u.display_name AS owner_name, n.title, n.content, n.version, n.updated_at
FROM note_shares s
JOIN notes n ON n.user_id = s.owner_id AND n.id = s.note_id AND n.deleted_at IS NULL AND n.lock_hash IS NULL
JOIN users u ON u.id = s.owner_id
WHERE s.recipient_id = :recipient AND s.status = 'accepted'
ORDER BY n.updated_at DESC, n.id DESC
LIMIT :limit
SQL);
        $statement->bindValue(':recipient', $recipientId, PDO::PARAM_INT);
        $statement->bindValue(':limit', $limit, PDO::PARAM_INT);
        $statement->execute();

        return array_map(static fn (array $row): array => [
            'id' => (string) $row['id'],
            'owner_id' => (int) $row['owner_id'],
            'owner_name' => (string) $row['owner_name'],
            'title' => (string) $row['title'],
            'content' => (string) $row['content'],
            'version' => (int) $row['version'],
            'updated_at' => (string) $row['updated_at'],
        ], $statement->fetchAll());
    }
}
