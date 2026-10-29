<?php

declare(strict_types=1);

namespace Planner\Application\Habits;

use DateTimeImmutable;
use DateTimeZone;
use Planner\Domain\Habits\HabitStreak;
use Planner\Infrastructure\Persistence\Pdo\Habits\PdoHabitRepository;
use Planner\Support\Clock;

/** Per-Habit streak and Rest Day facts, computed in each Habit's own time zone. */
final readonly class HabitProgress
{
    private HabitStreak $streaks;

    public function __construct(private PdoHabitRepository $habits, private Clock $clock)
    {
        $this->streaks = new HabitStreak;
    }

    /** @param array<string, mixed> $habit */
    public function today(array $habit): string
    {
        return $this->clock->now()->setTimezone(new DateTimeZone((string) $habit['timezone']))->format('Y-m-d');
    }

    /**
     * Tracking starts on the Habit's creation date, or on an earlier back-dated check-in.
     *
     * @param array<string, mixed> $habit @param array<string, true> $done
     */
    public function since(array $habit, array $done): string
    {
        $created = (new DateTimeImmutable((string) $habit['created_at'], new DateTimeZone('UTC')))
            ->setTimezone(new DateTimeZone((string) $habit['timezone']))->format('Y-m-d');

        return $done === [] ? $created : min($created, min(array_map('strval', array_keys($done))));
    }

    /**
     * @param array<string, mixed> $habit
     * @param array{done: array<string, array<string, true>>, rest: array<string, array<string, true>>}|null $days
     * @return array{streak: array{count:int,unit:string,through_date:?string}, rest_days: list<string>, rest_window: array{from:string,to:string}, since: string, today: string}
     */
    public function describe(int $userId, array $habit, ?array $days = null): array
    {
        $id = (string) $habit['id'];
        $days ??= $this->habits->days($userId, $id);
        $done = $days['done'][$id] ?? [];
        $rest = $days['rest'][$id] ?? [];
        $today = $this->today($habit);
        $since = $this->since($habit, $done);
        $streak = $habit['period'] === 'weekly'
            ? $this->streaks->weekly($done, $rest, (int) $habit['target_frequency'], $since, $today)
            : $this->streaks->daily($done, $rest, $since, $today);
        $restDays = array_map('strval', array_keys($rest));
        sort($restDays);

        return [
            'streak' => $streak,
            'rest_days' => $restDays,
            'rest_window' => ['from' => HabitStreak::shift($today, 1), 'to' => HabitStreak::shift($today, HabitStreak::REST_WINDOW_DAYS)],
            'since' => $since,
            'today' => $today,
        ];
    }
}
