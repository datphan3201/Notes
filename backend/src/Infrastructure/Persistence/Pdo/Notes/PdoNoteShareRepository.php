<?php

declare(strict_types=1);

namespace Planner\Infrastructure\Persistence\Pdo\Notes;

use PDO;

final readonly class PdoNoteShareRepository
{
    private const COLUMNS = 's.id, s.owner_id, s.note_id, s.recipient_id, s.permission, s.status, s.created_at, s.updated_at';

    public function __construct(private PDO $pdo)
    {
    }

    public function insert(string $id, int $ownerId, string $noteId, int $recipientId, string $permission, string $now): void
    {
        $statement = $this->pdo->prepare("INSERT INTO note_shares (id, owner_id, note_id, recipient_id, permission, status, created_at, updated_at) VALUES (:id, :owner, :note, :recipient, :permission, 'pending', :created, :updated)");
        $statement->execute(['id' => $id, 'owner' => $ownerId, 'note' => $noteId, 'recipient' => $recipientId, 'permission' => $permission, 'created' => $now, 'updated' => $now]);
    }

    /** @return array<string, mixed>|null */
    public function findForNoteRecipient(string $noteId, int $recipientId, bool $forUpdate = false): ?array
    {
        $statement = $this->pdo->prepare('SELECT '.self::COLUMNS.' FROM note_shares s WHERE s.note_id = :note AND s.recipient_id = :recipient'.($forUpdate ? ' FOR UPDATE' : ''));
        $statement->execute(['note' => $noteId, 'recipient' => $recipientId]);
        $row = $statement->fetch();

        return is_array($row) ? $row : null;
    }

    /** @return array<string, mixed>|null a share owned by $ownerId on $noteId */
    public function findOwned(int $ownerId, string $noteId, string $shareId, bool $forUpdate = false): ?array
    {
        $statement = $this->pdo->prepare('SELECT '.self::COLUMNS.' FROM note_shares s WHERE s.owner_id = :owner AND s.note_id = :note AND s.id = :id'.($forUpdate ? ' FOR UPDATE' : ''));
        $statement->execute(['owner' => $ownerId, 'note' => $noteId, 'id' => $shareId]);
        $row = $statement->fetch();

        return is_array($row) ? $row : null;
    }

    /** @return array<string, mixed>|null a share addressed to $recipientId */
    public function findReceived(int $recipientId, string $shareId, bool $forUpdate = false): ?array
    {
        $statement = $this->pdo->prepare('SELECT '.self::COLUMNS.' FROM note_shares s JOIN notes n ON n.user_id = s.owner_id AND n.id = s.note_id AND n.deleted_at IS NULL WHERE s.recipient_id = :recipient AND s.id = :id'.($forUpdate ? ' FOR UPDATE' : ''));
        $statement->execute(['recipient' => $recipientId, 'id' => $shareId]);
        $row = $statement->fetch();

        return is_array($row) ? $row : null;
    }

    /** @return list<array<string, mixed>> shares of one owned note with recipient identity */
    public function forNote(int $ownerId, string $noteId): array
    {
        $statement = $this->pdo->prepare('SELECT '.self::COLUMNS.', u.display_name, u.email FROM note_shares s JOIN users u ON u.id = s.recipient_id WHERE s.owner_id = :owner AND s.note_id = :note ORDER BY s.created_at, s.id');
        $statement->execute(['owner' => $ownerId, 'note' => $noteId]);

        return $statement->fetchAll();
    }

    /** @return list<int> accepted recipients of a note */
    public function acceptedRecipients(string $noteId): array
    {
        $statement = $this->pdo->prepare("SELECT recipient_id FROM note_shares WHERE note_id = :note AND status = 'accepted' ORDER BY recipient_id");
        $statement->execute(['note' => $noteId]);

        return array_map('intval', $statement->fetchAll(PDO::FETCH_COLUMN));
    }

    /** @return list<array<string, mixed>> notes shared with a recipient (live, undeleted) */
    public function received(int $recipientId, string $status): array
    {
        $statement = $this->pdo->prepare(<<<'SQL'
SELECT s.id AS share_id, s.permission, s.status, n.id, n.title, LEFT(n.content, 400) AS excerpt, n.color, n.version, n.updated_at, n.created_at,
       u.id AS owner_id, u.display_name AS owner_name, u.email AS owner_email
FROM note_shares s
JOIN notes n ON n.user_id = s.owner_id AND n.id = s.note_id AND n.deleted_at IS NULL
JOIN users u ON u.id = s.owner_id
WHERE s.recipient_id = :recipient AND s.status = :status
ORDER BY n.updated_at DESC, n.id DESC
LIMIT 200
SQL);
        $statement->execute(['recipient' => $recipientId, 'status' => $status]);

        return $statement->fetchAll();
    }

    public function update(string $shareId, array $changes, string $now): void
    {
        $assignments = [];
        $bindings = ['id' => $shareId, 'now' => $now];
        foreach ($changes as $field => $value) {
            if (! in_array($field, ['permission', 'status'], true)) {
                throw new \LogicException('Unexpected share field.');
            }
            $assignments[] = "$field = :$field";
            $bindings[$field] = $value;
        }
        $this->pdo->prepare('UPDATE note_shares SET '.implode(', ', $assignments).', updated_at = :now WHERE id = :id')->execute($bindings);
    }

    public function delete(string $shareId): void
    {
        $this->pdo->prepare('DELETE FROM note_shares WHERE id = :id')->execute(['id' => $shareId]);
    }

    /** @return list<array{id:string,display_name:string,email:string}> people this user already shares with or receives from */
    public function contacts(int $userId): array
    {
        $statement = $this->pdo->prepare(<<<'SQL'
SELECT DISTINCT u.id, u.display_name, u.email FROM users u
WHERE u.id IN (SELECT recipient_id FROM note_shares WHERE owner_id = :owner AND status = 'accepted')
   OR u.id IN (SELECT owner_id FROM note_shares WHERE recipient_id = :recipient AND status = 'accepted')
ORDER BY u.display_name, u.id
LIMIT 100
SQL);
        $statement->execute(['owner' => $userId, 'recipient' => $userId]);

        return array_map(static fn (array $row): array => ['id' => (string) $row['id'], 'display_name' => (string) $row['display_name'], 'email' => (string) $row['email']], $statement->fetchAll());
    }
}
