<?php

declare(strict_types=1);

use Planner\Infrastructure\Database\Migration;

return new class implements Migration
{
    public function name(): string { return '0004_create_dashboard_reviews'; }

    public function up(PDO $pdo): void
    {
        $statements = [
            <<<'SQL'
ALTER TABLE activities
    ADD UNIQUE KEY activities_event_unique (user_id, source_type, source_id, source_version, action),
    ADD CONSTRAINT activities_reversal_fk FOREIGN KEY (reversal_of_id) REFERENCES activities (id) ON DELETE RESTRICT
SQL,
            <<<'SQL'
CREATE TABLE weekly_task_selections (
    user_id BIGINT UNSIGNED NOT NULL,
    week_start DATE NOT NULL,
    task_id CHAR(36) CHARACTER SET ascii COLLATE ascii_bin NOT NULL,
    position INT UNSIGNED NOT NULL DEFAULT 0,
    created_at DATETIME(6) NOT NULL,
    PRIMARY KEY (user_id, week_start, task_id),
    KEY weekly_tasks_order_index (user_id, week_start, position, task_id),
    CONSTRAINT weekly_tasks_task_fk FOREIGN KEY (user_id, task_id) REFERENCES tasks (user_id, id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci
SQL,
            <<<'SQL'
CREATE TABLE weekly_milestone_selections (
    user_id BIGINT UNSIGNED NOT NULL,
    week_start DATE NOT NULL,
    milestone_id CHAR(36) CHARACTER SET ascii COLLATE ascii_bin NOT NULL,
    position INT UNSIGNED NOT NULL DEFAULT 0,
    created_at DATETIME(6) NOT NULL,
    PRIMARY KEY (user_id, week_start, milestone_id),
    KEY weekly_milestones_order_index (user_id, week_start, position, milestone_id),
    CONSTRAINT weekly_milestones_milestone_fk FOREIGN KEY (user_id, milestone_id) REFERENCES milestones (user_id, id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci
SQL,
            <<<'SQL'
CREATE TABLE goal_daily_snapshots (
    id CHAR(36) CHARACTER SET ascii COLLATE ascii_bin NOT NULL PRIMARY KEY,
    user_id BIGINT UNSIGNED NOT NULL,
    goal_id CHAR(36) CHARACTER SET ascii COLLATE ascii_bin NOT NULL,
    local_date DATE NOT NULL,
    timezone VARCHAR(64) CHARACTER SET ascii COLLATE ascii_bin NOT NULL,
    progress DECIMAL(5,2) NOT NULL,
    checksum CHAR(64) CHARACTER SET ascii COLLATE ascii_bin NOT NULL,
    captured_at DATETIME(6) NOT NULL,
    UNIQUE KEY goal_snapshots_owner_goal_date_unique (user_id, goal_id, local_date),
    KEY goal_snapshots_owner_date_index (user_id, local_date, goal_id),
    CONSTRAINT goal_snapshots_user_fk FOREIGN KEY (user_id) REFERENCES users (id) ON DELETE RESTRICT,
    CONSTRAINT goal_snapshots_progress_check CHECK (progress BETWEEN 0 AND 100)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci
SQL,
            <<<'SQL'
CREATE TABLE reviews (
    id CHAR(36) CHARACTER SET ascii COLLATE ascii_bin NOT NULL PRIMARY KEY,
    user_id BIGINT UNSIGNED NOT NULL,
    kind VARCHAR(16) CHARACTER SET ascii COLLATE ascii_bin NOT NULL,
    period_start DATE NOT NULL,
    period_end DATE NOT NULL,
    timezone VARCHAR(64) CHARACTER SET ascii COLLATE ascii_bin NOT NULL,
    snapshot_schema_version SMALLINT UNSIGNED NOT NULL DEFAULT 1,
    snapshot JSON NOT NULL,
    reflection TEXT NOT NULL,
    went_well TEXT NOT NULL,
    went_wrong TEXT NOT NULL,
    change_next TEXT NOT NULL,
    status VARCHAR(16) CHARACTER SET ascii COLLATE ascii_bin NOT NULL DEFAULT 'Draft',
    version INT UNSIGNED NOT NULL DEFAULT 1,
    finalized_at DATETIME(6) NULL,
    created_at DATETIME(6) NOT NULL,
    updated_at DATETIME(6) NOT NULL,
    UNIQUE KEY reviews_owner_id_unique (user_id, id),
    UNIQUE KEY reviews_owner_kind_period_unique (user_id, kind, period_start),
    KEY reviews_owner_period_index (user_id, period_start, kind, id),
    CONSTRAINT reviews_user_fk FOREIGN KEY (user_id) REFERENCES users (id) ON DELETE RESTRICT,
    CONSTRAINT reviews_kind_check CHECK (kind IN ('Daily', 'Weekly', 'Monthly')),
    CONSTRAINT reviews_status_check CHECK (status IN ('Draft', 'Finalized')),
    CONSTRAINT reviews_period_check CHECK (period_start <= period_end),
    CONSTRAINT reviews_version_check CHECK (version >= 1)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci
SQL,
        ];
        foreach ($statements as $statement) $pdo->exec($statement);
    }
};
