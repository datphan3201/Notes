<?php

declare(strict_types=1);

use Planner\Infrastructure\Database\Migration;

return new class implements Migration {
    public function name(): string
    {
        return '0028_create_note_links';
    }

    public function up(PDO $pdo): void
    {
        // A Note can belong to one Goal or one Task of the same owner, so research and meeting
        // notes appear next to the work they support. The owner is part of every key, so a link
        // can never point across accounts; deleting the Note, Goal or Task removes the link.
        $pdo->exec(<<<'SQL'
CREATE TABLE note_links (
    user_id BIGINT UNSIGNED NOT NULL,
    note_id CHAR(36) CHARACTER SET ascii COLLATE ascii_bin NOT NULL,
    goal_id CHAR(36) CHARACTER SET ascii COLLATE ascii_bin NULL,
    task_id CHAR(36) CHARACTER SET ascii COLLATE ascii_bin NULL,
    created_at DATETIME(6) NOT NULL,
    updated_at DATETIME(6) NOT NULL,
    PRIMARY KEY (user_id, note_id),
    KEY note_links_goal_index (user_id, goal_id),
    KEY note_links_task_index (user_id, task_id),
    CONSTRAINT note_links_note_fk FOREIGN KEY (user_id, note_id) REFERENCES notes (user_id, id) ON DELETE CASCADE,
    CONSTRAINT note_links_goal_fk FOREIGN KEY (user_id, goal_id) REFERENCES goals (user_id, id) ON DELETE CASCADE,
    CONSTRAINT note_links_task_fk FOREIGN KEY (user_id, task_id) REFERENCES tasks (user_id, id) ON DELETE CASCADE,
    CONSTRAINT note_links_one_target_check CHECK ((goal_id IS NULL) <> (task_id IS NULL))
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci
SQL);
    }
};
