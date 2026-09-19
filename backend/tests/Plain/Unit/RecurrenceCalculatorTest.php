<?php

declare(strict_types=1);

namespace Tests\Plain\Unit;

use PHPUnit\Framework\TestCase;
use Planner\Domain\Recurrence\RecurrenceCalculator;

final class RecurrenceCalculatorTest extends TestCase
{
    public function test_daily_interval_is_calendar_based_and_includes_leap_day(): void
    {
        $dates = (new RecurrenceCalculator)->dates([
            'frequency' => 'daily', 'interval_count' => 2, 'weekdays' => [],
            'start_date' => '2024-02-27', 'end_date' => null, 'timezone' => 'UTC',
        ], '2024-02-27', '2024-03-04');

        self::assertSame(['2024-02-29', '2024-03-02', '2024-03-04'], $dates);
    }

    public function test_weekly_interval_uses_monday_weeks_and_sorted_unique_weekdays(): void
    {
        $dates = (new RecurrenceCalculator)->dates([
            'frequency' => 'weekly', 'interval_count' => 2, 'weekdays' => [5, 1, 5],
            'start_date' => '2026-09-16', 'end_date' => '2026-10-10', 'timezone' => 'America/Mexico_City',
        ], '2026-09-15', '2026-10-31');

        self::assertSame(['2026-09-18', '2026-09-28', '2026-10-02'], $dates);
    }

    public function test_dst_gap_advances_and_overlap_chooses_earlier_instant(): void
    {
        $calculator = new RecurrenceCalculator;

        self::assertSame('2026-03-08T07:30:00+00:00', $calculator->localDateTimeToUtc('2026-03-08', '02:30:00', 'America/New_York')?->format(DATE_ATOM));
        self::assertSame('2026-11-01T05:30:00+00:00', $calculator->localDateTimeToUtc('2026-11-01', '01:30:00', 'America/New_York')?->format(DATE_ATOM));
    }
}
