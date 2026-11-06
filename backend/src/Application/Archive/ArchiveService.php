<?php

declare(strict_types=1);

namespace Planner\Application\Archive;

use DateInterval;
use DateTimeImmutable;
use DateTimeZone;
use Planner\Http\HttpException;
use Planner\Http\ValidationException;
use Planner\Application\Files\ProcessFileDeletion;
use Planner\Infrastructure\Database\TransactionManager;
use Planner\Infrastructure\Persistence\Pdo\Files\PendingDeletionRepository;
use Planner\Infrastructure\Persistence\Pdo\PdoCascadeDeleter;
use Planner\Infrastructure\Persistence\Pdo\Planning\PdoArchiveRepository;
use Planner\Infrastructure\Persistence\Pdo\Planning\PdoPlanningRepository;
use Planner\Support\Clock;
use Planner\Support\Timestamp;

/**
 * The Archive page: archived Areas, Goals, Milestones, Tasks and Habits, and restoring them.
 *
 * Archiving a Goal or Milestone "with contents" archives everything beneath it in one request,
 * so its contents carry the same archived_at (older archives: within a few seconds of it).
 * Restoring that Goal or Milestone brings back exactly those items. Items
 * archived on their own earlier stay archived. Repeating series ended by the archive stay
 * ended, and Milestone prerequisite links removed by it are not recreated.
 */
final readonly class ArchiveService
{
    public const TYPES = ['area', 'goal', 'milestone', 'task', 'habit'];
    /** How far apart a Goal or Milestone and its contents may have been archived in one request (before one shared timestamp). */
    private const BUNDLE_SECONDS = 5;
    private const MAX_ACTIVE_AREAS = 4;
    private const LABELS = ['area' => 'Area', 'goal' => 'Goal', 'milestone' => 'Milestone'];
    private const TABLES = ['area' => 'areas', 'goal' => 'goals', 'milestone' => 'milestones', 'task' => 'tasks', 'habit' => 'habits'];
    /** Links from things that stay (a Habit's Goal, the Dashboard roadmap) are cleared, not followed. */
    private const KEEP = ['habits' => ['primary_goal_id'], 'user_preferences' => ['dashboard_roadmap_goal_id']];

    public function __construct(
        private PdoArchiveRepository $archive,
        private PdoPlanningRepository $planning,
        private TransactionManager $transactions,
        private Clock $clock,
        private PdoCascadeDeleter $deleter,
        private PendingDeletionRepository $pending,
        private ProcessFileDeletion $files,
    ) {
    }

    /** @return list<array<string,mixed>> archived items, newest first; contents archived with their parent are folded into it */
    public function list(int $userId): array
    {
        $rows = [];
        foreach (self::TYPES as $type) {
            $rows[$type] = $this->archive->archived($type, $userId);
        }
        $names = ['area' => $this->archive->names('area', $userId), 'goal' => $this->archive->names('goal', $userId), 'milestone' => $this->archive->names('milestone', $userId)];

        $items = [];
        foreach ($rows as $type => $list) {
            foreach ($list as $row) {
                $parent = $this->parent($type, $row);
                $parentRow = $parent === null ? null : ($names[$parent[0]][$parent[1]] ?? null);
                if ($parentRow !== null && $parentRow['archived_at'] !== null && $type !== 'habit'
                    && $this->within((string) $row['archived_at'], (string) $parentRow['archived_at'])) {
                    continue; // shown as part of its parent
                }
                $items[] = [
                    'type' => $type,
                    'id' => (string) $row['id'],
                    'name' => (string) $row['name'],
                    'status' => $row['status'],
                    'version' => (int) $row['version'],
                    'archived_at' => Timestamp::api((string) $row['archived_at']),
                    'parent' => $parentRow === null ? null : [
                        'type' => $parent[0], 'id' => $parent[1], 'name' => $parentRow['name'], 'archived' => $parentRow['archived_at'] !== null,
                    ],
                    'contents' => in_array($type, ['goal', 'milestone'], true) ? count($this->bundle($type, $row, $rows)) : 0,
                ];
            }
        }
        usort($items, static fn (array $a, array $b): int => [$b['archived_at'], $a['type'], $a['id']] <=> [$a['archived_at'], $b['type'], $b['id']]);

        return $items;
    }

    /** @param array<string,mixed> $input @return array{type:string,id:string,restored:int} */
    public function restore(string $type, int $userId, string $id, array $input): array
    {
        if (!in_array($type, self::TYPES, true) || preg_match('/^[0-9a-f-]{36}$/D', $id) !== 1) {
            throw new HttpException(404, 'NOT_FOUND', 'The requested resource was not found.');
        }
        if (array_diff(array_keys($input), ['base_version']) !== []) {
            throw new ValidationException(['_unknown' => ['The request contains an unsupported field.']]);
        }
        $version = $input['base_version'] ?? null;
        if (!is_int($version) || $version < 1) {
            throw new ValidationException(['base_version' => ['The version is invalid.']]);
        }

        return $this->transactions->run(function () use ($type, $userId, $id, $version): array {
            $this->planning->lockOwner($userId);
            $row = $this->archive->find($type, $userId, $id, true)
                ?? throw new HttpException(404, 'NOT_FOUND', 'The requested resource was not found.');
            if ($row['archived_at'] === null) {
                throw new ValidationException(['archive' => ['This item is not archived.']]);
            }
            if ((int) $row['version'] !== $version) {
                throw new HttpException(409, 'VERSION_CONFLICT', 'The item changed after you loaded it. Reload and try again.');
            }
            $parent = $this->parent($type, $row);
            if ($parent !== null && $type !== 'habit') {
                $parentRow = $this->archive->find($parent[0], $userId, $parent[1]);
                if ($parentRow === null || $parentRow['archived_at'] !== null) {
                    throw new ValidationException(['parent' => ['Restore the '.self::LABELS[$parent[0]].' “'.($parentRow['name'] ?? '').'” first; this item lives inside it.']]);
                }
            }
            if ($type === 'area' && $this->archive->activeCount('area', $userId) >= self::MAX_ACTIVE_AREAS) {
                throw new ValidationException(['area' => ['You already have four active Areas. Archive one before restoring another.']]);
            }

            $restore = [[$type, $id]];
            if (in_array($type, ['goal', 'milestone'], true)) {
                $all = [];
                foreach (['goal', 'milestone', 'task'] as $kind) {
                    $all[$kind] = $this->archive->archived($kind, $userId, null);
                }
                $restore = [...$restore, ...$this->bundle($type, $row, $all)];
            }
            $now = Timestamp::database($this->clock->now());
            foreach ($restore as [$kind, $itemId]) {
                $this->archive->restore($kind, $userId, $itemId, $now);
            }

            return ['type' => $type, 'id' => $id, 'restored' => count($restore)];
        });
    }

    /**
     * Deletes an archived item for good, with everything beneath it (all of which is archived,
     * since an archived parent cannot hold active work). Habits that supported a deleted Goal
     * and a Dashboard roadmap pointing at it only lose that link. Activity facts stay.
     *
     * @param array<string, mixed> $input {base_version} @return array{type:string,id:string,deleted:int}
     */
    public function destroy(string $type, int $userId, string $id, array $input): array
    {
        $version = $this->target($type, $id, $input);

        return $this->purging(function (array &$paths) use ($type, $userId, $id, $version): array {
            $row = $this->archive->find($type, $userId, $id, true)
                ?? throw new HttpException(404, 'NOT_FOUND', 'The requested resource was not found.');
            if ($row['archived_at'] === null) {
                throw new ValidationException(['archive' => ['This item is not archived.']]);
            }
            if ((int) $row['version'] !== $version) {
                throw new HttpException(409, 'VERSION_CONFLICT', 'The item changed after you loaded it. Reload and try again.');
            }

            return ['type' => $type, 'id' => $id, 'deleted' => $this->purge($userId, [$type => [$id]], $paths)];
        });
    }

    /**
     * Deletes everything archived for good.
     *
     * @param array<string, mixed> $input {confirm: true} @return array{deleted:int}
     */
    public function empty(int $userId, array $input): array
    {
        if (array_diff(array_keys($input), ['confirm']) !== [] || ($input['confirm'] ?? null) !== true) {
            throw new ValidationException(['confirm' => ['Confirm that everything archived should be deleted for good.']]);
        }

        return $this->purging(function (array &$paths) use ($userId): array {
            $ids = [];
            foreach (self::TYPES as $type) {
                $ids[$type] = array_map(static fn (array $row): string => (string) $row['id'], $this->archive->archived($type, $userId, null));
            }

            return ['deleted' => $this->purge($userId, $ids, $paths)];
        });
    }

    /**
     * Runs a purge in one transaction and removes the private files it queued after the commit.
     *
     * @param callable(list<string>&): array<string, mixed> $work
     * @return array<string, mixed>
     */
    private function purging(callable $work): array
    {
        $paths = [];
        $result = $this->transactions->run(static function () use ($work, &$paths): array {
            return $work($paths);
        });
        $this->files->handle($paths);

        return $result;
    }

    /**
     * @param array<string, list<string>> $ids archived ids by type
     * @param list<string> $paths receives the private files queued for removal
     * @return int Areas, Goals, Milestones, Tasks and Habits deleted
     */
    private function purge(int $userId, array $ids, array &$paths): int
    {
        $this->planning->lockOwner($userId);
        $now = Timestamp::database($this->clock->now());
        $deleted = 0;
        $guard = static function (string $table, array $row) use ($userId): void {
            if (($row['user_id'] ?? null) !== null && (int) $row['user_id'] !== $userId) {
                throw new HttpException(404, 'NOT_FOUND', 'The requested resource was not found.');
            }
            // Never take active work along: everything deleted from these tables must be archived.
            if (in_array($table, ['areas', 'goals', 'milestones', 'tasks', 'habits', 'task_series'], true) && array_key_exists('archived_at', $row) && $row['archived_at'] === null) {
                throw new ValidationException(['archive' => ['Something inside this item is still active. Restore or archive it first.']]);
            }
        };
        foreach ($ids as $type => $list) {
            $rows = array_values(array_filter(
                $this->deleter->rows(self::TABLES[$type], 'id', $list),
                static fn (array $row): bool => (int) $row['user_id'] === $userId,
            ));
            if ($rows === []) {
                continue;
            }
            $result = $this->deleter->delete(self::TABLES[$type], $rows, self::KEEP, ['attachments' => 'path'], $guard);
            foreach (self::TABLES as $table) {
                $deleted += $result['counts'][$table] ?? 0;
            }
            foreach ($result['files'] as $path) {
                $this->pending->queue($userId, $path, $now);
                $paths[] = $path;
            }
        }

        return $deleted;
    }

    /** @param array<string, mixed> $input @return int the base version */
    private function target(string $type, string $id, array $input): int
    {
        if (!in_array($type, self::TYPES, true) || preg_match('/^[0-9a-f-]{36}$/D', $id) !== 1) {
            throw new HttpException(404, 'NOT_FOUND', 'The requested resource was not found.');
        }
        if (array_diff(array_keys($input), ['base_version']) !== []) {
            throw new ValidationException(['_unknown' => ['The request contains an unsupported field.']]);
        }
        $version = $input['base_version'] ?? null;
        if (!is_int($version) || $version < 1) {
            throw new ValidationException(['base_version' => ['The version is invalid.']]);
        }

        return $version;
    }

    /**
     * The items archived together with a Goal (its sub-Goals, their Milestones and Tasks) or a
     * Milestone (its Tasks), not counting the root itself.
     *
     * @param array<string,mixed> $root @param array<string,list<array<string,mixed>>> $rows archived rows by type
     * @return list<array{0:string,1:string}>
     */
    private function bundle(string $type, array $root, array $rows): array
    {
        $at = (string) $root['archived_at'];
        $in = fn (array $row): bool => $this->within((string) $row['archived_at'], $at);
        $goals = $type === 'goal' ? [(string) $root['id'] => true] : [];
        $milestones = $type === 'milestone' ? [(string) $root['id'] => true] : [];
        $found = [];
        if ($type === 'goal') {
            do {
                $grew = false;
                foreach ($rows['goal'] ?? [] as $goal) {
                    if (!isset($goals[(string) $goal['id']]) && isset($goals[(string) $goal['parent_goal_id']]) && $in($goal)) {
                        $goals[(string) $goal['id']] = true;
                        $found[] = ['goal', (string) $goal['id']];
                        $grew = true;
                    }
                }
            } while ($grew);
            foreach ($rows['milestone'] ?? [] as $milestone) {
                if (isset($goals[(string) $milestone['goal_id']]) && $in($milestone)) {
                    $milestones[(string) $milestone['id']] = true;
                    $found[] = ['milestone', (string) $milestone['id']];
                }
            }
        }
        foreach ($rows['task'] ?? [] as $task) {
            if ((isset($goals[(string) $task['goal_id']]) || isset($milestones[(string) $task['milestone_id']])) && $in($task)) {
                $found[] = ['task', (string) $task['id']];
            }
        }

        return $found;
    }

    /** @param array<string,mixed> $row @return array{0:string,1:string}|null */
    private function parent(string $type, array $row): ?array
    {
        $candidates = match ($type) {
            'goal' => [['area', $row['area_id']], ['goal', $row['parent_goal_id']]],
            'milestone' => [['goal', $row['goal_id']]],
            'task' => [['milestone', $row['milestone_id']], ['goal', $row['goal_id']]],
            'habit' => [['goal', $row['primary_goal_id']]],
            default => [],
        };
        foreach ($candidates as [$kind, $id]) {
            if (is_string($id) && $id !== '') {
                return [$kind, $id];
            }
        }

        return null;
    }

    /** Whether $at is within BUNDLE_SECONDS of $parentAt. */
    private function within(string $at, string $parentAt): bool
    {
        $parent = new DateTimeImmutable($parentAt, new DateTimeZone('UTC'));
        $window = new DateInterval('PT'.self::BUNDLE_SECONDS.'S');

        return $at >= $parent->sub($window)->format('Y-m-d H:i:s.u') && $at <= $parent->add($window)->format('Y-m-d H:i:s.u');
    }
}
