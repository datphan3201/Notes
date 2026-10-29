<?php

declare(strict_types=1);

namespace Planner\Domain\Habits;

use DateTimeImmutable;

/**
 * Streak rules. Dates are local YYYY-MM-DD strings, so string comparison
 * orders them. A Rest Day never counts as a completion and never extends a
 * run; it only keeps a missed day from ending one. Today is still open, so an
 * unfinished today never ends a run either.
 */
final class HabitStreak
{
    /** Rest Days may be planned for exactly the next this-many days. */
    public const REST_WINDOW_DAYS = 3;

    /**
     * @param array<string, true> $done @param array<string, true> $rest
     * @return array{count:int,unit:string,through_date:?string}
     */
    public function daily(array $done, array $rest, string $since, string $today): array
    {
        $count = 0;
        $through = null;
        for ($date = $today; $date >= $since; $date = self::shift($date, -1)) {
            if (isset($done[$date])) {
                $count++;
                $through ??= $date;
            } elseif ($date !== $today && !isset($rest[$date])) {
                break;
            }
        }

        return ['count' => $count, 'unit' => 'days', 'through_date' => $through];
    }

    /**
     * Consecutive Monday-based weeks that met the target. Each Rest Day lowers
     * that week's target by one; a week with nothing left to do is neutral.
     *
     * @param array<string, true> $done @param array<string, true> $rest
     * @return array{count:int,unit:string,through_date:?string}
     */
    public function weekly(array $done, array $rest, int $target, string $since, string $today): array
    {
        $count = 0;
        $through = null;
        $current = self::monday($today);
        for ($start = $current; self::shift($start, 6) >= $since; $start = self::shift($start, -7)) {
            $completed = 0;
            $rested = 0;
            $available = 0;
            $latest = null;
            for ($offset = 0; $offset < 7; $offset++) {
                $date = self::shift($start, $offset);
                if ($date < $since) {
                    continue;
                }
                $available++;
                if (isset($done[$date])) {
                    $completed++;
                    $latest = $date;
                } elseif (isset($rest[$date])) {
                    $rested++;
                }
            }
            $required = max(0, min($target, $available) - $rested);
            if ($completed > 0 && $completed >= $required) {
                $count++;
                $through ??= $latest;
            } elseif ($start !== $current && $completed < $required) {
                break;
            }
        }

        return ['count' => $count, 'unit' => 'weeks', 'through_date' => $through];
    }

    /**
     * All daily Habits together: a day counts only when every Habit tracked
     * that day was completed or resting, with at least one completion.
     *
     * @param list<array{since:string,done:array<string,true>,rest:array<string,true>}> $habits
     * @return array{days:int,through_date:?string,recent_days:list<array{date:string,state:string,done:int,total:int}>}
     */
    public function overall(array $habits, string $today, int $recentDays = 7): array
    {
        $since = $habits === [] ? null : min(array_column($habits, 'since'));
        $days = 0;
        $through = null;
        for ($date = $today; $since !== null && $date >= $since; $date = self::shift($date, -1)) {
            $state = $this->day($habits, $date, $today)['state'];
            if ($state === 'checked') {
                $days++;
                $through ??= $date;
            } elseif ($state === 'missed') {
                break;
            }
        }
        $recent = [];
        for ($offset = $recentDays - 1; $offset >= 0; $offset--) {
            $date = self::shift($today, -$offset);
            $recent[] = ['date' => $date, ...$this->day($habits, $date, $today)];
        }

        return ['days' => $days, 'through_date' => $through, 'recent_days' => $recent];
    }

    /**
     * @param list<array{since:string,done:array<string,true>,rest:array<string,true>}> $habits
     * @return array{state:string,done:int,total:int}
     */
    public function day(array $habits, string $date, string $today): array
    {
        $total = 0;
        $done = 0;
        $missed = 0;
        foreach ($habits as $habit) {
            if ($date < $habit['since']) {
                continue;
            }
            $total++;
            if (isset($habit['done'][$date])) {
                $done++;
            } elseif (!isset($habit['rest'][$date])) {
                $missed++;
            }
        }
        $state = match (true) {
            $total === 0 => 'untracked',
            $missed === 0 && $done > 0 => 'checked',
            $missed === 0 => 'rest',
            $date >= $today => 'open',
            default => 'missed',
        };

        return ['state' => $state, 'done' => $done, 'total' => $total];
    }

    public static function shift(string $date, int $days): string
    {
        return (new DateTimeImmutable($date))->modify(sprintf('%+d days', $days))->format('Y-m-d');
    }

    public static function monday(string $date): string
    {
        return (new DateTimeImmutable($date))->modify('monday this week')->format('Y-m-d');
    }
}
