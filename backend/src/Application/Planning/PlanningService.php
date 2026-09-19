<?php

declare(strict_types=1);

namespace Planner\Application\Planning;

use DateTimeImmutable;
use Planner\Domain\Planning\GoalProgressCalculator;
use Planner\Domain\Planning\GoalStatus;
use Planner\Domain\Planning\GraphGuard;
use Planner\Domain\Planning\Importance;
use Planner\Domain\Planning\MilestoneStatus;
use Planner\Domain\Planning\TaskStatus;
use Planner\Http\HttpException;
use Planner\Http\ValidationException;
use Planner\Infrastructure\Database\TransactionManager;
use Planner\Infrastructure\Persistence\Pdo\Planning\PdoPlanningRepository;
use Planner\Infrastructure\Persistence\Pdo\Activity\PdoActivityRepository;
use Planner\Support\Clock;
use Planner\Support\TextNormalizer;
use Planner\Support\Timestamp;
use Planner\Support\UuidGenerator;

final readonly class PlanningService
{
    public function __construct(
        private PdoPlanningRepository $repository,
        private TransactionManager $transactions,
        private GraphGuard $graphs,
        private GoalProgressCalculator $progress,
        private UuidGenerator $uuid,
        private Clock $clock,
        private PdoActivityRepository $activities,
    ) {}

    /** @return list<array<string, mixed>> */
    public function list(string $type, int $userId): array
    {
        $rows = array_map($this->serialize(...), $this->repository->list($type, $userId));

        if ($type === 'goal') {
            $progress = $this->progress($userId);

            foreach ($rows as &$row) {
                $row['progress'] = round($progress[(string) $row['id']] ?? 0.0, 2);
            }
            unset($row);
        }

        if ($type === 'milestone') {
            foreach ($rows as &$row) {
                $row['progress'] = $this->milestoneProgress($userId, (string) $row['id'], (string) $row['status']);
            }
            unset($row);
        }

        if (in_array($type, ['goal', 'milestone', 'task'], true)) {
            foreach ($rows as &$row) {
                $row['tag_ids'] = array_map('strval', $this->repository->tagIds($type, $userId, (string) $row['id']));
            }
            unset($row);
        }

        return $rows;
    }

    /** @return array<string, mixed> */
    public function show(string $type, int $userId, string $id): array
    {
        $row = $this->owned($type, $userId, $id);
        $result = $this->serialize($row);

        if ($type === 'goal') {
            $result['progress'] = round($this->progress($userId)[$id] ?? 0.0, 2);
        }

        if ($type === 'milestone') {
            $result['completion_locked'] = array_filter(
                $this->repository->prerequisites($userId, $id),
                static fn (array $prerequisite): bool => $prerequisite['status'] !== MilestoneStatus::Completed->value,
            ) !== [];
            $result['progress'] = $this->milestoneProgress($userId, $id, (string) $row['status']);
        }

        if (in_array($type, ['goal', 'milestone', 'task'], true)) {
            $result['tag_ids'] = array_map('strval', $this->repository->tagIds($type, $userId, $id));
        }

        return $result;
    }

    /** @param array<string, mixed> $input @return array<string, mixed> */
    public function create(string $type, int $userId, array $input): array
    {
        $values = $this->validateCreate($type, $input);

        return $this->transactions->run(function () use ($type, $userId, $values): array {
            $this->repository->lockOwner($userId);
            $this->validateParents($type, $userId, $values);
            $tagIds = $values['tag_ids'] ?? [];
            unset($values['tag_ids']);
            $this->validateTags($userId, $tagIds);

            if ($type === 'area' && count($this->repository->list('area', $userId)) >= 4) {
                throw new ValidationException(['name' => ['Each account can have at most four active Areas.']]);
            }

            $row = $this->repository->insert($type, $userId, $this->uuid->generate(), $values, $this->now());

            if ($tagIds !== []) {
                $this->repository->syncTags($type, $userId, (string) $row['id'], $tagIds);
            }

            $result = $this->serialize($row);

            if (in_array($type, ['goal', 'milestone', 'task'], true)) {
                $result['tag_ids'] = array_map('strval', $tagIds);
            }

            return $result;
        });
    }

    /** @param array<string, mixed> $input @return array<string, mixed> */
    public function update(string $type, int $userId, string $id, array $input): array
    {
        $baseVersion = $this->baseVersion($input);
        unset($input['base_version']);
        $changes = $this->validateUpdate($type, $input);

        return $this->transactions->run(function () use ($type, $userId, $id, $baseVersion, $changes): array {
            $this->repository->lockOwner($userId);
            $current = $this->owned($type, $userId, $id, true);
            $tagIds = $changes['tag_ids'] ?? null;
            unset($changes['tag_ids']);
            $this->validateParents($type, $userId, [...$current, ...$changes]);

            if ($type === 'task') {
                $this->validateDates([...$current, ...$changes]);

                if ($current['status'] === TaskStatus::Done->value && array_key_exists('status', $changes)) {
                    throw new ValidationException(['status' => ['Use the reopen Task operation.']]);
                }
            }

            if ($type === 'milestone' && $current['status'] === MilestoneStatus::Completed->value
                && array_key_exists('status', $changes)) {
                throw new ValidationException(['status' => ['Use the reopen Milestone operation.']]);
            }
            $currentTags = in_array($type, ['goal', 'milestone', 'task'], true)
                ? $this->repository->tagIds($type, $userId, $id)
                : [];
            $tagsSame = $tagIds === null || $tagIds === $currentTags;

            if ($this->same($current, $changes) && $tagsSame) {
                $result = $this->serialize($current);

                if (in_array($type, ['goal', 'milestone', 'task'], true)) {
                    $result['tag_ids'] = array_map('strval', $currentTags);
                }

                return $result;
            }

            $this->assertVersion($current, $baseVersion);

            if ($tagIds !== null) {
                $this->validateTags($userId, $tagIds);
                $this->repository->syncTags($type, $userId, $id, $tagIds);
            }

            $result = $this->serialize($this->repository->update($type, $userId, $id, $changes, $this->now()));

            if (in_array($type, ['goal', 'milestone', 'task'], true)) {
                $result['tag_ids'] = array_map('strval', $tagIds ?? $currentTags);
            }

            return $result;
        });
    }

    /** @param array<string, mixed> $input @return array<string, mixed> */
    public function archive(string $type, int $userId, string $id, array $input): array
    {
        $this->keys($input, ['base_version']);
        $baseVersion = $this->baseVersion($input);

        return $this->transactions->run(function () use ($type, $userId, $id, $baseVersion): array {
            $this->repository->lockOwner($userId);
            $current = $this->owned($type, $userId, $id, true);
            $this->assertVersion($current, $baseVersion);

            if ($type === 'area') {
                if (count($this->repository->list('area', $userId)) <= 1) {
                    throw new ValidationException(['area' => ['The last active Area cannot be archived.']]);
                }

                $this->requireEmpty('goal', $userId, 'area_id', $id, 'The Area still contains active Goals.');
            } elseif ($type === 'goal') {
                $this->requireEmpty('goal', $userId, 'parent_goal_id', $id, 'The Goal still has child Goals.');
                $this->requireEmpty('milestone', $userId, 'goal_id', $id, 'The Goal still has Milestones.');
                $this->requireEmpty('task', $userId, 'goal_id', $id, 'The Goal still has Tasks.');
            } elseif ($type === 'milestone') {
                $this->requireEmpty('task', $userId, 'milestone_id', $id, 'The Milestone still has Tasks.');

                if ($this->repository->milestoneDependencyCount($userId, $id) > 0) {
                    throw new ValidationException(['milestone' => ['The Milestone still has prerequisite relationships.']]);
                }
            }

            return $this->serialize($this->repository->archive($type, $userId, $id, $this->now()));
        });
    }

    /** @param array<string, mixed> $input @return array<string, mixed> */
    public function moveGoal(int $userId, string $id, array $input): array
    {
        $this->keys($input, ['base_version', 'area_id', 'parent_goal_id', 'position']);
        $baseVersion = $this->baseVersion($input);
        $areaId = $this->nullableUuid($input, 'area_id');
        $parentId = $this->nullableUuid($input, 'parent_goal_id');

        if (($areaId === null) === ($parentId === null)) {
            throw new ValidationException(['parent' => ['Select exactly one primary location.']]);
        }

        $position = $this->integer($input, 'position', 0, PHP_INT_MAX, 0);

        return $this->transactions->run(function () use ($userId, $id, $baseVersion, $areaId, $parentId, $position): array {
            $this->repository->lockOwner($userId);
            $current = $this->owned('goal', $userId, $id, true);
            $changes = ['area_id' => $areaId, 'parent_goal_id' => $parentId, 'position' => $position];

            if ($this->same($current, $changes)) {
                return $this->serialize($current);
            }

            $this->assertVersion($current, $baseVersion);
            $this->validateParents('goal', $userId, $changes);

            if ($parentId !== null && $this->graphs->wouldCycle($this->repository->goalHierarchyEdges($userId), $id, $parentId)) {
                throw new ValidationException(['parent_goal_id' => ['The Goal hierarchy cannot contain a cycle.']]);
            }

            return $this->serialize($this->repository->update('goal', $userId, $id, $changes, $this->now()));
        });
    }

    /** @param array<string, mixed> $input @return array<string, mixed> */
    public function transition(string $type, int $userId, string $id, string $action, array $input): array
    {
        $allowed = $type === 'milestone' || $type === 'task'
            ? ['base_version', 'acknowledge_open_tasks', 'acknowledge_unchecked_items']
            : ['base_version', 'acknowledge_ancestor_reopen'];
        $this->keys($input, $allowed);
        $baseVersion = $this->baseVersion($input);

        return $this->transactions->run(function () use ($type, $userId, $id, $action, $input, $baseVersion): array {
            $this->repository->lockOwner($userId);
            $current = $this->owned($type, $userId, $id, true);
            $target = match ([$type, $action]) {
                ['goal', 'complete'] => GoalStatus::Completed->value,
                ['goal', 'reopen'] => GoalStatus::Active->value,
                ['milestone', 'complete'] => MilestoneStatus::Completed->value,
                ['milestone', 'reopen'] => MilestoneStatus::InProgress->value,
                ['task', 'complete'] => TaskStatus::Done->value,
                ['task', 'reopen'] => TaskStatus::InProgress->value,
                default => throw new \LogicException('Unsupported planning transition.'),
            };

            if ($current['status'] === $target) {
                return $this->serialize($current);
            }

            $this->assertVersion($current, $baseVersion);

            if ($type === 'goal' && $action === 'complete') {
                $hasChildren = $this->repository->activeCount('goal', $userId, 'parent_goal_id', $id) > 0
                    || $this->repository->activeCount('milestone', $userId, 'goal_id', $id) > 0
                    || $this->repository->activeCount('task', $userId, 'goal_id', $id) > 0;

                if ($hasChildren && ($this->progress($userId)[$id] ?? 0.0) < 100.0) {
                    throw new ValidationException(['status' => ['The Goal has not reached 100% progress.']]);
                }
            }

            if ($type === 'goal' && $action === 'reopen') {
                $goals = $this->repository->activeGoals($userId, true);
                $byId = [];

                foreach ($goals as $goal) {
                    $byId[(string) $goal['id']] = $goal;
                }

                $ancestorIds = [];
                $parentId = $current['parent_goal_id'];
                $visited = [];

                while ($parentId !== null) {
                    if (isset($visited[$parentId]) || !isset($byId[$parentId])) {
                        throw new \RuntimeException('Stored Goal hierarchy is invalid.');
                    }

                    $visited[$parentId] = true;

                    if ($byId[$parentId]['status'] === GoalStatus::Completed->value) {
                        $ancestorIds[] = $parentId;
                    }

                    $parentId = $byId[$parentId]['parent_goal_id'];
                }

                if ($ancestorIds !== [] && ($input['acknowledge_ancestor_reopen'] ?? false) !== true) {
                    throw new ValidationException(['acknowledge_ancestor_reopen' => ['Confirm reopening completed ancestor Goals.']]);
                }

                sort($ancestorIds, SORT_STRING);

                foreach ($ancestorIds as $ancestorId) {
                    $this->repository->update('goal', $userId, $ancestorId, [
                        'status' => GoalStatus::Active->value,
                        'completed_at' => null,
                    ], $this->now());
                }
            }

            if ($type === 'milestone' && $action === 'complete') {
                foreach ($this->repository->prerequisites($userId, $id, true) as $prerequisite) {
                    if ($prerequisite['status'] !== MilestoneStatus::Completed->value) {
                        throw new ValidationException(['status' => ['The Milestone has unfinished prerequisites.']]);
                    }
                }

                if ($this->unfinishedTasks($userId, $id) > 0 && ($input['acknowledge_open_tasks'] ?? false) !== true) {
                    throw new ValidationException(['acknowledge_open_tasks' => ['Confirm completion with unfinished Tasks.']]);
                }
            }

            if ($type === 'milestone' && $action === 'reopen'
                && $this->repository->completedDependents($userId, $id, true) !== []) {
                throw new ValidationException(['status' => ['Reopen completed dependent Milestones first.']]);
            }

            if ($type === 'task' && $action === 'complete'
                && $this->repository->activeCount('checklist', $userId, 'task_id', $id) > $this->checkedItems($userId, $id)
                && ($input['acknowledge_unchecked_items'] ?? false) !== true) {
                throw new ValidationException(['acknowledge_unchecked_items' => ['Confirm completion with unchecked Checklist items.']]);
            }

            $completedAt = in_array($target, ['Completed', 'Done'], true) ? $this->now() : null;

            $updated = $this->repository->update($type, $userId, $id, [
                'status' => $target,
                'completed_at' => $completedAt,
            ], $this->now());
            $timezone = $this->repository->ownerTimezone($userId);
            $effectiveDate = $this->clock->now()->setTimezone(new \DateTimeZone($timezone))->format('Y-m-d');
            $sourceType = $type;
            $actionName = in_array($target, ['Completed', 'Done'], true) ? 'completed' : 'reversed';
            $this->activities->insert(
                $this->uuid->generate(), $userId, $sourceType, $id, (int) $updated['version'],
                $actionName, $this->now(), $effectiveDate, $timezone,
                $actionName === 'reversed' ? $this->activities->completionId($userId, $sourceType, $id, $effectiveDate) : null,
            );

            return $this->serialize($updated);
        });
    }

    /** @param array<string, mixed> $input @return array<string, mixed> */
    public function addDependency(int $userId, string $milestoneId, array $input): array
    {
        $this->keys($input, ['prerequisite_id', 'base_version']);
        $prerequisiteId = $this->uuid($input, 'prerequisite_id');

        return $this->addRelation(
            $userId, 'milestone', $milestoneId, 'milestone', $prerequisiteId,
            'milestone_dependencies', 'milestone_id', 'prerequisite_id', $this->baseVersion($input),
            $this->repository->dependencyEdges(...),
        );
    }

    /** @param array<string, mixed> $input @return array<string, mixed> */
    public function addContribution(string $sourceType, int $userId, string $sourceId, array $input): array
    {
        $this->keys($input, ['goal_id', 'base_version']);
        $target = $this->uuid($input, 'goal_id');
        [$table, $sourceColumn, $targetColumn] = match ($sourceType) {
            'goal' => ['goal_contributions', 'source_goal_id', 'target_goal_id'],
            'milestone' => ['milestone_contributions', 'milestone_id', 'goal_id'],
            'task' => ['task_contributions', 'task_id', 'goal_id'],
            default => throw new HttpException(404, 'NOT_FOUND', 'The object type was not found.'),
        };
        $edges = $sourceType === 'goal' ? $this->repository->goalContributionEdges(...) : null;

        return $this->addRelation(
            $userId, $sourceType, $sourceId, 'goal', $target,
            $table, $sourceColumn, $targetColumn, $this->baseVersion($input), $edges,
        );
    }

    /** @param array<string, mixed> $input @return array<string, mixed> */
    public function removeRelation(string $kind, string $sourceType, int $userId, string $sourceId, string $targetId, array $input): array
    {
        $this->keys($input, ['base_version']);
        [$table, $sourceColumn, $targetColumn] = $kind === 'dependency'
            ? ['milestone_dependencies', 'milestone_id', 'prerequisite_id']
            : match ($sourceType) {
                'goal' => ['goal_contributions', 'source_goal_id', 'target_goal_id'],
                'milestone' => ['milestone_contributions', 'milestone_id', 'goal_id'],
                'task' => ['task_contributions', 'task_id', 'goal_id'],
                default => throw new HttpException(404, 'NOT_FOUND', 'The object type was not found.'),
            };

        return $this->transactions->run(function () use ($userId, $sourceType, $sourceId, $targetId, $input, $table, $sourceColumn, $targetColumn): array {
            $this->repository->lockOwner($userId);
            $source = $this->owned($sourceType, $userId, $sourceId, true);

            if (!$this->repository->edgeExists($table, $userId, $sourceColumn, $sourceId, $targetColumn, $targetId)) {
                return $this->serialize($source);
            }

            $this->assertVersion($source, $this->baseVersion($input));
            $this->repository->removeEdge($table, $userId, $sourceColumn, $sourceId, $targetColumn, $targetId);

            return $this->serialize($this->repository->update($sourceType, $userId, $sourceId, [], $this->now()));
        });
    }

    /** @param array<string, mixed> $input @return array<string, mixed> */
    public function createChecklist(int $userId, string $taskId, array $input): array
    {
        $this->keys($input, ['title', 'position']);
        $values = [
            'task_id' => $taskId,
            'title' => $this->text($input, 'title', 500, true),
            'checked' => 0,
            'position' => $this->integer($input, 'position', 0, PHP_INT_MAX, 0),
            'checked_at' => null,
        ];

        return $this->transactions->run(function () use ($userId, $taskId, $values): array {
            $this->repository->lockOwner($userId);
            $this->owned('task', $userId, $taskId, true);

            return $this->serialize($this->repository->insert('checklist', $userId, $this->uuid->generate(), $values, $this->now()));
        });
    }

    /** @param array<string, mixed> $input @return array<string, mixed> */
    public function updateChecklist(int $userId, string $taskId, string $id, array $input): array
    {
        $this->keys($input, ['base_version', 'title', 'checked', 'position']);
        $baseVersion = $this->baseVersion($input);
        $changes = [];

        if (array_key_exists('title', $input)) {
            $changes['title'] = $this->text($input, 'title', 500, true);
        }

        if (array_key_exists('position', $input)) {
            $changes['position'] = $this->integer($input, 'position', 0, PHP_INT_MAX);
        }

        if (array_key_exists('checked', $input)) {
            if (!is_bool($input['checked'])) {
                throw new ValidationException(['checked' => ['The value must be boolean.']]);
            }

            $changes['checked'] = $input['checked'] ? 1 : 0;
            $changes['checked_at'] = $input['checked'] ? $this->now() : null;
        }

        return $this->transactions->run(function () use ($userId, $taskId, $id, $baseVersion, $changes): array {
            $this->repository->lockOwner($userId);
            $item = $this->owned('checklist', $userId, $id, true);

            if ((string) $item['task_id'] !== $taskId) {
                throw new HttpException(404, 'NOT_FOUND', 'The Checklist item was not found.');
            }

            if ($this->same($item, $changes)) {
                return $this->serialize($item);
            }

            $this->assertVersion($item, $baseVersion);

            $updated = $this->repository->update('checklist', $userId, $id, $changes, $this->now());
            if (array_key_exists('checked', $changes) && (int) $item['checked'] !== (int) $changes['checked']) {
                $timezone = $this->repository->ownerTimezone($userId);
                $effectiveDate = $this->clock->now()->setTimezone(new \DateTimeZone($timezone))->format('Y-m-d');
                $action = (int) $changes['checked'] === 1 ? 'completed' : 'reversed';
                $this->activities->insert(
                    $this->uuid->generate(), $userId, 'checklist', $id, (int) $updated['version'], $action,
                    $this->now(), $effectiveDate, $timezone,
                    $action === 'reversed' ? $this->activities->completionId($userId, 'checklist', $id, $effectiveDate) : null,
                    ['task_id' => $taskId],
                );
            }

            return $this->serialize($updated);
        });
    }

    /** @param array<string, mixed> $input @return array<string, mixed> */
    public function archiveChecklist(int $userId, string $taskId, string $id, array $input): array
    {
        $this->keys($input, ['base_version']);

        return $this->transactions->run(function () use ($userId, $taskId, $id, $input): array {
            $this->repository->lockOwner($userId);
            $item = $this->owned('checklist', $userId, $id, true);

            if ((string) $item['task_id'] !== $taskId) {
                throw new HttpException(404, 'NOT_FOUND', 'The Checklist item was not found.');
            }

            $this->assertVersion($item, $this->baseVersion($input));

            return $this->serialize($this->repository->archive('checklist', $userId, $id, $this->now()));
        });
    }

    /** @param array<string, mixed> $input @return array<string, mixed> */
    public function saveTaskNote(int $userId, string $taskId, array $input): array
    {
        $this->keys($input, ['body', 'base_version']);
        $body = $this->text($input, 'body', 50_000, false);
        $baseVersion = isset($input['base_version']) && is_int($input['base_version']) ? $input['base_version'] : null;

        return $this->transactions->run(function () use ($userId, $taskId, $body, $baseVersion): array {
            $this->repository->lockOwner($userId);
            $this->owned('task', $userId, $taskId, true);
            $current = $this->repository->taskNote($userId, $taskId);

            if ($current !== null && $current['body'] === $body) {
                return $this->serialize($current);
            }

            return $this->serialize($this->repository->saveTaskNote($userId, $taskId, $body, $baseVersion, $this->now()));
        });
    }

    /** @return array<string, mixed>|null */
    public function taskNote(int $userId, string $taskId): ?array
    {
        $this->owned('task', $userId, $taskId);
        $note = $this->repository->taskNote($userId, $taskId);

        return $note === null ? null : $this->serialize($note);
    }

    /** @return list<array<string, mixed>> */
    public function checklist(int $userId, string $taskId): array
    {
        $this->owned('task', $userId, $taskId);

        return array_values(array_filter(
            $this->list('checklist', $userId),
            static fn (array $item): bool => $item['task_id'] === $taskId,
        ));
    }

    /** @return array<string, float> */
    public function progress(int $userId): array
    {
        $rows = $this->repository->progressRows($userId);

        return $this->progress->calculate($rows['goals'], $rows['milestones'], $rows['tasks']);
    }

    /** @return list<array<string, mixed>> */
    public function goalChildren(int $userId, string $goalId): array
    {
        $this->owned('goal', $userId, $goalId);

        return array_values(array_filter(
            $this->list('goal', $userId),
            static fn (array $goal): bool => $goal['parent_goal_id'] === $goalId,
        ));
    }

    /** @return list<array<string, mixed>> */
    public function prerequisites(int $userId, string $milestoneId): array
    {
        $this->owned('milestone', $userId, $milestoneId);

        return array_map($this->serialize(...), $this->repository->prerequisites($userId, $milestoneId));
    }

    /** @return list<array<string, mixed>> */
    public function contributions(string $sourceType, int $userId, string $sourceId): array
    {
        $this->owned($sourceType, $userId, $sourceId);

        return array_map($this->serialize(...), $this->repository->contributionGoals($sourceType, $userId, $sourceId));
    }

    /** @param array<string, mixed> $input @return list<array<string, mixed>> */
    public function reorder(string $type, int $userId, array $input, ?string $parentId = null): array
    {
        $this->keys($input, ['items']);
        $items = $input['items'] ?? null;

        if (!is_array($items) || !array_is_list($items)) {
            throw new ValidationException(['items' => ['The ordered item list is invalid.']]);
        }

        return $this->transactions->run(function () use ($type, $userId, $items, $parentId): array {
            $this->repository->lockOwner($userId);
            $seen = [];

            foreach ($items as $position => $item) {
                if (!is_array($item)) {
                    throw new ValidationException(['items' => ['The ordered item list is invalid.']]);
                }

                $this->keys($item, ['id', 'base_version']);
                $id = $type === 'area' ? $this->uuid($item, 'id') : $this->uuid($item, 'id');

                if (isset($seen[$id])) {
                    throw new ValidationException(['items' => ['The identifier is duplicated.']]);
                }

                $seen[$id] = true;
                $current = $this->owned($type, $userId, $id, true);

                if ($parentId !== null && $type === 'checklist' && $current['task_id'] !== $parentId) {
                    throw new HttpException(404, 'NOT_FOUND', 'The requested resource was not found.');
                }

                if ((int) $current['position'] === $position) {
                    continue;
                }

                $this->assertVersion($current, $this->baseVersion($item));
                $this->repository->update($type, $userId, $id, ['position' => $position], $this->now());
            }

            return $type === 'checklist' && $parentId !== null
                ? array_values(array_filter($this->list('checklist', $userId), static fn (array $item): bool => $item['task_id'] === $parentId))
                : $this->list($type, $userId);
        });
    }

    public function backfillDefaultAreas(): int
    {
        $created = 0;

        foreach ($this->repository->usersWithoutAreas() as $userId) {
            $created += $this->transactions->run(function () use ($userId): int {
                $this->repository->lockOwner($userId);

                if ($this->repository->list('area', $userId, true) !== []) {
                    return 0;
                }

                $this->repository->insertDefaultAreas($userId, [
                    ['id' => $this->uuid->generate(), 'name' => 'Area 1', 'position' => 0],
                    ['id' => $this->uuid->generate(), 'name' => 'Area 2', 'position' => 1],
                    ['id' => $this->uuid->generate(), 'name' => 'Area 3', 'position' => 2],
                ], $this->now());

                return 3;
            });
        }

        return $created;
    }

    /** @return array{completed: int, total: int, percentage: float, source: string} */
    private function milestoneProgress(int $userId, string $milestoneId, string $status): array
    {
        $progress = $this->repository->milestoneTaskProgress($userId, $milestoneId);
        $percentage = $progress['total'] === 0
            ? ($status === MilestoneStatus::Completed->value ? 100.0 : 0.0)
            : ($progress['completed'] / $progress['total']) * 100;

        return [
            ...$progress,
            'percentage' => round($percentage, 2),
            'source' => $progress['total'] === 0 ? 'status' : 'tasks',
        ];
    }

    /** @param array<string, mixed> $input @return array<string, mixed> */
    private function validateCreate(string $type, array $input): array
    {
        $allowed = match ($type) {
            'area' => ['name', 'description', 'position'],
            'goal' => ['area_id', 'parent_goal_id', 'name', 'description', 'expected_result', 'completion_criteria', 'importance', 'deadline', 'position', 'tag_ids'],
            'milestone' => ['goal_id', 'name', 'description', 'completion_criteria', 'importance', 'deadline', 'position', 'tag_ids'],
            'task' => ['goal_id', 'milestone_id', 'name', 'description', 'expected_result', 'completion_criteria', 'importance', 'start_date', 'deadline', 'scheduled_start', 'scheduled_end', 'position', 'tag_ids'],
            default => throw new \LogicException('Unsupported planning resource type.'),
        };
        $this->keys($input, $allowed);
        $values = [
            'name' => $this->text($input, 'name', $type === 'area' ? 80 : 200, true),
            'description' => $this->text($input, 'description', 10_000, false, ''),
            'position' => $this->integer($input, 'position', 0, PHP_INT_MAX, 0),
        ];

        if ($type !== 'area') {
            $values['completion_criteria'] = $this->text($input, 'completion_criteria', 10_000, false, '');
            $values['importance'] = (new Importance($this->integer($input, 'importance', 1, 5, 3)))->value;
            $values['deadline'] = $this->date($input, 'deadline');
            $values['tag_ids'] = $this->tagIds($input['tag_ids'] ?? []);
        }

        if ($type === 'goal') {
            $values += [
                'area_id' => $this->nullableUuid($input, 'area_id'),
                'parent_goal_id' => $this->nullableUuid($input, 'parent_goal_id'),
                'expected_result' => $this->text($input, 'expected_result', 10_000, false, ''),
                'status' => GoalStatus::Active->value,
                'completed_at' => null,
            ];
        } elseif ($type === 'milestone') {
            $values += ['goal_id' => $this->uuid($input, 'goal_id'), 'status' => MilestoneStatus::NotStarted->value, 'completed_at' => null];
        } elseif ($type === 'task') {
            $values += [
                'goal_id' => $this->nullableUuid($input, 'goal_id'),
                'milestone_id' => $this->nullableUuid($input, 'milestone_id'),
                'expected_result' => $this->text($input, 'expected_result', 10_000, false, ''),
                'status' => TaskStatus::NotStarted->value,
                'start_date' => $this->date($input, 'start_date'),
                'scheduled_start' => $this->dateTime($input, 'scheduled_start'),
                'scheduled_end' => $this->dateTime($input, 'scheduled_end'),
                'completed_at' => null,
            ];
            $this->validateDates($values);
        }

        return $values;
    }

    /** @param array<string, mixed> $input @return array<string, mixed> */
    private function validateUpdate(string $type, array $input): array
    {
        $allowed = match ($type) {
            'area' => ['name', 'description', 'position'],
            'goal' => ['name', 'description', 'expected_result', 'completion_criteria', 'importance', 'deadline', 'position', 'tag_ids'],
            'milestone' => ['goal_id', 'name', 'description', 'completion_criteria', 'importance', 'deadline', 'position', 'status', 'tag_ids'],
            'task' => ['goal_id', 'milestone_id', 'name', 'description', 'expected_result', 'completion_criteria', 'importance', 'status', 'start_date', 'deadline', 'scheduled_start', 'scheduled_end', 'position', 'tag_ids'],
            default => throw new \LogicException('Unsupported planning resource type.'),
        };
        $this->keys($input, $allowed);
        $changes = [];

        foreach ($input as $field => $value) {
            $changes[$field] = match ($field) {
                'name' => $this->text($input, $field, $type === 'area' ? 80 : 200, true),
                'description', 'expected_result', 'completion_criteria' => $this->text($input, $field, 10_000, false),
                'importance' => (new Importance($this->integer($input, $field, 1, 5)))->value,
                'position' => $this->integer($input, $field, 0, PHP_INT_MAX),
                'deadline', 'start_date' => $this->date($input, $field),
                'scheduled_start', 'scheduled_end' => $this->dateTime($input, $field),
                'goal_id', 'milestone_id' => $this->nullableUuid($input, $field),
                'tag_ids' => $this->tagIds($value),
                'status' => $this->nonTerminalStatus($type, $value),
                default => $value,
            };
        }

        if ($type === 'task') {
            $this->validateDates($changes);
        }

        return $changes;
    }

    /** @param array<string, mixed> $values */
    private function validateParents(string $type, int $userId, array $values): void
    {
        if ($type === 'goal') {
            $areaId = $values['area_id'] ?? null;
            $parentId = $values['parent_goal_id'] ?? null;

            if (($areaId === null) === ($parentId === null)) {
                throw new ValidationException(['parent' => ['A Goal must have exactly one primary location.']]);
            }

            $destination = $areaId !== null
                ? $this->owned('area', $userId, (string) $areaId, true)
                : $this->owned('goal', $userId, (string) $parentId, true);

            if (($destination['status'] ?? GoalStatus::Active->value) === GoalStatus::Completed->value) {
                throw new ValidationException(['parent_goal_id' => ['Items cannot be added to a completed Goal.']]);
            }
        } elseif ($type === 'milestone') {
            $this->owned('goal', $userId, (string) $values['goal_id'], true);
        } elseif ($type === 'task') {
            $goalId = $values['goal_id'] ?? null;
            $milestoneId = $values['milestone_id'] ?? null;

            if ($goalId !== null && $milestoneId !== null) {
                throw new ValidationException(['parent' => ['A Task can have only one primary location.']]);
            }

            if ($goalId !== null) {
                $this->owned('goal', $userId, (string) $goalId, true);
            }

            if ($milestoneId !== null) {
                $this->owned('milestone', $userId, (string) $milestoneId, true);
            }
        }
    }

    /** @param list<int> $tagIds */
    private function validateTags(int $userId, array $tagIds): void
    {
        if ($tagIds === []) {
            return;
        }

        if ($this->repository->lockOwnedTagIds($userId, $tagIds) !== $tagIds) {
            throw new ValidationException(['tag_ids' => ['One or more Tags are unavailable.']]);
        }
    }

    /** @param callable(int): list<array{0: string, 1: string}>|null $edgeLoader @return array<string, mixed> */
    private function addRelation(
        int $userId,
        string $sourceType,
        string $sourceId,
        string $targetType,
        string $targetId,
        string $table,
        string $sourceColumn,
        string $targetColumn,
        int $baseVersion,
        ?callable $edgeLoader,
    ): array {
        return $this->transactions->run(function () use ($userId, $sourceType, $sourceId, $targetType, $targetId, $table, $sourceColumn, $targetColumn, $baseVersion, $edgeLoader): array {
            $this->repository->lockOwner($userId);
            $source = $this->owned($sourceType, $userId, $sourceId, true);
            $target = $this->owned($targetType, $userId, $targetId, true);

            if ($this->repository->edgeExists($table, $userId, $sourceColumn, $sourceId, $targetColumn, $targetId)) {
                return $this->serialize($source);
            }

            $this->assertVersion($source, $baseVersion);

            if ($edgeLoader !== null && $this->graphs->wouldCycle($edgeLoader($userId), $sourceId, $targetId)) {
                throw new ValidationException(['relationship' => ['This relationship would create a cycle.']]);
            }

            if ($table === 'milestone_dependencies' && $source['status'] === MilestoneStatus::Completed->value
                && $target['status'] !== MilestoneStatus::Completed->value) {
                throw new ValidationException(['prerequisite_id' => ['A completed Milestone cannot be locked.']]);
            }

            $this->repository->addEdge($table, $userId, $sourceColumn, $sourceId, $targetColumn, $targetId, $this->now());

            return $this->serialize($this->repository->update($sourceType, $userId, $sourceId, [], $this->now()));
        });
    }

    /** @return array<string, mixed> */
    private function owned(string $type, int $userId, string $id, bool $forUpdate = false): array
    {
        return $this->repository->find($type, $userId, $id, $forUpdate)
            ?? throw new HttpException(404, 'NOT_FOUND', 'The requested resource was not found.');
    }

    /** @param array<string, mixed> $row */
    private function assertVersion(array $row, int $baseVersion): void
    {
        if ((int) $row['version'] !== $baseVersion) {
            throw new HttpException(409, 'VERSION_CONFLICT', 'The resource has changed.', payload: ['current' => $this->serialize($row)]);
        }
    }

    private function requireEmpty(string $type, int $userId, string $column, string $id, string $message): void
    {
        if ($this->repository->activeCount($type, $userId, $column, $id) > 0) {
            throw new ValidationException(['archive' => [$message]]);
        }
    }

    private function unfinishedTasks(int $userId, string $milestoneId): int
    {
        return count(array_filter(
            $this->repository->list('task', $userId),
            static fn (array $task): bool => $task['milestone_id'] === $milestoneId
                && $task['series_id'] === null
                && $task['status'] !== TaskStatus::Done->value,
        ));
    }

    private function checkedItems(int $userId, string $taskId): int
    {
        return count(array_filter(
            $this->repository->list('checklist', $userId),
            static fn (array $item): bool => $item['task_id'] === $taskId && (int) $item['checked'] === 1,
        ));
    }

    /** @param array<string, mixed> $row @param array<string, mixed> $changes */
    private function same(array $row, array $changes): bool
    {
        foreach ($changes as $key => $value) {
            $current = $row[$key] ?? null;

            if (is_int($value) && is_numeric($current)) {
                $current = (int) $current;
            }

            if ($current !== $value) {
                return false;
            }
        }

        return true;
    }

    /** @param array<string, mixed> $row @return array<string, mixed> */
    private function serialize(array $row): array
    {
        foreach (['version', 'position', 'importance'] as $field) {
            if (isset($row[$field])) {
                $row[$field] = (int) $row[$field];
            }
        }

        if (isset($row['checked'])) {
            $row['checked'] = (bool) $row['checked'];
        }

        foreach (['created_at', 'updated_at', 'completed_at', 'archived_at', 'checked_at', 'deleted_at', 'scheduled_start', 'scheduled_end'] as $field) {
            if (array_key_exists($field, $row)) {
                $row[$field] = Timestamp::api($row[$field] === null ? null : (string) $row[$field]);
            }
        }

        unset($row['user_id']);

        return $row;
    }

    /** @param array<string, mixed> $input @param list<string> $allowed */
    private function keys(array $input, array $allowed): void
    {
        if (array_diff(array_keys($input), $allowed) !== []) {
            throw new ValidationException(['_unknown' => ['The request contains an unsupported field.']]);
        }
    }

    /** @param array<string, mixed> $input */
    private function text(array $input, string $field, int $max, bool $required, string $default = ''): string
    {
        $value = $input[$field] ?? $default;

        if (!is_string($value)) {
            throw new ValidationException([$field => ['The value must be a string.']]);
        }

        $value = TextNormalizer::nfc(trim(str_replace(["\r\n", "\r"], "\n", $value)));
        $length = mb_strlen($value);

        if (($required && $length === 0) || $length > $max || TextNormalizer::hasForbiddenBodyControl($value)) {
            throw new ValidationException([$field => ["The value must contain between 1 and $max characters."]]);
        }

        return $value;
    }

    /** @param array<string, mixed> $input */
    private function integer(array $input, string $field, int $min, int $max, ?int $default = null): int
    {
        $value = $input[$field] ?? $default;

        if (!is_int($value) || $value < $min || $value > $max) {
            throw new ValidationException([$field => ["The value must be between $min and $max."]]);
        }

        return $value;
    }

    /** @return list<int> */
    private function tagIds(mixed $value): array
    {
        if (!is_array($value) || !array_is_list($value) || count($value) > 20) {
            throw new ValidationException(['tag_ids' => ['The Tag list is invalid.']]);
        }

        $ids = [];

        foreach ($value as $id) {
            if (is_string($id) && preg_match('/^[1-9][0-9]*$/D', $id) === 1) {
                $id = filter_var($id, FILTER_VALIDATE_INT);
            }

            if (!is_int($id) || $id < 1) {
                throw new ValidationException(['tag_ids' => ['The Tag list is invalid.']]);
            }

            $ids[] = $id;
        }

        $ids = array_values(array_unique($ids));
        sort($ids, SORT_NUMERIC);

        return $ids;
    }

    private function nonTerminalStatus(string $type, mixed $value): string
    {
        $allowed = match ($type) {
            'milestone' => [MilestoneStatus::NotStarted->value, MilestoneStatus::InProgress->value],
            'task' => [TaskStatus::NotStarted->value, TaskStatus::InProgress->value, TaskStatus::Blocked->value],
            default => [],
        };

        if (!is_string($value) || !in_array($value, $allowed, true)) {
            throw new ValidationException(['status' => ['The status is invalid for this operation.']]);
        }

        return $value;
    }

    /** @param array<string, mixed> $input */
    private function uuid(array $input, string $field): string
    {
        $value = $input[$field] ?? null;

        if (!is_string($value) || preg_match('/^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/D', $value) !== 1) {
            throw new ValidationException([$field => ['The UUID is invalid.']]);
        }

        return $value;
    }

    /** @param array<string, mixed> $input */
    private function nullableUuid(array $input, string $field): ?string
    {
        return !array_key_exists($field, $input) || $input[$field] === null ? null : $this->uuid($input, $field);
    }

    /** @param array<string, mixed> $input */
    private function baseVersion(array $input): int
    {
        return $this->integer($input, 'base_version', 1, PHP_INT_MAX);
    }

    /** @param array<string, mixed> $input */
    private function date(array $input, string $field): ?string
    {
        if (!array_key_exists($field, $input) || $input[$field] === null) {
            return null;
        }

        $value = $input[$field];

        if (!is_string($value) || !preg_match('/^\d{4}-\d{2}-\d{2}$/D', $value)) {
            throw new ValidationException([$field => ['The date is invalid.']]);
        }

        $date = DateTimeImmutable::createFromFormat('!Y-m-d', $value);

        if ($date === false || $date->format('Y-m-d') !== $value) {
            throw new ValidationException([$field => ['The date is invalid.']]);
        }

        return $value;
    }

    /** @param array<string, mixed> $input */
    private function dateTime(array $input, string $field): ?string
    {
        if (!array_key_exists($field, $input) || $input[$field] === null) {
            return null;
        }

        $value = $input[$field];

        try {
            $date = is_string($value) ? new DateTimeImmutable($value) : null;
        } catch (\Exception) {
            $date = null;
        }

        if ($date === null) {
            throw new ValidationException([$field => ['The date and time are invalid.']]);
        }

        return Timestamp::database($date);
    }

    /** @param array<string, mixed> $values */
    private function validateDates(array $values): void
    {
        if (($values['start_date'] ?? null) !== null && ($values['deadline'] ?? null) !== null
            && $values['start_date'] > $values['deadline']) {
            throw new ValidationException(['deadline' => ['The deadline cannot be before the start date.']]);
        }

        if (($values['scheduled_start'] ?? null) !== null && ($values['scheduled_end'] ?? null) !== null
            && $values['scheduled_start'] >= $values['scheduled_end']) {
            throw new ValidationException(['scheduled_end' => ['The scheduled end must be after the scheduled start.']]);
        }
    }

    private function now(): string
    {
        return Timestamp::database($this->clock->now());
    }
}
