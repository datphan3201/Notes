<?php

declare(strict_types=1);

namespace Tests\Plain\Unit;

use PHPUnit\Framework\TestCase;
use Planner\Domain\Habits\HabitStreak;

final class HabitStreakTest extends TestCase
{
    private static function days(string ...$dates): array
    {
        return array_fill_keys($dates, true);
    }

    public function test_daily_run_keeps_today_open_and_ends_at_a_missed_day(): void
    {
        $streak = new HabitStreak;
        self::assertSame(['count' => 0, 'unit' => 'days', 'through_date' => null], $streak->daily([], [], '2026-03-01', '2026-03-01'));
        self::assertSame(3, $streak->daily(self::days('2026-02-27', '2026-02-28', '2026-03-01'), [], '2026-02-01', '2026-03-01')['count']);
        // Today unfinished: yesterday's run still stands.
        self::assertSame(['count' => 2, 'unit' => 'days', 'through_date' => '2026-02-28'], $streak->daily(self::days('2026-02-27', '2026-02-28'), [], '2026-02-01', '2026-03-01'));
        // A gap before yesterday ends the run.
        self::assertSame(0, $streak->daily(self::days('2026-02-27'), [], '2026-02-01', '2026-03-01')['count']);
    }

    public function test_rest_day_protects_the_run_without_adding_to_it(): void
    {
        $streak = new HabitStreak;
        $done = self::days('2026-02-26', '2026-02-27', '2026-03-01');
        self::assertSame(1, $streak->daily($done, [], '2026-02-01', '2026-03-01')['count']);
        self::assertSame(3, $streak->daily($done, self::days('2026-02-28'), '2026-02-01', '2026-03-01')['count']);
    }

    public function test_weekly_run_counts_met_weeks_and_rest_days_lower_the_target(): void
    {
        $streak = new HabitStreak;
        // Weeks start 2026-02-16, 2026-02-23 and 2026-03-02 (today, Wednesday).
        $done = self::days('2026-02-16', '2026-02-18', '2026-02-24');
        // The current week is still open; the week of 2026-02-23 fell short.
        self::assertSame(0, $streak->weekly($done, [], 2, '2026-02-16', '2026-03-04')['count']);
        self::assertSame(2, $streak->weekly($done, self::days('2026-02-26'), 2, '2026-02-16', '2026-03-04')['count']);
        self::assertSame('weeks', $streak->weekly($done, [], 2, '2026-02-16', '2026-03-04')['unit']);
    }

    public function test_combined_day_counts_only_when_no_daily_habit_was_missed(): void
    {
        $streak = new HabitStreak;
        $read = ['since' => '2026-02-27', 'done' => self::days('2026-02-27', '2026-02-28', '2026-03-01'), 'rest' => []];
        $walk = ['since' => '2026-02-28', 'done' => self::days('2026-03-01'), 'rest' => []];
        $result = $streak->overall([$read, $walk], '2026-03-01', 3);
        // 2026-02-28: Walk missed, so the combined run is only today.
        self::assertSame(1, $result['days']);
        self::assertSame(['checked', 'missed', 'checked'], array_column($result['recent_days'], 'state'));
        $walk['rest'] = self::days('2026-02-28');
        $result = $streak->overall([$read, $walk], '2026-03-01', 3);
        self::assertSame(3, $result['days']);
        self::assertSame(['done' => 1, 'total' => 2], array_intersect_key($result['recent_days'][1], ['done' => 0, 'total' => 0]));
        self::assertSame('open', $streak->day([$read, $walk], '2026-03-02', '2026-03-02')['state']);
        self::assertSame('untracked', $streak->day([$read], '2026-02-01', '2026-03-01')['state']);
    }
}
