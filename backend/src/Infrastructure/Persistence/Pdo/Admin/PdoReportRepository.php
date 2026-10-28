<?php

declare(strict_types=1);

namespace Planner\Infrastructure\Persistence\Pdo\Admin;

use PDO;

final readonly class PdoReportRepository
{
    public function __construct(private PDO $pdo)
    {
    }

    /** @param array<string, mixed> $row */
    public function insert(array $row): void
    {
        $statement = $this->pdo->prepare('INSERT INTO note_reports (id, reporter_id, note_owner_id, note_id, note_title, note_excerpt, reason, status, created_at) VALUES (:id, :reporter_id, :note_owner_id, :note_id, :note_title, :note_excerpt, :reason, \'open\', :created_at)');
        $statement->execute($row);
    }

    /** @return list<array<string, mixed>> open reports first, then the newest */
    public function list(string $status): array
    {
        $where = $status === 'all' ? '' : 'WHERE r.status = :status';
        $statement = $this->pdo->prepare(<<<SQL
SELECT r.*, reporter.display_name AS reporter_name, reporter.email AS reporter_email,
       owner.display_name AS owner_name, owner.email AS owner_email, owner.locked_at AS owner_locked_at
FROM note_reports r
JOIN users reporter ON reporter.id = r.reporter_id
JOIN users owner ON owner.id = r.note_owner_id
$where
ORDER BY (r.status = 'open') DESC, r.created_at DESC, r.id DESC
LIMIT 200
SQL);
        $statement->execute($status === 'all' ? [] : ['status' => $status]);

        return $statement->fetchAll();
    }

    /** @return array<string, mixed>|null */
    public function find(string $id, bool $forUpdate = false): ?array
    {
        $statement = $this->pdo->prepare('SELECT * FROM note_reports WHERE id = :id'.($forUpdate ? ' FOR UPDATE' : ''));
        $statement->execute(['id' => $id]);
        $row = $statement->fetch();

        return is_array($row) ? $row : null;
    }

    public function resolve(string $id, string $status, ?string $response, int $adminId, string $now): void
    {
        $statement = $this->pdo->prepare('UPDATE note_reports SET status = :status, response = :response, resolved_by = :admin, resolved_at = :now WHERE id = :id');
        $statement->execute(['status' => $status, 'response' => $response, 'admin' => $adminId, 'now' => $now, 'id' => $id]);
    }

    public function hasOpenReport(int $reporterId, string $noteId): bool
    {
        $statement = $this->pdo->prepare("SELECT 1 FROM note_reports WHERE reporter_id = :reporter AND note_id = :note AND status = 'open' LIMIT 1");
        $statement->execute(['reporter' => $reporterId, 'note' => $noteId]);

        return $statement->fetchColumn() !== false;
    }
}
