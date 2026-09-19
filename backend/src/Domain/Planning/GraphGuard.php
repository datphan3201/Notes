<?php

declare(strict_types=1);

namespace Planner\Domain\Planning;

final class GraphGuard
{
    /**
     * Returns true when adding source -> target would close a directed cycle.
     *
     * @param list<array{0: string, 1: string}> $edges
     */
    public function wouldCycle(array $edges, string $source, string $target): bool
    {
        if ($source === $target) {
            return true;
        }

        $adjacency = [];

        foreach ($edges as [$from, $to]) {
            $adjacency[$from][] = $to;
        }

        $stack = [$target];
        $visited = [];

        while ($stack !== []) {
            $current = array_pop($stack);

            if ($current === $source) {
                return true;
            }

            if (isset($visited[$current])) {
                continue;
            }

            $visited[$current] = true;

            foreach ($adjacency[$current] ?? [] as $next) {
                $stack[] = $next;
            }
        }

        return false;
    }
}
