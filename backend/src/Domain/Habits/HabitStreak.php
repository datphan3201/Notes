<?php

declare(strict_types=1);

namespace Planner\Domain\Habits;

use DateTimeImmutable;

final class HabitStreak
{
    /** @param array{last_date:string,days:int}|null $run @return array{days:int,through_date:?string} */
    public function current(?array $run, string $today): array
    {
        $yesterday = (new DateTimeImmutable($today))->modify('-1 day')->format('Y-m-d');
        if ($run === null || !in_array($run['last_date'], [$today, $yesterday], true)) {
            return ['days' => 0, 'through_date' => null];
        }

        return ['days' => $run['days'], 'through_date' => $run['last_date']];
    }
}
