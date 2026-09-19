<?php

declare(strict_types=1);

use Planner\Infrastructure\Database\Migration;

return new class implements Migration
{
    public function name(): string
    {
        return '0002_create_planning_core';
    }

    public function up(PDO $pdo): void
    {
        $statements = [
            <<<'SQL'
ALTER TABLE labels
    ADD COLUMN parent_id BIGINT UNSIGNED NULL AFTER user_id,
    ADD COLUMN color VARCHAR(16) CHARACTER SET ascii COLLATE ascii_bin NOT NULL DEFAULT 'neutral' AFTER name,
    ADD COLUMN position INT UNSIGNED NOT NULL DEFAULT 0 AFTER color,
    ADD COLUMN archived_at DATETIME(6) NULL AFTER version,
    ADD KEY labels_owner_parent_position_index (user_id, parent_id, position, id),
    ADD CONSTRAINT labels_parent_fk FOREIGN KEY (user_id, parent_id) REFERENCES labels (user_id, id) ON DELETE RESTRICT
SQL,
            <<<'SQL'
CREATE TABLE areas (
    id CHAR(36) CHARACTER SET ascii COLLATE ascii_bin NOT NULL PRIMARY KEY,
    user_id BIGINT UNSIGNED NOT NULL,
    name VARCHAR(80) NOT NULL,
    description TEXT NOT NULL,
    position INT UNSIGNED NOT NULL DEFAULT 0,
    version INT UNSIGNED NOT NULL DEFAULT 1,
    archived_at DATETIME(6) NULL,
    created_at DATETIME(6) NOT NULL,
    updated_at DATETIME(6) NOT NULL,
    UNIQUE KEY areas_owner_id_unique (user_id, id),
    UNIQUE KEY areas_owner_name_unique (user_id, name),
    KEY areas_owner_order_index (user_id, archived_at, position, id),
    CONSTRAINT areas_user_fk FOREIGN KEY (user_id) REFERENCES users (id) ON DELETE RESTRICT,
    CONSTRAINT areas_version_check CHECK (version >= 1)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci
SQL,
            <<<'SQL'
CREATE TABLE goals (
    id CHAR(36) CHARACTER SET ascii COLLATE ascii_bin NOT NULL PRIMARY KEY,
    user_id BIGINT UNSIGNED NOT NULL,
    area_id CHAR(36) CHARACTER SET ascii COLLATE ascii_bin NULL,
    parent_goal_id CHAR(36) CHARACTER SET ascii COLLATE ascii_bin NULL,
    name VARCHAR(200) NOT NULL,
    description TEXT NOT NULL,
    expected_result TEXT NOT NULL,
    completion_criteria TEXT NOT NULL,
    importance TINYINT UNSIGNED NOT NULL DEFAULT 3,
    status VARCHAR(16) CHARACTER SET ascii COLLATE ascii_bin NOT NULL DEFAULT 'Active',
    deadline DATE NULL,
    position INT UNSIGNED NOT NULL DEFAULT 0,
    version INT UNSIGNED NOT NULL DEFAULT 1,
    completed_at DATETIME(6) NULL,
    archived_at DATETIME(6) NULL,
    created_at DATETIME(6) NOT NULL,
    updated_at DATETIME(6) NOT NULL,
    UNIQUE KEY goals_owner_id_unique (user_id, id),
    KEY goals_owner_area_order_index (user_id, area_id, archived_at, position, id),
    KEY goals_owner_parent_order_index (user_id, parent_goal_id, archived_at, position, id),
    CONSTRAINT goals_user_fk FOREIGN KEY (user_id) REFERENCES users (id) ON DELETE RESTRICT,
    CONSTRAINT goals_area_fk FOREIGN KEY (user_id, area_id) REFERENCES areas (user_id, id) ON DELETE RESTRICT,
    CONSTRAINT goals_parent_fk FOREIGN KEY (user_id, parent_goal_id) REFERENCES goals (user_id, id) ON DELETE RESTRICT,
    CONSTRAINT goals_parent_xor_check CHECK ((area_id IS NULL) <> (parent_goal_id IS NULL)),
    CONSTRAINT goals_importance_check CHECK (importance BETWEEN 1 AND 5),
    CONSTRAINT goals_status_check CHECK (status IN ('Active', 'Completed')),
    CONSTRAINT goals_version_check CHECK (version >= 1)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci
SQL,
            <<<'SQL'
CREATE TABLE milestones (
    id CHAR(36) CHARACTER SET ascii COLLATE ascii_bin NOT NULL PRIMARY KEY,
    user_id BIGINT UNSIGNED NOT NULL,
    goal_id CHAR(36) CHARACTER SET ascii COLLATE ascii_bin NOT NULL,
    name VARCHAR(200) NOT NULL,
    description TEXT NOT NULL,
    completion_criteria TEXT NOT NULL,
    importance TINYINT UNSIGNED NOT NULL DEFAULT 3,
    status VARCHAR(16) CHARACTER SET ascii COLLATE ascii_bin NOT NULL DEFAULT 'NotStarted',
    deadline DATE NULL,
    position INT UNSIGNED NOT NULL DEFAULT 0,
    version INT UNSIGNED NOT NULL DEFAULT 1,
    completed_at DATETIME(6) NULL,
    archived_at DATETIME(6) NULL,
    created_at DATETIME(6) NOT NULL,
    updated_at DATETIME(6) NOT NULL,
    UNIQUE KEY milestones_owner_id_unique (user_id, id),
    KEY milestones_owner_goal_order_index (user_id, goal_id, archived_at, position, id),
    KEY milestones_owner_status_deadline_index (user_id, status, deadline, id),
    CONSTRAINT milestones_user_fk FOREIGN KEY (user_id) REFERENCES users (id) ON DELETE RESTRICT,
    CONSTRAINT milestones_goal_fk FOREIGN KEY (user_id, goal_id) REFERENCES goals (user_id, id) ON DELETE RESTRICT,
    CONSTRAINT milestones_importance_check CHECK (importance BETWEEN 1 AND 5),
    CONSTRAINT milestones_status_check CHECK (status IN ('NotStarted', 'InProgress', 'Completed')),
    CONSTRAINT milestones_version_check CHECK (version >= 1)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci
SQL,
            <<<'SQL'
CREATE TABLE tasks (
    id CHAR(36) CHARACTER SET ascii COLLATE ascii_bin NOT NULL PRIMARY KEY,
    user_id BIGINT UNSIGNED NOT NULL,
    goal_id CHAR(36) CHARACTER SET ascii COLLATE ascii_bin NULL,
    milestone_id CHAR(36) CHARACTER SET ascii COLLATE ascii_bin NULL,
    name VARCHAR(200) NOT NULL,
    description TEXT NOT NULL,
    expected_result TEXT NOT NULL,
    completion_criteria TEXT NOT NULL,
    importance TINYINT UNSIGNED NOT NULL DEFAULT 3,
    status VARCHAR(16) CHARACTER SET ascii COLLATE ascii_bin NOT NULL DEFAULT 'NotStarted',
    start_date DATE NULL,
    deadline DATE NULL,
    scheduled_start DATETIME(6) NULL,
    scheduled_end DATETIME(6) NULL,
    position INT UNSIGNED NOT NULL DEFAULT 0,
    version INT UNSIGNED NOT NULL DEFAULT 1,
    completed_at DATETIME(6) NULL,
    archived_at DATETIME(6) NULL,
    created_at DATETIME(6) NOT NULL,
    updated_at DATETIME(6) NOT NULL,
    UNIQUE KEY tasks_owner_id_unique (user_id, id),
    KEY tasks_owner_goal_index (user_id, goal_id, archived_at, position, id),
    KEY tasks_owner_milestone_index (user_id, milestone_id, archived_at, position, id),
    KEY tasks_owner_status_deadline_index (user_id, status, deadline, id),
    KEY tasks_owner_schedule_index (user_id, scheduled_start, scheduled_end, id),
    CONSTRAINT tasks_user_fk FOREIGN KEY (user_id) REFERENCES users (id) ON DELETE RESTRICT,
    CONSTRAINT tasks_goal_fk FOREIGN KEY (user_id, goal_id) REFERENCES goals (user_id, id) ON DELETE RESTRICT,
    CONSTRAINT tasks_milestone_fk FOREIGN KEY (user_id, milestone_id) REFERENCES milestones (user_id, id) ON DELETE RESTRICT,
    CONSTRAINT tasks_parent_check CHECK (goal_id IS NULL OR milestone_id IS NULL),
    CONSTRAINT tasks_importance_check CHECK (importance BETWEEN 1 AND 5),
    CONSTRAINT tasks_status_check CHECK (status IN ('NotStarted', 'InProgress', 'Blocked', 'Done')),
    CONSTRAINT tasks_date_check CHECK (start_date IS NULL OR deadline IS NULL OR start_date <= deadline),
    CONSTRAINT tasks_schedule_check CHECK (scheduled_start IS NULL OR scheduled_end IS NULL OR scheduled_start < scheduled_end),
    CONSTRAINT tasks_version_check CHECK (version >= 1)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci
SQL,
            <<<'SQL'
CREATE TABLE checklist_items (
    id CHAR(36) CHARACTER SET ascii COLLATE ascii_bin NOT NULL PRIMARY KEY,
    user_id BIGINT UNSIGNED NOT NULL,
    task_id CHAR(36) CHARACTER SET ascii COLLATE ascii_bin NOT NULL,
    title VARCHAR(500) NOT NULL,
    checked TINYINT(1) NOT NULL DEFAULT 0,
    position INT UNSIGNED NOT NULL DEFAULT 0,
    version INT UNSIGNED NOT NULL DEFAULT 1,
    checked_at DATETIME(6) NULL,
    deleted_at DATETIME(6) NULL,
    created_at DATETIME(6) NOT NULL,
    updated_at DATETIME(6) NOT NULL,
    UNIQUE KEY checklist_owner_id_unique (user_id, id),
    KEY checklist_task_order_index (user_id, task_id, deleted_at, position, id),
    CONSTRAINT checklist_user_fk FOREIGN KEY (user_id) REFERENCES users (id) ON DELETE RESTRICT,
    CONSTRAINT checklist_task_fk FOREIGN KEY (user_id, task_id) REFERENCES tasks (user_id, id) ON DELETE RESTRICT,
    CONSTRAINT checklist_version_check CHECK (version >= 1)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci
SQL,
            <<<'SQL'
CREATE TABLE task_notes (
    task_id CHAR(36) CHARACTER SET ascii COLLATE ascii_bin NOT NULL PRIMARY KEY,
    user_id BIGINT UNSIGNED NOT NULL,
    body MEDIUMTEXT NOT NULL,
    version INT UNSIGNED NOT NULL DEFAULT 1,
    created_at DATETIME(6) NOT NULL,
    updated_at DATETIME(6) NOT NULL,
    UNIQUE KEY task_notes_owner_task_unique (user_id, task_id),
    CONSTRAINT task_notes_task_fk FOREIGN KEY (user_id, task_id) REFERENCES tasks (user_id, id) ON DELETE RESTRICT,
    CONSTRAINT task_notes_version_check CHECK (version >= 1)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci
SQL,
            <<<'SQL'
CREATE TABLE milestone_dependencies (
    user_id BIGINT UNSIGNED NOT NULL,
    milestone_id CHAR(36) CHARACTER SET ascii COLLATE ascii_bin NOT NULL,
    prerequisite_id CHAR(36) CHARACTER SET ascii COLLATE ascii_bin NOT NULL,
    created_at DATETIME(6) NOT NULL,
    PRIMARY KEY (user_id, milestone_id, prerequisite_id),
    KEY milestone_dependencies_reverse_index (user_id, prerequisite_id, milestone_id),
    CONSTRAINT milestone_dependencies_milestone_fk FOREIGN KEY (user_id, milestone_id) REFERENCES milestones (user_id, id) ON DELETE CASCADE,
    CONSTRAINT milestone_dependencies_prerequisite_fk FOREIGN KEY (user_id, prerequisite_id) REFERENCES milestones (user_id, id) ON DELETE CASCADE,
    CONSTRAINT milestone_dependencies_self_check CHECK (milestone_id <> prerequisite_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci
SQL,
            <<<'SQL'
CREATE TABLE goal_contributions (
    user_id BIGINT UNSIGNED NOT NULL,
    source_goal_id CHAR(36) CHARACTER SET ascii COLLATE ascii_bin NOT NULL,
    target_goal_id CHAR(36) CHARACTER SET ascii COLLATE ascii_bin NOT NULL,
    created_at DATETIME(6) NOT NULL,
    PRIMARY KEY (user_id, source_goal_id, target_goal_id),
    KEY goal_contributions_reverse_index (user_id, target_goal_id, source_goal_id),
    CONSTRAINT goal_contributions_source_fk FOREIGN KEY (user_id, source_goal_id) REFERENCES goals (user_id, id) ON DELETE CASCADE,
    CONSTRAINT goal_contributions_target_fk FOREIGN KEY (user_id, target_goal_id) REFERENCES goals (user_id, id) ON DELETE CASCADE,
    CONSTRAINT goal_contributions_self_check CHECK (source_goal_id <> target_goal_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci
SQL,
            <<<'SQL'
CREATE TABLE milestone_contributions (
    user_id BIGINT UNSIGNED NOT NULL,
    milestone_id CHAR(36) CHARACTER SET ascii COLLATE ascii_bin NOT NULL,
    goal_id CHAR(36) CHARACTER SET ascii COLLATE ascii_bin NOT NULL,
    created_at DATETIME(6) NOT NULL,
    PRIMARY KEY (user_id, milestone_id, goal_id),
    KEY milestone_contributions_reverse_index (user_id, goal_id, milestone_id),
    CONSTRAINT milestone_contributions_milestone_fk FOREIGN KEY (user_id, milestone_id) REFERENCES milestones (user_id, id) ON DELETE CASCADE,
    CONSTRAINT milestone_contributions_goal_fk FOREIGN KEY (user_id, goal_id) REFERENCES goals (user_id, id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci
SQL,
            <<<'SQL'
CREATE TABLE task_contributions (
    user_id BIGINT UNSIGNED NOT NULL,
    task_id CHAR(36) CHARACTER SET ascii COLLATE ascii_bin NOT NULL,
    goal_id CHAR(36) CHARACTER SET ascii COLLATE ascii_bin NOT NULL,
    created_at DATETIME(6) NOT NULL,
    PRIMARY KEY (user_id, task_id, goal_id),
    KEY task_contributions_reverse_index (user_id, goal_id, task_id),
    CONSTRAINT task_contributions_task_fk FOREIGN KEY (user_id, task_id) REFERENCES tasks (user_id, id) ON DELETE CASCADE,
    CONSTRAINT task_contributions_goal_fk FOREIGN KEY (user_id, goal_id) REFERENCES goals (user_id, id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci
SQL,
            <<<'SQL'
CREATE TABLE goal_tags (
    user_id BIGINT UNSIGNED NOT NULL, goal_id CHAR(36) CHARACTER SET ascii COLLATE ascii_bin NOT NULL, tag_id BIGINT UNSIGNED NOT NULL,
    PRIMARY KEY (user_id, goal_id, tag_id),
    CONSTRAINT goal_tags_goal_fk FOREIGN KEY (user_id, goal_id) REFERENCES goals (user_id, id) ON DELETE CASCADE,
    CONSTRAINT goal_tags_tag_fk FOREIGN KEY (user_id, tag_id) REFERENCES labels (user_id, id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci
SQL,
            <<<'SQL'
CREATE TABLE milestone_tags (
    user_id BIGINT UNSIGNED NOT NULL, milestone_id CHAR(36) CHARACTER SET ascii COLLATE ascii_bin NOT NULL, tag_id BIGINT UNSIGNED NOT NULL,
    PRIMARY KEY (user_id, milestone_id, tag_id),
    CONSTRAINT milestone_tags_milestone_fk FOREIGN KEY (user_id, milestone_id) REFERENCES milestones (user_id, id) ON DELETE CASCADE,
    CONSTRAINT milestone_tags_tag_fk FOREIGN KEY (user_id, tag_id) REFERENCES labels (user_id, id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci
SQL,
            <<<'SQL'
CREATE TABLE task_tags (
    user_id BIGINT UNSIGNED NOT NULL, task_id CHAR(36) CHARACTER SET ascii COLLATE ascii_bin NOT NULL, tag_id BIGINT UNSIGNED NOT NULL,
    PRIMARY KEY (user_id, task_id, tag_id),
    CONSTRAINT task_tags_task_fk FOREIGN KEY (user_id, task_id) REFERENCES tasks (user_id, id) ON DELETE CASCADE,
    CONSTRAINT task_tags_tag_fk FOREIGN KEY (user_id, tag_id) REFERENCES labels (user_id, id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci
SQL,
        ];

        foreach ($statements as $statement) {
            $pdo->exec($statement);
        }
    }
};
