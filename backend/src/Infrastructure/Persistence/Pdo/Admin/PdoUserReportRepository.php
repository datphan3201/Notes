<?php

declare(strict_types=1);

namespace Planner\Infrastructure\Persistence\Pdo\Admin;

use PDO;

final readonly class PdoUserReportRepository
{
    public function __construct(private PDO $pdo)
    {
    }

    /** @param array<string, mixed> $row */
    public function insert(array $row): void
    {
        $statement = $this->pdo->prepare('INSERT INTO user_reports (id, reporter_id, target_email, target_user_id, reason, status, created_at) VALUES (:id, :reporter_id, :target_email, :target_user_id, :reason, \'open\', :created_at)');
        $statement->execute($row);
    }

    public function insertEvidence(string $reportId, int $position, string $path, string $now): void
    {
        $statement = $this->pdo->prepare('INSERT INTO user_report_evidence (report_id, position, path, created_at) VALUES (:report_id, :position, :path, :created_at)');
        $statement->execute(['report_id' => $reportId, 'position' => $position, 'path' => $path, 'created_at' => $now]);
    }

    public function hasOpenReport(int $reporterId, string $targetEmail): bool
    {
        $statement = $this->pdo->prepare("SELECT 1 FROM user_reports WHERE reporter_id = :reporter AND target_email = :email AND status = 'open' LIMIT 1");
        $statement->execute(['reporter' => $reporterId, 'email' => $targetEmail]);

        return $statement->fetchColumn() !== false;
    }

    /** @return list<array<string, mixed>> the reporter's own reports, newest first */
    public function forReporter(int $reporterId): array
    {
        $statement = $this->pdo->prepare(<<<'SQL'
SELECT r.id, r.target_email, r.reason, r.status, r.response, r.created_at, r.resolved_at,
       (SELECT COUNT(*) FROM user_report_evidence e WHERE e.report_id = r.id) AS evidence_count
FROM user_reports r
WHERE r.reporter_id = :reporter
ORDER BY r.created_at DESC, r.id DESC
LIMIT 50
SQL);
        $statement->execute(['reporter' => $reporterId]);

        return $statement->fetchAll();
    }

    /** @return list<array<string, mixed>> open reports first, then the newest */
    public function list(string $status): array
    {
        $where = $status === 'all' ? '' : 'WHERE r.status = :status';
        $statement = $this->pdo->prepare(<<<SQL
SELECT r.*, reporter.display_name AS reporter_name, reporter.email AS reporter_email,
       target.display_name AS target_name, target.email AS target_current_email, target.locked_at AS target_locked_at,
       (SELECT COUNT(*) FROM user_report_evidence e WHERE e.report_id = r.id) AS evidence_count
FROM user_reports r
JOIN users reporter ON reporter.id = r.reporter_id
LEFT JOIN users target ON target.id = r.target_user_id
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
        $statement = $this->pdo->prepare('SELECT * FROM user_reports WHERE id = :id'.($forUpdate ? ' FOR UPDATE' : ''));
        $statement->execute(['id' => $id]);
        $row = $statement->fetch();

        return is_array($row) ? $row : null;
    }

    public function resolve(string $id, string $status, ?string $response, int $adminId, string $now): void
    {
        $statement = $this->pdo->prepare('UPDATE user_reports SET status = :status, response = :response, resolved_by = :admin, resolved_at = :now WHERE id = :id');
        $statement->execute(['status' => $status, 'response' => $response, 'admin' => $adminId, 'now' => $now, 'id' => $id]);
    }

    public function evidencePath(string $reportId, int $position): ?string
    {
        $statement = $this->pdo->prepare('SELECT path FROM user_report_evidence WHERE report_id = :report_id AND position = :position');
        $statement->execute(['report_id' => $reportId, 'position' => $position]);
        $path = $statement->fetchColumn();

        return is_string($path) ? $path : null;
    }

    /** @return list<string> every stored evidence image, so files:prune keeps them */
    public function evidencePaths(): array
    {
        return array_values(array_map('strval', $this->pdo->query('SELECT path FROM user_report_evidence')->fetchAll(PDO::FETCH_COLUMN)));
    }
}
