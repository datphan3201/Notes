<?php

declare(strict_types=1);

namespace Planner\Domain\Planning;

use RuntimeException;

final class GoalProgressCalculator
{
    /**
     * @param list<array{id: string, parent_goal_id: ?string, status: string}> $goals
     * @param list<array{goal_id: string, status: string}> $milestones
     * @param list<array{goal_id: ?string, status: string}> $tasks
     * @return array<string, float>
     */
    public function calculate(array $goals, array $milestones, array $tasks): array
    {
        $byId = [];
        $children = [];
        $components = [];

        foreach ($goals as $goal) {
            $byId[$goal['id']] = $goal;

            if ($goal['parent_goal_id'] !== null) {
                $children[$goal['parent_goal_id']][] = $goal['id'];
            }
        }

        foreach ($milestones as $milestone) {
            $components[$milestone['goal_id']][] = $milestone['status'] === MilestoneStatus::Completed->value ? 100.0 : 0.0;
        }

        foreach ($tasks as $task) {
            if ($task['goal_id'] !== null) {
                $components[$task['goal_id']][] = $task['status'] === TaskStatus::Done->value ? 100.0 : 0.0;
            }
        }

        $result = [];
        $state = [];

        foreach (array_keys($byId) as $root) {
            if (isset($result[$root])) {
                continue;
            }

            $stack = [[$root, false]];

            while ($stack !== []) {
                [$id, $expanded] = array_pop($stack);

                if ($expanded) {
                    $values = $components[$id] ?? [];

                    foreach ($children[$id] ?? [] as $child) {
                        $values[] = $result[$child];
                    }

                    $result[$id] = $values === []
                        ? (($byId[$id]['status'] ?? '') === GoalStatus::Completed->value ? 100.0 : 0.0)
                        : array_sum($values) / count($values);
                    $state[$id] = 2;

                    continue;
                }

                if (($state[$id] ?? 0) === 1) {
                    throw new RuntimeException('Stored Goal hierarchy contains a cycle.');
                }

                if (($state[$id] ?? 0) === 2) {
                    continue;
                }

                $state[$id] = 1;
                $stack[] = [$id, true];

                foreach (array_reverse($children[$id] ?? []) as $child) {
                    if (!isset($byId[$child])) {
                        throw new RuntimeException('Stored Goal hierarchy references a missing Goal.');
                    }

                    $stack[] = [$child, false];
                }
            }
        }

        return $result;
    }
}
