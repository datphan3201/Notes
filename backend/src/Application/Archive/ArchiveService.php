<?php

declare(strict_types=1);

namespace Planner\Application\Archive;

use DateInterval;
use DateTimeImmutable;
use DateTimeZone;
use Planner\Http\HttpException;
use Planner\Http\ValidationException;
use Planner\Infrastructure\Database\TransactionManager;
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

    public function __construct(
        private PdoArchiveRepository $archive,
        private PdoPlanningRepository $planning,
        private TransactionManager $transactions,
        private Clock $clock,
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
