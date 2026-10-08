<?php

declare(strict_types=1);

namespace Tests\Plain\Unit;

use PHPUnit\Framework\TestCase;
use Planner\Domain\Habits\HabitStreak;

final class HabitStreakTest extends TestCase
{
    public function test_current_run_has_yesterday_grace_and_expires_after_a_gap(): void
    {
        $streak = new HabitStreak;
        self::assertSame(['days'=>0,'through_date'=>null],$streak->current(null,'2026-03-01'));
        self::assertSame(['days'=>4,'through_date'=>'2026-03-01'],$streak->current(['days'=>4,'last_date'=>'2026-03-01'],'2026-03-01'));
        self::assertSame(['days'=>3,'through_date'=>'2026-02-28'],$streak->current(['days'=>3,'last_date'=>'2026-02-28'],'2026-03-01'));
        self::assertSame(['days'=>0,'through_date'=>null],$streak->current(['days'=>3,'last_date'=>'2026-02-27'],'2026-03-01'));
    }
}
