<?php

declare(strict_types=1);

namespace Planner\Application\Teamwork;

use DateTimeImmutable;
use DateTimeZone;
use InvalidArgumentException;
use Planner\Application\Notifications\NotificationService;
use Planner\Domain\Teamwork\TeamTaskRepeat;
use Planner\Http\HttpException;
use Planner\Http\ValidationException;
use Planner\Infrastructure\Database\TransactionManager;
use Planner\Infrastructure\Persistence\Pdo\Account\PdoAccountRepository;
use Planner\Infrastructure\Persistence\Pdo\Notes\PdoNoteShareRepository;
use Planner\Infrastructure\Persistence\Pdo\Teamwork\PdoTeamRepository;
use Planner\Support\Clock;
use Planner\Support\TextNormalizer;
use Planner\Support\TimeZoneNames;
use Planner\Support\Timestamp;
use Planner\Support\UuidGenerator;

/**
 * Teamwork goals. Roles: admin manages the goal and members, editor manages
 * tasks, viewer reads and chats. Non-members always receive 404.
 * Lock order: team goal row, then member rows (user order), then task rows.
 */
final readonly class TeamService
{
    private const ROLES = ['admin', 'editor', 'viewer'];
    private const STATUSES = ['todo', 'in_progress', 'done'];
    private const TASK_FIELDS = ['name', 'description', 'assignee_id', 'status', 'due_date', 'importance', 'start_date', 'estimated_minutes', 'reminder_at', 'repeat'];

    public function __construct(
        private PdoTeamRepository $teams,
        private PdoAccountRepository $accounts,
        private PdoNoteShareRepository $shares,
        private NotificationService $notifications,
        private TransactionManager $transactions,
        private UuidGenerator $uuid,
        private Clock $clock,
    ) {
    }

    /** @return array{goals:list<array<string,mixed>>,invitations:list<array<string,mixed>>} */
    public function overview(int $userId): array
    {
        $goals = [];
        $invitations = [];
        foreach ($this->teams->goalsFor($userId) as $row) {
            $summary = $this->summary($row);
            if ($row['my_status'] === 'pending') {
                $invitations[] = $summary;
            } else {
                $goals[] = $summary;
            }
        }

        return ['goals' => $goals, 'invitations' => $invitations];
    }

    /** @param array<string, mixed> $input */
    public function create(int $userId, array $input): array
    {
        $this->keys($input, ['name', 'description', 'due_date', 'members']);
        $fields = $this->goalFields($input, true);
        $invites = $this->memberList($input['members'] ?? []);

        return $this->transactions->run(function () use ($userId, $fields, $invites): array {
            $actor = $this->accounts->findById($userId, true) ?? throw new \RuntimeException('User disappeared.');
            $goalId = $this->uuid->generate();
            $now = $this->now();
            $this->teams->insertGoal($goalId, $userId, $fields['name'], $fields['description'], $fields['due_date'], $now);
            $this->teams->insertMember($goalId, $userId, 'admin', 'accepted', null, $now);
            foreach ($invites as $invite) {
                $this->inviteLocked($goalId, $fields['name'], $actor->id, $actor->displayName, $invite['email'], $invite['role']);
            }

            return $this->detail($userId, $goalId);
        });
    }

    /** @return array<string, mixed> */
    public function show(int $userId, string $goalId): array
    {
        $this->acceptedMember($goalId, $userId);

        return $this->detail($userId, $goalId);
    }

    /** @param array<string, mixed> $input */
    public function update(int $userId, string $goalId, array $input): array
    {
        $this->keys($input, ['base_version', 'name', 'description', 'due_date', 'status']);
        $fields = $this->goalFields($input, false);
        if (array_key_exists('status', $input)) {
            $fields['status'] = in_array($input['status'], ['active', 'completed'], true) ? $input['status'] : throw new ValidationException(['status' => ['Choose active or completed.']]);
        }

        return $this->transactions->run(function () use ($userId, $goalId, $input, $fields): array {
            $goal = $this->lockGoal($goalId);
            $this->requireRole($goalId, $userId, ['admin']);
            $this->assertVersion($input, (int) $goal['version']);
            $this->teams->updateGoal($goalId, $fields, (int) $goal['version'] + 1, $this->now());

            return $this->detail($userId, $goalId);
        });
    }

    public function archive(int $userId, string $goalId): void
    {
        $this->transactions->run(function () use ($userId, $goalId): void {
            $goal = $this->lockGoal($goalId);
            $this->requireRole($goalId, $userId, ['admin']);
            $this->teams->updateGoal($goalId, ['archived_at' => $this->now()], (int) $goal['version'] + 1, $this->now());
        });
    }

    public function invite(int $userId, string $goalId, string $email, string $role): array
    {
        $this->role($role);

        return $this->transactions->run(function () use ($userId, $goalId, $email, $role): array {
            $goal = $this->lockGoal($goalId);
            $this->requireRole($goalId, $userId, ['admin']);
            $actor = $this->accounts->findById($userId) ?? throw new \RuntimeException('User disappeared.');
            $this->inviteLocked($goalId, (string) $goal['name'], $userId, $actor->displayName, strtolower(trim($email)), $role);

            return $this->detail($userId, $goalId);
        });
    }

    public function changeRole(int $userId, string $goalId, int $memberId, string $role): array
    {
        $this->role($role);

        return $this->transactions->run(function () use ($userId, $goalId, $memberId, $role): array {
            $this->lockGoal($goalId);
            $members = $this->teams->members($goalId, true);
            $this->requireRole($goalId, $userId, ['admin']);
            $this->findMember($members, $memberId);
            if ($role !== 'admin') {
                $this->assertAdminRemains($members, $memberId);
            }
            $this->teams->updateMember($goalId, $memberId, ['role' => $role], $this->now());

            return $this->detail($userId, $goalId);
        });
    }

    /** Admins remove anyone; any member may remove themselves (leave). */
    public function removeMember(int $userId, string $goalId, int $memberId): void
    {
        $this->transactions->run(function () use ($userId, $goalId, $memberId): void {
            $this->lockGoal($goalId);
            $members = $this->teams->members($goalId, true);
            if ($memberId !== $userId) {
                $this->requireRole($goalId, $userId, ['admin']);
            } else {
                $this->findMember($members, $userId);
            }
            $this->findMember($members, $memberId);
            $this->assertAdminRemains($members, $memberId);
            $this->teams->deleteMember($goalId, $memberId);
            $this->notifications->resolveSubject($memberId, 'team_invite', $goalId);
        });
    }

    public function respond(int $userId, string $goalId, bool $accept): void
    {
        $this->transactions->run(function () use ($userId, $goalId, $accept): void {
            $goal = $this->lockGoal($goalId);
            $member = $this->teams->member($goalId, $userId, true);
            if ($member === null || $member['status'] !== 'pending') {
                $this->notFound();
            }
            $this->notifications->resolveSubject($userId, 'team_invite', $goalId);
            if (! $accept) {
                $this->teams->deleteMember($goalId, $userId);

                return;
            }
            $this->teams->updateMember($goalId, $userId, ['status' => 'accepted'], $this->now());
            $user = $this->accounts->findById($userId) ?? throw new \RuntimeException('User disappeared.');
            foreach ($this->teams->members($goalId) as $other) {
                if ((int) $other['user_id'] !== $userId && $other['status'] === 'accepted') {
                    $this->notifications->notify((int) $other['user_id'], 'team_joined', $goalId, [
                        'title' => $user->displayName.' joined '.$goal['name'],
                        'body' => '',
                        'url' => '/teamwork?goal='.$goalId,
                    ]);
                }
            }
        });
    }

    /** @param array<string, mixed> $input */
    public function createTask(int $userId, string $goalId, array $input): array
    {
        $this->keys($input, self::TASK_FIELDS);
        $fields = $this->taskFields($input, true);

        return $this->transactions->run(function () use ($userId, $goalId, $fields): array {
            $goal = $this->lockGoal($goalId);
            $members = $this->teams->members($goalId, true);
            $this->requireRole($goalId, $userId, ['admin', 'editor']);
            $this->assertAssignee($members, $fields['assignee_id']);
            $now = $this->now();
            $id = $this->uuid->generate();
            $this->teams->insertTask([
                'id' => $id,
                'team_goal_id' => $goalId,
                'name' => $fields['name'],
                'description' => $fields['description'] ?? '',
                'importance' => $fields['importance'] ?? 3,
                'assignee_id' => $fields['assignee_id'],
                'status' => $fields['status'] ?? 'todo',
                'start_date' => $fields['start_date'] ?? null,
                'due_date' => $fields['due_date'] ?? null,
                'estimated_minutes' => $fields['estimated_minutes'] ?? null,
                'reminder_at' => $fields['reminder_at'] ?? null,
                'repeat_rule' => $fields['repeat_rule'] ?? null,
                'created_by' => $userId,
                'completed_at' => ($fields['status'] ?? 'todo') === 'done' ? $now : null,
                'created_at' => $now,
                'updated_at' => $now,
            ]);
            $this->notifyAssignee($fields['assignee_id'], $userId, $goal, $fields['name']);

            return $this->detail($userId, $goalId);
        });
    }

    /** Editors change any field; an assignee may also move their own task's status. */
    public function updateTask(int $userId, string $goalId, string $taskId, array $input): array
    {
        $this->keys($input, ['base_version', ...self::TASK_FIELDS]);
        $fields = $this->taskFields($input, false);

        return $this->transactions->run(function () use ($userId, $goalId, $taskId, $input, $fields): array {
            $goal = $this->lockGoal($goalId);
            $members = $this->teams->members($goalId, true);
            $member = $this->findMember($members, $userId, true);
            $task = $this->teams->task($goalId, $taskId, true) ?? $this->notFound();
            $isEditor = in_array($member['role'], ['admin', 'editor'], true);
            $ownStatusOnly = array_keys($fields) === ['status'] && (int) ($task['assignee_id'] ?? 0) === $userId;
            if (! $isEditor && ! $ownStatusOnly) {
                throw new HttpException(403, 'FORBIDDEN', 'Your role cannot change this task.');
            }
            $this->assertVersion($input, (int) $task['version']);
            if (array_key_exists('assignee_id', $fields)) {
                $this->assertAssignee($members, $fields['assignee_id']);
            }
            if (array_key_exists('status', $fields) && $fields['status'] !== $task['status']) {
                $fields['completed_at'] = $fields['status'] === 'done' ? $this->now() : null;
            }
            $this->teams->updateTask($taskId, $fields, (int) $task['version'] + 1, $this->now());
            if (($fields['status'] ?? null) === 'done' && $task['status'] !== 'done') {
                $this->repeatTask([...$task, ...$fields], $userId);
            }
            if (array_key_exists('assignee_id', $fields) && $fields['assignee_id'] !== null && (int) $fields['assignee_id'] !== (int) ($task['assignee_id'] ?? 0)) {
                $this->notifyAssignee($fields['assignee_id'], $userId, $goal, (string) ($fields['name'] ?? $task['name']));
            }

            return $this->detail($userId, $goalId);
        });
    }

    public function archiveTask(int $userId, string $goalId, string $taskId): array
    {
        return $this->transactions->run(function () use ($userId, $goalId, $taskId): array {
            $this->lockGoal($goalId);
            $this->requireRole($goalId, $userId, ['admin', 'editor']);
            $task = $this->teams->task($goalId, $taskId, true) ?? $this->notFound();
            $this->teams->updateTask($taskId, ['archived_at' => $this->now()], (int) $task['version'] + 1, $this->now());

            return $this->detail($userId, $goalId);
        });
    }

    /** @return list<array<string, mixed>> */
    public function messages(int $userId, string $goalId, int $afterId): array
    {
        $this->acceptedMember($goalId, $userId);

        return array_map(fn (array $row): array => $this->message($row, $userId), $this->teams->messages($goalId, $afterId));
    }

    public function postMessage(int $userId, string $goalId, mixed $body): array
    {
        $body = is_string($body) ? trim(TextNormalizer::body($body)) : '';
        if ($body === '' || TextNormalizer::codePoints($body) > 2000) {
            throw new ValidationException(['body' => ['Write a message of 1 to 2000 characters.']]);
        }

        return $this->transactions->run(function () use ($userId, $goalId, $body): array {
            $this->lockGoal($goalId);
            $this->acceptedMember($goalId, $userId);
            $id = $this->teams->insertMessage($goalId, $userId, $body, $this->now());

            return array_map(fn (array $row): array => $this->message($row, $userId), $this->teams->messages($goalId, $id - 1));
        });
    }

    /** @return list<array{id:string,display_name:string,email:string}> */
    public function contacts(int $userId): array
    {
        $contacts = [];
        foreach ([...$this->teams->teammates($userId), ...$this->shares->contacts($userId)] as $contact) {
            $contacts[$contact['id']] = $contact;
        }

        return array_values($contacts);
    }

    private function inviteLocked(string $goalId, string $goalName, int $actorId, string $actorName, string $email, string $role): void
    {
        $recipient = $this->accounts->publicByEmail($email);
        // Unknown emails are ignored without disclosing whether an account exists.
        if ($recipient === null || (int) $recipient['id'] === $actorId) {
            return;
        }
        $recipientId = (int) $recipient['id'];
        if ($this->teams->member($goalId, $recipientId, true) !== null) {
            $this->teams->updateMember($goalId, $recipientId, ['role' => $role], $this->now());

            return;
        }
        $this->teams->insertMember($goalId, $recipientId, $role, 'pending', $actorId, $this->now());
        $this->notifications->notify($recipientId, 'team_invite', $goalId, [
            'title' => $actorName.' invited you to '.$goalName,
            'body' => 'Role: '.$role,
            'url' => '/teamwork?goal='.$goalId,
        ]);
    }

    /** @param array<string, mixed> $goal */
    private function notifyAssignee(mixed $assigneeId, int $actorId, array $goal, string $taskName): void
    {
        if ($assigneeId === null || (int) $assigneeId === $actorId) {
            return;
        }
        $this->notifications->notify((int) $assigneeId, 'team_task_assigned', (string) $goal['id'], [
            'title' => 'New task in '.$goal['name'],
            'body' => $taskName,
            'url' => '/teamwork?goal='.$goal['id'],
        ]);
    }

    /** @return array<string, mixed> */
    private function detail(int $userId, string $goalId): array
    {
        $goal = $this->teams->goal($goalId) ?? $this->notFound();
        $members = $this->teams->members($goalId);
        $tasks = $this->teams->tasks($goalId);
        $stats = [];
        foreach ($tasks as $task) {
            if ($task['assignee_id'] !== null) {
                $key = (int) $task['assignee_id'];
                $stats[$key] ??= ['assigned' => 0, 'done' => 0];
                $stats[$key]['assigned']++;
                if ($task['status'] === 'done') {
                    $stats[$key]['done']++;
                }
            }
        }
        $names = [];
        $serializedMembers = [];
        $myRole = null;
        foreach ($members as $member) {
            $id = (int) $member['user_id'];
            $names[$id] = (string) $member['display_name'];
            if ($id === $userId) {
                $myRole = (string) $member['role'];
            }
            $serializedMembers[] = [
                'id' => (string) $id,
                'display_name' => (string) $member['display_name'],
                'email' => (string) $member['email'],
                'role' => (string) $member['role'],
                'status' => (string) $member['status'],
                'assigned' => $stats[$id]['assigned'] ?? 0,
                'done' => $stats[$id]['done'] ?? 0,
            ];
        }
        $done = count(array_filter($tasks, static fn (array $task): bool => $task['status'] === 'done'));

        return [
            ...$this->goalBase($goal),
            'my_role' => $myRole,
            'progress' => ['done' => $done, 'total' => count($tasks)],
            'members' => $serializedMembers,
            'tasks' => array_map(static fn (array $task): array => [
                'id' => (string) $task['id'],
                'name' => (string) $task['name'],
                'description' => (string) $task['description'],
                'status' => (string) $task['status'],
                'importance' => (int) $task['importance'],
                'start_date' => $task['start_date'] === null ? null : (string) $task['start_date'],
                'due_date' => $task['due_date'] === null ? null : (string) $task['due_date'],
                'estimated_minutes' => $task['estimated_minutes'] === null ? null : (int) $task['estimated_minutes'],
                'reminder_at' => Timestamp::api($task['reminder_at'] === null ? null : (string) $task['reminder_at']),
                'repeat' => $task['repeat_rule'] === null ? null : json_decode((string) $task['repeat_rule'], true, 8, JSON_THROW_ON_ERROR),
                'assignee' => $task['assignee_id'] === null ? null : ['id' => (string) $task['assignee_id'], 'display_name' => $names[(int) $task['assignee_id']] ?? ''],
                'version' => (int) $task['version'],
                'completed_at' => Timestamp::api($task['completed_at'] === null ? null : (string) $task['completed_at']),
            ], $tasks),
        ];
    }

    /** @param array<string, mixed> $row @return array<string, mixed> */
    private function summary(array $row): array
    {
        $members = array_map(static fn (array $member): array => ['id' => (string) $member['user_id'], 'display_name' => (string) $member['display_name'], 'status' => (string) $member['status']], $this->teams->members((string) $row['id']));

        return [
            ...$this->goalBase($row),
            'my_role' => (string) $row['my_role'],
            'my_status' => (string) $row['my_status'],
            'progress' => ['done' => (int) $row['task_done'], 'total' => (int) $row['task_total']],
            'members' => $members,
        ];
    }

    /** @param array<string, mixed> $goal @return array<string, mixed> */
    private function goalBase(array $goal): array
    {
        return [
            'id' => (string) $goal['id'],
            'name' => (string) $goal['name'],
            'description' => (string) $goal['description'],
            'due_date' => $goal['due_date'] === null ? null : (string) $goal['due_date'],
            'status' => (string) $goal['status'],
            'version' => (int) $goal['version'],
        ];
    }

    /** @param array<string, mixed> $row @return array<string, mixed> */
    private function message(array $row, int $userId): array
    {
        return [
            'id' => (int) $row['id'],
            'author' => $row['user_id'] === null ? null : ['id' => (string) $row['user_id'], 'display_name' => (string) $row['display_name']],
            'mine' => (int) ($row['user_id'] ?? 0) === $userId,
            'body' => (string) $row['body'],
            'created_at' => Timestamp::api((string) $row['created_at']),
        ];
    }

    /** @param array<string, mixed> $input @return array<string, mixed> */
    private function goalFields(array $input, bool $create): array
    {
        $fields = [];
        if ($create || array_key_exists('name', $input)) {
            $fields['name'] = $this->text($input['name'] ?? null, 'name', 200, true);
        }
        if ($create || array_key_exists('description', $input)) {
            $fields['description'] = $this->text($input['description'] ?? '', 'description', 10_000, false);
        }
        if ($create || array_key_exists('due_date', $input)) {
            $fields['due_date'] = $this->date($input['due_date'] ?? null, 'due_date');
        }

        return $fields;
    }

    /** @param array<string, mixed> $input @return array<string, mixed> */
    private function taskFields(array $input, bool $create): array
    {
        $fields = [];
        if ($create || array_key_exists('name', $input)) {
            $fields['name'] = $this->text($input['name'] ?? null, 'name', 200, true);
        }
        if (array_key_exists('description', $input)) {
            $fields['description'] = $this->text($input['description'], 'description', 10_000, false);
        }
        if (array_key_exists('due_date', $input)) {
            $fields['due_date'] = $this->date($input['due_date'], 'due_date');
        }
        if (array_key_exists('start_date', $input)) {
            $fields['start_date'] = $this->date($input['start_date'], 'start_date');
        }
        if (array_key_exists('importance', $input)) {
            $fields['importance'] = is_int($input['importance']) && $input['importance'] >= 1 && $input['importance'] <= 5 ? $input['importance'] : throw new ValidationException(['importance' => ['Choose an importance from 1 to 5.']]);
        }
        if (array_key_exists('estimated_minutes', $input)) {
            $minutes = $input['estimated_minutes'];
            $fields['estimated_minutes'] = $minutes === null || (is_int($minutes) && $minutes >= 1 && $minutes <= 1440) ? $minutes : throw new ValidationException(['estimated_minutes' => ['Use 1 to 1440 minutes.']]);
        }
        if (array_key_exists('reminder_at', $input)) {
            $fields['reminder_at'] = $this->instant($input['reminder_at'], 'reminder_at');
        }
        if (array_key_exists('repeat', $input)) {
            try {
                $rule = TeamTaskRepeat::normalize($input['repeat']);
            } catch (InvalidArgumentException) {
                throw new ValidationException(['repeat' => ['The repeat rule is invalid.']]);
            }
            $fields['repeat_rule'] = $rule === null ? null : json_encode($rule, JSON_THROW_ON_ERROR);
        }
        if (array_key_exists('status', $input)) {
            $fields['status'] = in_array($input['status'], self::STATUSES, true) ? $input['status'] : throw new ValidationException(['status' => ['The status is invalid.']]);
        }
        if ($create || array_key_exists('assignee_id', $input)) {
            $value = $input['assignee_id'] ?? null;
            $fields['assignee_id'] = $value === null ? null : (is_string($value) && ctype_digit($value) ? (int) $value : throw new ValidationException(['assignee_id' => ['Choose a team member.']]));
        }

        return $fields;
    }

    /** @return list<array{email:string,role:string}> */
    private function memberList(mixed $value): array
    {
        if (! is_array($value) || count($value) > 50) {
            throw new ValidationException(['members' => ['Add at most 50 members.']]);
        }
        $members = [];
        foreach ($value as $member) {
            if (! is_array($member) || ! is_string($member['email'] ?? null) || filter_var(trim($member['email']), FILTER_VALIDATE_EMAIL) === false) {
                throw new ValidationException(['members' => ['Each member needs a valid email address.']]);
            }
            $members[] = ['email' => strtolower(trim($member['email'])), 'role' => $this->role($member['role'] ?? 'viewer')];
        }

        return $members;
    }

    private function role(mixed $role): string
    {
        return in_array($role, self::ROLES, true) ? $role : throw new ValidationException(['role' => ['Choose admin, editor or viewer.']]);
    }

    /** @param list<array<string, mixed>> $members */
    private function assertAssignee(array $members, ?int $assigneeId): void
    {
        if ($assigneeId === null) {
            return;
        }
        foreach ($members as $member) {
            if ((int) $member['user_id'] === $assigneeId && $member['status'] === 'accepted') {
                return;
            }
        }
        throw new ValidationException(['assignee_id' => ['Choose a member who joined this team.']]);
    }

    /** @param list<array<string, mixed>> $members */
    private function assertAdminRemains(array $members, int $changingUserId): void
    {
        foreach ($members as $member) {
            if ((int) $member['user_id'] !== $changingUserId && $member['role'] === 'admin' && $member['status'] === 'accepted') {
                return;
            }
        }
        throw new ValidationException(['role' => ['A team needs at least one admin. Make someone else admin first.']]);
    }

    /** @param list<array<string, mixed>> $members @return array<string, mixed> */
    private function findMember(array $members, int $userId, bool $accepted = false): array
    {
        foreach ($members as $member) {
            if ((int) $member['user_id'] === $userId && (! $accepted || $member['status'] === 'accepted')) {
                return $member;
            }
        }
        $this->notFound();
    }

    /** @param list<string> $roles */
    private function requireRole(string $goalId, int $userId, array $roles): void
    {
        $member = $this->acceptedMember($goalId, $userId);
        if (! in_array($member['role'], $roles, true)) {
            throw new HttpException(403, 'FORBIDDEN', 'Your role cannot make this change.');
        }
    }

    /** @return array<string, mixed> */
    private function acceptedMember(string $goalId, int $userId): array
    {
        $member = $this->teams->member($goalId, $userId);
        if ($member === null || $member['status'] !== 'accepted' || $this->teams->goal($goalId) === null) {
            $this->notFound();
        }

        return $member;
    }

    /** @return array<string, mixed> */
    private function lockGoal(string $goalId): array
    {
        return $this->teams->goal($goalId, true) ?? $this->notFound();
    }

    /** @param array<string, mixed> $input */
    private function assertVersion(array $input, int $current): void
    {
        if (! is_int($input['base_version'] ?? null)) {
            throw new ValidationException(['base_version' => ['The base version is required.']]);
        }
        if ($input['base_version'] !== $current) {
            throw new HttpException(409, 'VERSION_CONFLICT', 'Someone else changed this first. Reload and try again.');
        }
    }

    /** @param array<string, mixed> $input @param list<string> $allowed */
    private function keys(array $input, array $allowed): void
    {
        $unknown = array_diff(array_keys($input), $allowed);
        if ($unknown !== []) {
            throw new ValidationException(['_unknown' => ['Unknown fields: '.implode(', ', $unknown).'.']]);
        }
    }

    private function text(mixed $value, string $field, int $max, bool $required): string
    {
        $text = is_string($value) ? ($field === 'name' ? TextNormalizer::title($value) : TextNormalizer::body($value)) : null;
        if ($text === null || ($required && trim($text) === '') || TextNormalizer::codePoints($text) > $max) {
            throw new ValidationException([$field => [$required ? "Enter 1 to $max characters." : "Use at most $max characters."]]);
        }

        return $text;
    }

    private function date(mixed $value, string $field): ?string
    {
        if ($value === null || $value === '') {
            return null;
        }
        $date = is_string($value) ? DateTimeImmutable::createFromFormat('!Y-m-d', $value) : false;
        if ($date === false || $date->format('Y-m-d') !== $value) {
            throw new ValidationException([$field => ['Use a valid date.']]);
        }

        return $value;
    }

    /**
     * Completing a repeating task queues its next occurrence. The due date moves
     * to the next rule date and the reminder keeps its offset from the due date.
     *
     * @param array<string, mixed> $task the completed row with its new fields
     */
    private function repeatTask(array $task, int $userId): void
    {
        if ($task['repeat_rule'] === null) {
            return;
        }
        $rule = TeamTaskRepeat::normalize(json_decode((string) $task['repeat_rule'], true, 8, JSON_THROW_ON_ERROR));
        $timezone = TimeZoneNames::canonical($this->accounts->preferences($userId)['timezone']) ?? 'UTC';
        $from = $task['due_date'] ?? $this->clock->now()->setTimezone(new DateTimeZone($timezone))->format('Y-m-d');
        $next = TeamTaskRepeat::next((string) $from, $rule);
        if ($next === null) {
            return;
        }
        $days = (int) (new DateTimeImmutable((string) $from))->diff(new DateTimeImmutable($next))->days;
        $reminder = $task['reminder_at'] === null ? null : Timestamp::database((new DateTimeImmutable((string) $task['reminder_at'], new DateTimeZone('UTC')))->modify("+$days days"));
        $now = $this->now();
        $this->teams->insertTask([
            'id' => $this->uuid->generate(),
            'team_goal_id' => (string) $task['team_goal_id'],
            'name' => (string) $task['name'],
            'description' => (string) $task['description'],
            'importance' => (int) $task['importance'],
            'assignee_id' => $task['assignee_id'] === null ? null : (int) $task['assignee_id'],
            'status' => 'todo',
            'start_date' => null,
            'due_date' => $next,
            'estimated_minutes' => $task['estimated_minutes'] === null ? null : (int) $task['estimated_minutes'],
            'reminder_at' => $reminder,
            'repeat_rule' => (string) $task['repeat_rule'],
            'created_by' => $userId,
            'completed_at' => null,
            'created_at' => $now,
            'updated_at' => $now,
        ]);
    }

    private function instant(mixed $value, string $field): ?string
    {
        if ($value === null) {
            return null;
        }
        try {
            $date = is_string($value) && $value !== '' ? new DateTimeImmutable($value) : null;
        } catch (\Exception) {
            $date = null;
        }

        return $date === null ? throw new ValidationException([$field => ['The date and time are invalid.']]) : Timestamp::database($date);
    }

    private function now(): string
    {
        return Timestamp::database($this->clock->now());
    }

    private function notFound(): never
    {
        throw new HttpException(404, 'NOT_FOUND', 'The requested resource was not found.');
    }
}
