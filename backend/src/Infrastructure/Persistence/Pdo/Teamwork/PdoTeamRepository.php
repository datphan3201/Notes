<?php

declare(strict_types=1);

namespace Planner\Infrastructure\Persistence\Pdo\Teamwork;

use PDO;

final readonly class PdoTeamRepository
{
    public function __construct(private PDO $pdo)
    {
    }

    public function insertGoal(string $id, int $userId, string $name, string $description, ?string $dueDate, string $now): void
    {
        $statement = $this->pdo->prepare('INSERT INTO team_goals (id, created_by, name, description, due_date, created_at, updated_at) VALUES (:id, :user, :name, :description, :due, :created, :updated)');
        $statement->execute(['id' => $id, 'user' => $userId, 'name' => $name, 'description' => $description, 'due' => $dueDate, 'created' => $now, 'updated' => $now]);
    }

    /** @return array<string, mixed>|null an active team goal */
    public function goal(string $goalId, bool $forUpdate = false): ?array
    {
        $statement = $this->pdo->prepare('SELECT * FROM team_goals WHERE id = :id AND archived_at IS NULL'.($forUpdate ? ' FOR UPDATE' : ''));
        $statement->execute(['id' => $goalId]);
        $row = $statement->fetch();

        return is_array($row) ? $row : null;
    }

    /** @param array<string, mixed> $changes */
    public function updateGoal(string $goalId, array $changes, int $version, string $now): void
    {
        $assignments = ['version = :version', 'updated_at = :now'];
        $bindings = ['id' => $goalId, 'version' => $version, 'now' => $now];
        foreach ($changes as $field => $value) {
            if (! in_array($field, ['name', 'description', 'due_date', 'status', 'archived_at'], true)) {
                throw new \LogicException('Unexpected team goal field.');
            }
            $assignments[] = "$field = :$field";
            $bindings[$field] = $value;
        }
        $this->pdo->prepare('UPDATE team_goals SET '.implode(', ', $assignments).' WHERE id = :id')->execute($bindings);
    }

    /** @return list<array<string, mixed>> goals where the user is a member (pending or accepted) */
    public function goalsFor(int $userId): array
    {
        $statement = $this->pdo->prepare(<<<'SQL'
SELECT g.*, m.role AS my_role, m.status AS my_status,
       (SELECT COUNT(*) FROM team_tasks t WHERE t.team_goal_id = g.id AND t.archived_at IS NULL) AS task_total,
       (SELECT COUNT(*) FROM team_tasks t WHERE t.team_goal_id = g.id AND t.archived_at IS NULL AND t.status = 'done') AS task_done
FROM team_members m
JOIN team_goals g ON g.id = m.team_goal_id AND g.archived_at IS NULL
WHERE m.user_id = :user
ORDER BY (m.status = 'pending') DESC, (g.status = 'completed'), g.due_date IS NULL, g.due_date, g.created_at DESC
LIMIT 200
SQL);
        $statement->execute(['user' => $userId]);

        return $statement->fetchAll();
    }

    public function insertMember(string $goalId, int $userId, string $role, string $status, ?int $invitedBy, string $now): void
    {
        $statement = $this->pdo->prepare('INSERT INTO team_members (team_goal_id, user_id, role, status, invited_by, created_at, updated_at) VALUES (:goal, :user, :role, :status, :inviter, :created, :updated)');
        $statement->execute(['goal' => $goalId, 'user' => $userId, 'role' => $role, 'status' => $status, 'inviter' => $invitedBy, 'created' => $now, 'updated' => $now]);
    }

    /** @return array<string, mixed>|null */
    public function member(string $goalId, int $userId, bool $forUpdate = false): ?array
    {
        $statement = $this->pdo->prepare('SELECT * FROM team_members WHERE team_goal_id = :goal AND user_id = :user'.($forUpdate ? ' FOR UPDATE' : ''));
        $statement->execute(['goal' => $goalId, 'user' => $userId]);
        $row = $statement->fetch();

        return is_array($row) ? $row : null;
    }

    /** @return list<array<string, mixed>> members in stable user order, with identity */
    public function members(string $goalId, bool $forUpdate = false): array
    {
        $statement = $this->pdo->prepare('SELECT m.*, u.display_name, u.email, u.avatar_path, u.biography FROM team_members m JOIN users u ON u.id = m.user_id WHERE m.team_goal_id = :goal ORDER BY m.user_id'.($forUpdate ? ' FOR UPDATE' : ''));
        $statement->execute(['goal' => $goalId]);

        return $statement->fetchAll();
    }

    /** @param array<string, string> $changes */
    public function updateMember(string $goalId, int $userId, array $changes, string $now): void
    {
        $assignments = ['updated_at = :now'];
        $bindings = ['goal' => $goalId, 'user' => $userId, 'now' => $now];
        foreach ($changes as $field => $value) {
            if (! in_array($field, ['role', 'status'], true)) {
                throw new \LogicException('Unexpected member field.');
            }
            $assignments[] = "$field = :$field";
            $bindings[$field] = $value;
        }
        $this->pdo->prepare('UPDATE team_members SET '.implode(', ', $assignments).' WHERE team_goal_id = :goal AND user_id = :user')->execute($bindings);
    }

    public function deleteMember(string $goalId, int $userId): void
    {
        $this->pdo->prepare('DELETE FROM team_members WHERE team_goal_id = :goal AND user_id = :user')->execute(['goal' => $goalId, 'user' => $userId]);
        // Work assigned to a removed member returns to unassigned.
        $this->pdo->prepare('UPDATE team_tasks SET assignee_id = NULL WHERE team_goal_id = :goal AND assignee_id = :user')->execute(['goal' => $goalId, 'user' => $userId]);
    }

    /** @param array<string, mixed> $row */
    public function insertTask(array $row): void
    {
        $statement = $this->pdo->prepare('INSERT INTO team_tasks (id, team_goal_id, name, description, importance, assignee_id, status, start_date, due_date, estimated_minutes, reminder_at, repeat_rule, created_by, completed_at, created_at, updated_at) VALUES (:id, :team_goal_id, :name, :description, :importance, :assignee_id, :status, :start_date, :due_date, :estimated_minutes, :reminder_at, :repeat_rule, :created_by, :completed_at, :created_at, :updated_at)');
        $statement->execute($row);
    }

    /** @return array<string, mixed>|null */
    public function task(string $goalId, string $taskId, bool $forUpdate = false): ?array
    {
        $statement = $this->pdo->prepare('SELECT * FROM team_tasks WHERE team_goal_id = :goal AND id = :id AND archived_at IS NULL'.($forUpdate ? ' FOR UPDATE' : ''));
        $statement->execute(['goal' => $goalId, 'id' => $taskId]);
        $row = $statement->fetch();

        return is_array($row) ? $row : null;
    }

    /** @return list<array<string, mixed>> */
    public function tasks(string $goalId): array
    {
        $statement = $this->pdo->prepare("SELECT * FROM team_tasks WHERE team_goal_id = :goal AND archived_at IS NULL ORDER BY (status = 'done'), due_date IS NULL, due_date, created_at, id LIMIT 500");
        $statement->execute(['goal' => $goalId]);

        return $statement->fetchAll();
    }

    /** @param array<string, mixed> $changes */
    public function updateTask(string $taskId, array $changes, int $version, string $now): void
    {
        $assignments = ['version = :version', 'updated_at = :now'];
        $bindings = ['id' => $taskId, 'version' => $version, 'now' => $now];
        foreach ($changes as $field => $value) {
            if (! in_array($field, ['name', 'description', 'importance', 'assignee_id', 'status', 'start_date', 'due_date', 'estimated_minutes', 'reminder_at', 'reminder_read_at', 'repeat_rule', 'completed_at', 'archived_at'], true)) {
                throw new \LogicException('Unexpected team task field.');
            }
            $assignments[] = "$field = :$field";
            $bindings[$field] = $value;
        }
        $this->pdo->prepare('UPDATE team_tasks SET '.implode(', ', $assignments).' WHERE id = :id')->execute($bindings);
    }

    public function insertMessage(string $goalId, int $userId, string $body, string $now): int
    {
        $statement = $this->pdo->prepare('INSERT INTO team_messages (team_goal_id, user_id, body, created_at) VALUES (:goal, :user, :body, :now)');
        $statement->execute(['goal' => $goalId, 'user' => $userId, 'body' => $body, 'now' => $now]);

        return (int) $this->pdo->lastInsertId();
    }

    /** @return list<array<string, mixed>> the newest 100 messages after $afterId, oldest first */
    public function messages(string $goalId, int $afterId): array
    {
        $statement = $this->pdo->prepare('SELECT * FROM (SELECT msg.id, msg.user_id, msg.body, msg.created_at, u.display_name FROM team_messages msg LEFT JOIN users u ON u.id = msg.user_id WHERE msg.team_goal_id = :goal AND msg.id > :after ORDER BY msg.id DESC LIMIT 100) recent ORDER BY id');
        $statement->bindValue(':goal', $goalId);
        $statement->bindValue(':after', $afterId, PDO::PARAM_INT);
        $statement->execute();

        return $statement->fetchAll();
    }

    /** @return list<array{id:string,display_name:string,email:string}> people who share an accepted team with the user */
    public function teammates(int $userId): array
    {
        $statement = $this->pdo->prepare(<<<'SQL'
SELECT DISTINCT u.id, u.display_name, u.email
FROM team_members mine
JOIN team_members other ON other.team_goal_id = mine.team_goal_id AND other.user_id <> mine.user_id AND other.status = 'accepted'
JOIN users u ON u.id = other.user_id
WHERE mine.user_id = :user AND mine.status = 'accepted'
ORDER BY u.display_name, u.id
LIMIT 100
SQL);
        $statement->execute(['user' => $userId]);

        return array_map(static fn (array $row): array => ['id' => (string) $row['id'], 'display_name' => (string) $row['display_name'], 'email' => (string) $row['email']], $statement->fetchAll());
    }
}
