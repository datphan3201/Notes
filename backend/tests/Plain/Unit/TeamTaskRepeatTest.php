<?php

declare(strict_types=1);

namespace Tests\Plain\Unit;

use InvalidArgumentException;
use PHPUnit\Framework\TestCase;
use Planner\Domain\Teamwork\TeamTaskRepeat;

final class TeamTaskRepeatTest extends TestCase
{
    public function test_next_dates_follow_each_frequency_and_stop_after_the_end_date(): void
    {
        $rule = static fn (string $frequency, int $interval = 1, array $weekdays = [], ?string $end = null): array => TeamTaskRepeat::normalize(['frequency' => $frequency, 'interval_count' => $interval, 'weekdays' => $weekdays, 'end_date' => $end]);

        self::assertSame('2026-10-31', TeamTaskRepeat::next('2026-10-28', $rule('daily', 3)));
        // Wednesday 2026-10-28 → Friday of the same week, then Monday two weeks on.
        self::assertSame('2026-10-30', TeamTaskRepeat::next('2026-10-28', $rule('weekly', 2, [1, 5])));
        self::assertSame('2026-11-09', TeamTaskRepeat::next('2026-10-30', $rule('weekly', 2, [1, 5])));
        self::assertSame('2027-02-28', TeamTaskRepeat::next('2027-01-31', $rule('monthly')));
        self::assertSame('2028-02-29', TeamTaskRepeat::next('2024-02-29', $rule('yearly', 4)));
        self::assertNull(TeamTaskRepeat::next('2026-10-28', $rule('daily', 1, [], '2026-10-28')));
    }

    public function test_rejects_unknown_shapes(): void
    {
        $this->expectException(InvalidArgumentException::class);
        TeamTaskRepeat::normalize(['frequency' => 'weekly', 'interval_count' => 1, 'weekdays' => [8]]);
    }
}
