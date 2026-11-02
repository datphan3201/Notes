<?php

declare(strict_types=1);

use Planner\Infrastructure\Database\Migration;

return new class implements Migration {
    public function name(): string
    {
        return '0027_create_user_reports';
    }

    public function up(PDO $pdo): void
    {
        // The reported email is kept as typed (normalized) so the reporter never
        // learns whether it matches an account; administrators see the match.
        $pdo->exec(<<<'SQL'
CREATE TABLE user_reports (
    id CHAR(36) CHARACTER SET ascii COLLATE ascii_bin NOT NULL PRIMARY KEY,
    reporter_id BIGINT UNSIGNED NOT NULL,
    target_email VARCHAR(254) NOT NULL,
    target_user_id BIGINT UNSIGNED NULL,
    reason VARCHAR(2000) NOT NULL,
    status VARCHAR(10) CHARACTER SET ascii COLLATE ascii_bin NOT NULL DEFAULT 'open',
    response VARCHAR(1000) NULL,
    resolved_by BIGINT UNSIGNED NULL,
    created_at DATETIME(6) NOT NULL,
    resolved_at DATETIME(6) NULL,
    KEY user_reports_status_index (status, created_at, id),
    KEY user_reports_reporter_index (reporter_id, created_at),
    KEY user_reports_reporter_target_index (reporter_id, target_email, status),
    CONSTRAINT user_reports_reporter_fk FOREIGN KEY (reporter_id) REFERENCES users (id) ON DELETE CASCADE,
    CONSTRAINT user_reports_target_fk FOREIGN KEY (target_user_id) REFERENCES users (id) ON DELETE SET NULL,
    CONSTRAINT user_reports_resolver_fk FOREIGN KEY (resolved_by) REFERENCES users (id) ON DELETE SET NULL,
    CONSTRAINT user_reports_status_check CHECK (status IN ('open', 'resolved', 'dismissed'))
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci
SQL);
        $pdo->exec(<<<'SQL'
CREATE TABLE user_report_evidence (
    report_id CHAR(36) CHARACTER SET ascii COLLATE ascii_bin NOT NULL,
    position TINYINT UNSIGNED NOT NULL,
    path VARCHAR(255) CHARACTER SET ascii COLLATE ascii_bin NOT NULL,
    created_at DATETIME(6) NOT NULL,
    PRIMARY KEY (report_id, position),
    CONSTRAINT user_report_evidence_report_fk FOREIGN KEY (report_id) REFERENCES user_reports (id) ON DELETE CASCADE,
    CONSTRAINT user_report_evidence_position_check CHECK (position BETWEEN 1 AND 3)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci
SQL);
    }
};
