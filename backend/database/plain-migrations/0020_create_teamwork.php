<?php

declare(strict_types=1);

use Planner\Infrastructure\Database\Migration;

return new class implements Migration {
    public function name(): string { return '0020_create_teamwork'; }

    public function up(PDO $pdo): void
    {
        $pdo->exec(<<<'SQL'
CREATE TABLE team_goals (
    id CHAR(36) CHARACTER SET ascii COLLATE ascii_bin NOT NULL PRIMARY KEY,
    created_by BIGINT UNSIGNED NOT NULL,
    name VARCHAR(200) NOT NULL,
    description TEXT NOT NULL,
    due_date DATE NULL,
    status VARCHAR(9) CHARACTER SET ascii COLLATE ascii_bin NOT NULL DEFAULT 'active',
    version INT UNSIGNED NOT NULL DEFAULT 1,
    archived_at DATETIME(6) NULL,
    created_at DATETIME(6) NOT NULL,
    updated_at DATETIME(6) NOT NULL,
    CONSTRAINT team_goals_creator_fk FOREIGN KEY (created_by) REFERENCES users (id) ON DELETE RESTRICT,
    CONSTRAINT team_goals_status_check CHECK (status IN ('active', 'completed'))
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci
SQL);
        $pdo->exec(<<<'SQL'
CREATE TABLE team_members (
    team_goal_id CHAR(36) CHARACTER SET ascii COLLATE ascii_bin NOT NULL,
    user_id BIGINT UNSIGNED NOT NULL,
    role VARCHAR(6) CHARACTER SET ascii COLLATE ascii_bin NOT NULL,
    status VARCHAR(8) CHARACTER SET ascii COLLATE ascii_bin NOT NULL DEFAULT 'pending',
    invited_by BIGINT UNSIGNED NULL,
    created_at DATETIME(6) NOT NULL,
    updated_at DATETIME(6) NOT NULL,
    PRIMARY KEY (team_goal_id, user_id),
    KEY team_members_user_index (user_id, status),
    CONSTRAINT team_members_goal_fk FOREIGN KEY (team_goal_id) REFERENCES team_goals (id) ON DELETE CASCADE,
    CONSTRAINT team_members_user_fk FOREIGN KEY (user_id) REFERENCES users (id) ON DELETE CASCADE,
    CONSTRAINT team_members_inviter_fk FOREIGN KEY (invited_by) REFERENCES users (id) ON DELETE SET NULL,
    CONSTRAINT team_members_role_check CHECK (role IN ('admin', 'editor', 'viewer')),
    CONSTRAINT team_members_status_check CHECK (status IN ('pending', 'accepted'))
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci
SQL);
        $pdo->exec(<<<'SQL'
CREATE TABLE team_tasks (
    id CHAR(36) CHARACTER SET ascii COLLATE ascii_bin NOT NULL PRIMARY KEY,
    team_goal_id CHAR(36) CHARACTER SET ascii COLLATE ascii_bin NOT NULL,
    name VARCHAR(200) NOT NULL,
    description TEXT NOT NULL,
    assignee_id BIGINT UNSIGNED NULL,
    status VARCHAR(11) CHARACTER SET ascii COLLATE ascii_bin NOT NULL DEFAULT 'todo',
    due_date DATE NULL,
    created_by BIGINT UNSIGNED NULL,
    version INT UNSIGNED NOT NULL DEFAULT 1,
    completed_at DATETIME(6) NULL,
    archived_at DATETIME(6) NULL,
    created_at DATETIME(6) NOT NULL,
    updated_at DATETIME(6) NOT NULL,
    KEY team_tasks_goal_index (team_goal_id, archived_at, created_at),
    CONSTRAINT team_tasks_goal_fk FOREIGN KEY (team_goal_id) REFERENCES team_goals (id) ON DELETE CASCADE,
    CONSTRAINT team_tasks_assignee_fk FOREIGN KEY (assignee_id) REFERENCES users (id) ON DELETE SET NULL,
    CONSTRAINT team_tasks_creator_fk FOREIGN KEY (created_by) REFERENCES users (id) ON DELETE SET NULL,
    CONSTRAINT team_tasks_status_check CHECK (status IN ('todo', 'in_progress', 'done'))
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci
SQL);
        $pdo->exec(<<<'SQL'
CREATE TABLE team_messages (
    id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT PRIMARY KEY,
    team_goal_id CHAR(36) CHARACTER SET ascii COLLATE ascii_bin NOT NULL,
    user_id BIGINT UNSIGNED NULL,
    body VARCHAR(2000) NOT NULL,
    created_at DATETIME(6) NOT NULL,
    KEY team_messages_goal_index (team_goal_id, id),
    CONSTRAINT team_messages_goal_fk FOREIGN KEY (team_goal_id) REFERENCES team_goals (id) ON DELETE CASCADE,
    CONSTRAINT team_messages_user_fk FOREIGN KEY (user_id) REFERENCES users (id) ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci
SQL);
    }
};
