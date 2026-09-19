<?php

declare(strict_types=1);

use Planner\Infrastructure\Database\Migration;

return new class implements Migration
{
    public function name(): string
    {
        return '0003_create_habits_and_recurrence';
    }

    public function up(PDO $pdo): void
    {
        $statements = [
            <<<'SQL'
CREATE TABLE habits (
    id CHAR(36) CHARACTER SET ascii COLLATE ascii_bin NOT NULL PRIMARY KEY,
    user_id BIGINT UNSIGNED NOT NULL,
    primary_goal_id CHAR(36) CHARACTER SET ascii COLLATE ascii_bin NULL,
    name VARCHAR(200) NOT NULL,
    description TEXT NOT NULL,
    importance TINYINT UNSIGNED NOT NULL DEFAULT 3,
    period VARCHAR(16) CHARACTER SET ascii COLLATE ascii_bin NOT NULL,
    target_frequency TINYINT UNSIGNED NOT NULL,
    timezone VARCHAR(64) CHARACTER SET ascii COLLATE ascii_bin NOT NULL,
    position INT UNSIGNED NOT NULL DEFAULT 0,
    version INT UNSIGNED NOT NULL DEFAULT 1,
    first_check_in_at DATETIME(6) NULL,
    archived_at DATETIME(6) NULL,
    created_at DATETIME(6) NOT NULL,
    updated_at DATETIME(6) NOT NULL,
    UNIQUE KEY habits_owner_id_unique (user_id, id),
    KEY habits_owner_goal_index (user_id, primary_goal_id, archived_at, position, id),
    CONSTRAINT habits_user_fk FOREIGN KEY (user_id) REFERENCES users (id) ON DELETE RESTRICT,
    CONSTRAINT habits_goal_fk FOREIGN KEY (user_id, primary_goal_id) REFERENCES goals (user_id, id) ON DELETE RESTRICT,
    CONSTRAINT habits_period_check CHECK (period IN ('daily', 'weekly')),
    CONSTRAINT habits_target_check CHECK ((period = 'daily' AND target_frequency = 1) OR (period = 'weekly' AND target_frequency BETWEEN 1 AND 7)),
    CONSTRAINT habits_importance_check CHECK (importance BETWEEN 1 AND 5),
    CONSTRAINT habits_version_check CHECK (version >= 1)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci
SQL,
            <<<'SQL'
CREATE TABLE habit_check_ins (
    id CHAR(36) CHARACTER SET ascii COLLATE ascii_bin NOT NULL PRIMARY KEY,
    user_id BIGINT UNSIGNED NOT NULL,
    habit_id CHAR(36) CHARACTER SET ascii COLLATE ascii_bin NOT NULL,
    local_date DATE NOT NULL,
    timezone VARCHAR(64) CHARACTER SET ascii COLLATE ascii_bin NOT NULL,
    recorded_at DATETIME(6) NOT NULL,
    UNIQUE KEY habit_check_ins_owner_id_unique (user_id, id),
    UNIQUE KEY habit_check_ins_habit_date_unique (user_id, habit_id, local_date),
    KEY habit_check_ins_owner_date_index (user_id, local_date, habit_id),
    CONSTRAINT habit_check_ins_habit_fk FOREIGN KEY (user_id, habit_id) REFERENCES habits (user_id, id) ON DELETE RESTRICT
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci
SQL,
            <<<'SQL'
CREATE TABLE habit_contributions (
    user_id BIGINT UNSIGNED NOT NULL,
    habit_id CHAR(36) CHARACTER SET ascii COLLATE ascii_bin NOT NULL,
    goal_id CHAR(36) CHARACTER SET ascii COLLATE ascii_bin NOT NULL,
    created_at DATETIME(6) NOT NULL,
    PRIMARY KEY (user_id, habit_id, goal_id),
    KEY habit_contributions_reverse_index (user_id, goal_id, habit_id),
    CONSTRAINT habit_contributions_habit_fk FOREIGN KEY (user_id, habit_id) REFERENCES habits (user_id, id) ON DELETE CASCADE,
    CONSTRAINT habit_contributions_goal_fk FOREIGN KEY (user_id, goal_id) REFERENCES goals (user_id, id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci
SQL,
            <<<'SQL'
CREATE TABLE habit_tags (
    user_id BIGINT UNSIGNED NOT NULL,
    habit_id CHAR(36) CHARACTER SET ascii COLLATE ascii_bin NOT NULL,
    tag_id BIGINT UNSIGNED NOT NULL,
    PRIMARY KEY (user_id, habit_id, tag_id),
    CONSTRAINT habit_tags_habit_fk FOREIGN KEY (user_id, habit_id) REFERENCES habits (user_id, id) ON DELETE CASCADE,
    CONSTRAINT habit_tags_tag_fk FOREIGN KEY (user_id, tag_id) REFERENCES labels (user_id, id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci
SQL,
            <<<'SQL'
CREATE TABLE activities (
    id CHAR(36) CHARACTER SET ascii COLLATE ascii_bin NOT NULL PRIMARY KEY,
    user_id BIGINT UNSIGNED NOT NULL,
    source_type VARCHAR(32) CHARACTER SET ascii COLLATE ascii_bin NOT NULL,
    source_id CHAR(36) CHARACTER SET ascii COLLATE ascii_bin NOT NULL,
    source_version INT UNSIGNED NOT NULL,
    action VARCHAR(32) CHARACTER SET ascii COLLATE ascii_bin NOT NULL,
    occurred_at DATETIME(6) NOT NULL,
    effective_date DATE NOT NULL,
    timezone VARCHAR(64) CHARACTER SET ascii COLLATE ascii_bin NOT NULL,
    reversal_of_id CHAR(36) CHARACTER SET ascii COLLATE ascii_bin NULL,
    metadata JSON NOT NULL,
    KEY activities_owner_date_type_index (user_id, effective_date, source_type, id),
    KEY activities_reversal_index (user_id, reversal_of_id),
    CONSTRAINT activities_user_fk FOREIGN KEY (user_id) REFERENCES users (id) ON DELETE RESTRICT
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci
SQL,
            <<<'SQL'
CREATE TABLE task_series (
    id CHAR(36) CHARACTER SET ascii COLLATE ascii_bin NOT NULL PRIMARY KEY,
    user_id BIGINT UNSIGNED NOT NULL,
    goal_id CHAR(36) CHARACTER SET ascii COLLATE ascii_bin NULL,
    milestone_id CHAR(36) CHARACTER SET ascii COLLATE ascii_bin NULL,
    name VARCHAR(200) NOT NULL,
    description TEXT NOT NULL,
    expected_result TEXT NOT NULL,
    completion_criteria TEXT NOT NULL,
    importance TINYINT UNSIGNED NOT NULL DEFAULT 3,
    frequency VARCHAR(16) CHARACTER SET ascii COLLATE ascii_bin NOT NULL,
    interval_count TINYINT UNSIGNED NOT NULL,
    weekday_mask TINYINT UNSIGNED NOT NULL DEFAULT 0,
    start_date DATE NOT NULL,
    end_date DATE NULL,
    timezone VARCHAR(64) CHARACTER SET ascii COLLATE ascii_bin NOT NULL,
    local_time TIME NULL,
    duration_minutes SMALLINT UNSIGNED NULL,
    deadline_offset_days SMALLINT UNSIGNED NULL,
    state VARCHAR(16) CHARACTER SET ascii COLLATE ascii_bin NOT NULL DEFAULT 'Active',
    cursor_date DATE NOT NULL,
    paused_at DATETIME(6) NULL,
    last_error_code VARCHAR(64) CHARACTER SET ascii COLLATE ascii_bin NULL,
    version INT UNSIGNED NOT NULL DEFAULT 1,
    archived_at DATETIME(6) NULL,
    created_at DATETIME(6) NOT NULL,
    updated_at DATETIME(6) NOT NULL,
    UNIQUE KEY task_series_owner_id_unique (user_id, id),
    KEY task_series_materialize_index (state, archived_at, cursor_date, id),
    CONSTRAINT task_series_user_fk FOREIGN KEY (user_id) REFERENCES users (id) ON DELETE RESTRICT,
    CONSTRAINT task_series_goal_fk FOREIGN KEY (user_id, goal_id) REFERENCES goals (user_id, id) ON DELETE RESTRICT,
    CONSTRAINT task_series_milestone_fk FOREIGN KEY (user_id, milestone_id) REFERENCES milestones (user_id, id) ON DELETE RESTRICT,
    CONSTRAINT task_series_parent_check CHECK (goal_id IS NULL OR milestone_id IS NULL),
    CONSTRAINT task_series_frequency_check CHECK (frequency IN ('daily', 'weekly')),
    CONSTRAINT task_series_interval_check CHECK (interval_count BETWEEN 1 AND 52),
    CONSTRAINT task_series_weekday_check CHECK ((frequency = 'daily' AND weekday_mask = 0) OR (frequency = 'weekly' AND weekday_mask BETWEEN 1 AND 127)),
    CONSTRAINT task_series_date_check CHECK (end_date IS NULL OR start_date <= end_date),
    CONSTRAINT task_series_duration_check CHECK (duration_minutes IS NULL OR duration_minutes > 0),
    CONSTRAINT task_series_deadline_check CHECK (deadline_offset_days IS NULL OR deadline_offset_days <= 365),
    CONSTRAINT task_series_state_check CHECK (state IN ('Active', 'Paused', 'Ended')),
    CONSTRAINT task_series_importance_check CHECK (importance BETWEEN 1 AND 5),
    CONSTRAINT task_series_version_check CHECK (version >= 1)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci
SQL,
            <<<'SQL'
CREATE TABLE task_series_checklist_items (
    id CHAR(36) CHARACTER SET ascii COLLATE ascii_bin NOT NULL PRIMARY KEY,
    user_id BIGINT UNSIGNED NOT NULL,
    series_id CHAR(36) CHARACTER SET ascii COLLATE ascii_bin NOT NULL,
    title VARCHAR(500) NOT NULL,
    position INT UNSIGNED NOT NULL DEFAULT 0,
    UNIQUE KEY task_series_checklist_owner_id_unique (user_id, id),
    KEY task_series_checklist_order_index (user_id, series_id, position, id),
    CONSTRAINT task_series_checklist_series_fk FOREIGN KEY (user_id, series_id) REFERENCES task_series (user_id, id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci
SQL,
            <<<'SQL'
CREATE TABLE task_series_tags (
    user_id BIGINT UNSIGNED NOT NULL, series_id CHAR(36) CHARACTER SET ascii COLLATE ascii_bin NOT NULL, tag_id BIGINT UNSIGNED NOT NULL,
    PRIMARY KEY (user_id, series_id, tag_id),
    CONSTRAINT task_series_tags_series_fk FOREIGN KEY (user_id, series_id) REFERENCES task_series (user_id, id) ON DELETE CASCADE,
    CONSTRAINT task_series_tags_tag_fk FOREIGN KEY (user_id, tag_id) REFERENCES labels (user_id, id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci
SQL,
            <<<'SQL'
CREATE TABLE task_series_contributions (
    user_id BIGINT UNSIGNED NOT NULL, series_id CHAR(36) CHARACTER SET ascii COLLATE ascii_bin NOT NULL, goal_id CHAR(36) CHARACTER SET ascii COLLATE ascii_bin NOT NULL,
    PRIMARY KEY (user_id, series_id, goal_id),
    CONSTRAINT task_series_contributions_series_fk FOREIGN KEY (user_id, series_id) REFERENCES task_series (user_id, id) ON DELETE CASCADE,
    CONSTRAINT task_series_contributions_goal_fk FOREIGN KEY (user_id, goal_id) REFERENCES goals (user_id, id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci
SQL,
            <<<'SQL'
ALTER TABLE tasks
    ADD COLUMN series_id CHAR(36) CHARACTER SET ascii COLLATE ascii_bin NULL AFTER milestone_id,
    ADD COLUMN occurrence_date DATE NULL AFTER series_id,
    ADD COLUMN occurrence_timezone VARCHAR(64) CHARACTER SET ascii COLLATE ascii_bin NULL AFTER occurrence_date,
    ADD UNIQUE KEY tasks_series_occurrence_unique (series_id, occurrence_date),
    ADD CONSTRAINT tasks_series_fk FOREIGN KEY (user_id, series_id) REFERENCES task_series (user_id, id) ON DELETE RESTRICT,
    ADD CONSTRAINT tasks_occurrence_check CHECK ((series_id IS NULL AND occurrence_date IS NULL AND occurrence_timezone IS NULL) OR (series_id IS NOT NULL AND occurrence_date IS NOT NULL AND occurrence_timezone IS NOT NULL))
SQL,
        ];

        foreach ($statements as $statement) {
            $pdo->exec($statement);
        }
    }
};
