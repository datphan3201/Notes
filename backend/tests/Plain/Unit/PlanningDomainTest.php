<?php

declare(strict_types=1);

namespace Tests\Plain\Unit;

use PHPUnit\Framework\TestCase;
use Planner\Domain\Planning\GoalProgressCalculator;
use Planner\Domain\Planning\GraphGuard;
use RuntimeException;

final class PlanningDomainTest extends TestCase
{
    public function test_graph_guard_handles_deep_graphs_without_recursion(): void
    {
        $edges = [];

        for ($index = 0; $index < 1_001; $index++) {
            $edges[] = [(string) $index, (string) ($index + 1)];
        }

        self::assertTrue((new GraphGuard)->wouldCycle($edges, '1001', '0'));
        self::assertFalse((new GraphGuard)->wouldCycle($edges, '1002', '0'));
    }

    public function test_progress_uses_immediate_finite_components_and_detects_cycles(): void
    {
        $calculator = new GoalProgressCalculator;
        $progress = $calculator->calculate(
            [
                ['id' => 'root', 'parent_goal_id' => null, 'status' => 'Active'],
                ['id' => 'child', 'parent_goal_id' => 'root', 'status' => 'Completed'],
            ],
            [['goal_id' => 'root', 'status' => 'NotStarted']],
            [['goal_id' => 'root', 'status' => 'Done']],
        );

        self::assertSame(200.0 / 3.0, $progress['root']);

        $this->expectException(RuntimeException::class);
        $calculator->calculate([
            ['id' => 'a', 'parent_goal_id' => 'b', 'status' => 'Active'],
            ['id' => 'b', 'parent_goal_id' => 'a', 'status' => 'Active'],
        ], [], []);
    }
}
