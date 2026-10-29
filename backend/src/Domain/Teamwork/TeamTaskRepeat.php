<?php

declare(strict_types=1);

namespace Planner\Domain\Teamwork;

use DateTimeImmutable;
use DateTimeZone;
use InvalidArgumentException;

/**
 * Repeat rules for team tasks: {frequency, interval_count, weekdays, end_date}.
 * Weekly rules use ISO weekdays (1 = Monday) and count intervals in whole
 * Monday-first weeks from the previous occurrence.
 */
final class TeamTaskRepeat
{
    private const FREQUENCIES = ['daily', 'weekly', 'monthly', 'yearly'];

    /** @return array{frequency:string,interval_count:int,weekdays:list<int>,end_date:?string}|null */
    public static function normalize(mixed $value): ?array
    {
        if ($value === null) {
            return null;
        }
        $invalid = static fn (): never => throw new InvalidArgumentException('The repeat rule is invalid.');
        if (! is_array($value) || array_diff(array_keys($value), ['frequency', 'interval_count', 'weekdays', 'end_date']) !== []) {
            $invalid();
        }
        $frequency = $value['frequency'] ?? null;
        $interval = $value['interval_count'] ?? 1;
        $weekdays = $value['weekdays'] ?? [];
        $end = $value['end_date'] ?? null;
        if (! in_array($frequency, self::FREQUENCIES, true) || ! is_int($interval) || $interval < 1 || $interval > 99 || ! is_array($weekdays)) {
            $invalid();
        }
        foreach ($weekdays as $day) {
            if (! is_int($day) || $day < 1 || $day > 7) {
                $invalid();
            }
        }
        $weekdays = array_values(array_unique($weekdays));
        sort($weekdays);
        if ($frequency !== 'weekly') {
            $weekdays = [];
        }
        if ($end !== null && (! is_string($end) || self::date($end) === null)) {
            $invalid();
        }

        return ['frequency' => $frequency, 'interval_count' => $interval, 'weekdays' => $weekdays, 'end_date' => $end];
    }

    /**
     * The first rule date after $after (Y-m-d), or null once past end_date.
     *
     * @param array{frequency:string,interval_count:int,weekdays:list<int>,end_date:?string} $rule
     */
    public static function next(string $after, array $rule): ?string
    {
        $from = self::date($after) ?? throw new InvalidArgumentException('Invalid date.');
        $interval = $rule['interval_count'];
        $next = match ($rule['frequency']) {
            'daily' => $from->modify("+$interval days"),
            'weekly' => self::nextWeekly($from, $interval, $rule['weekdays'] ?: [(int) $from->format('N')]),
            'monthly' => self::addMonths($from, $interval),
            default => self::addMonths($from, 12 * $interval),
        };
        $date = $next->format('Y-m-d');

        return $rule['end_date'] !== null && $date > $rule['end_date'] ? null : $date;
    }

    /** @param list<int> $weekdays */
    private static function nextWeekly(DateTimeImmutable $from, int $interval, array $weekdays): DateTimeImmutable
    {
        $week = $from->modify('monday this week');
        for ($day = $from->modify('+1 day'); ; $day = $day->modify('+1 day')) {
            $weeks = intdiv((int) $week->diff($day->modify('monday this week'))->days, 7);
            if ($weeks % $interval === 0 && in_array((int) $day->format('N'), $weekdays, true)) {
                return $day;
            }
        }
    }

    /** Keeps the day of month, clamped to the target month's last day. */
    private static function addMonths(DateTimeImmutable $from, int $months): DateTimeImmutable
    {
        $first = $from->modify('first day of this month')->modify("+$months months");
        $day = min((int) $from->format('j'), (int) $first->format('t'));

        return $first->setDate((int) $first->format('Y'), (int) $first->format('n'), $day);
    }

    private static function date(string $value): ?DateTimeImmutable
    {
        $date = DateTimeImmutable::createFromFormat('!Y-m-d', $value, new DateTimeZone('UTC'));

        return $date !== false && $date->format('Y-m-d') === $value ? $date : null;
    }
}
