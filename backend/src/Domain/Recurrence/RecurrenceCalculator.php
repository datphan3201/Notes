<?php

declare(strict_types=1);

namespace Planner\Domain\Recurrence;

use DateTimeImmutable;
use DateTimeZone;
use InvalidArgumentException;

final readonly class RecurrenceCalculator
{
    /**
     * @param array{frequency:string,interval_count:int,weekdays:list<int>,start_date:string,end_date:?string,timezone:string} $rule
     * @return list<string>
     */
    public function dates(array $rule, string $exclusiveCursor, string $inclusiveHorizon, int $limit = 200): array
    {
        $timezone = $this->timezone($rule['timezone']);
        $start = $this->date($rule['start_date'], $timezone);
        $cursor = $this->date($exclusiveCursor, $timezone);
        $horizon = $this->date($inclusiveHorizon, $timezone);
        $end = $rule['end_date'] === null ? null : $this->date($rule['end_date'], $timezone);

        if ($rule['interval_count'] < 1 || $rule['interval_count'] > 52 || $horizon <= $cursor || $limit < 1) {
            return [];
        }

        $weekdays = array_values(array_unique($rule['weekdays']));
        sort($weekdays, SORT_NUMERIC);
        if ($rule['frequency'] === 'daily' && $weekdays !== []) {
            throw new InvalidArgumentException('Daily recurrence cannot define weekdays.');
        }
        if ($rule['frequency'] === 'weekly' && ($weekdays === [] || min($weekdays) < 1 || max($weekdays) > 7)) {
            throw new InvalidArgumentException('Weekly recurrence requires weekdays 1 through 7.');
        }
        if (!in_array($rule['frequency'], ['daily', 'weekly'], true)) {
            throw new InvalidArgumentException('Unsupported recurrence frequency.');
        }

        $dates = [];
        $candidate = $cursor->modify('+1 day');
        if ($candidate < $start) {
            $candidate = $start;
        }

        while ($candidate <= $horizon && ($end === null || $candidate <= $end) && count($dates) < $limit) {
            $eligible = false;
            if ($rule['frequency'] === 'daily') {
                $days = (int) $start->diff($candidate)->format('%a');
                $eligible = $days % $rule['interval_count'] === 0;
            } else {
                $startMonday = $start->modify('monday this week');
                $candidateMonday = $candidate->modify('monday this week');
                $weeks = intdiv((int) $startMonday->diff($candidateMonday)->format('%a'), 7);
                $eligible = $weeks % $rule['interval_count'] === 0
                    && in_array((int) $candidate->format('N'), $weekdays, true);
            }

            if ($eligible) {
                $dates[] = $candidate->format('Y-m-d');
            }
            $candidate = $candidate->modify('+1 day');
        }

        return $dates;
    }

    public function localDateTimeToUtc(string $date, ?string $time, string $timezone): ?DateTimeImmutable
    {
        if ($time === null) {
            return null;
        }

        $zone = $this->timezone($timezone);
        $local = DateTimeImmutable::createFromFormat('!Y-m-d H:i:s', "$date $time", $zone);
        if (!$local instanceof DateTimeImmutable) {
            throw new InvalidArgumentException('Invalid local schedule time.');
        }

        // PHP advances nonexistent wall times through the DST gap. For an
        // overlap its default maps to the earlier UTC instant for the common
        // fall-back transitions supported by IANA data.
        return $local->setTimezone(new DateTimeZone('UTC'));
    }

    private function timezone(string $name): DateTimeZone
    {
        try {
            return new DateTimeZone($name);
        } catch (\Exception) {
            throw new InvalidArgumentException('Invalid IANA timezone.');
        }
    }

    private function date(string $date, DateTimeZone $timezone): DateTimeImmutable
    {
        $value = DateTimeImmutable::createFromFormat('!Y-m-d', $date, $timezone);
        $errors = DateTimeImmutable::getLastErrors();
        if (!$value instanceof DateTimeImmutable || ($errors !== false && ($errors['warning_count'] > 0 || $errors['error_count'] > 0))
            || $value->format('Y-m-d') !== $date) {
            throw new InvalidArgumentException('Invalid calendar date.');
        }

        return $value;
    }
}
