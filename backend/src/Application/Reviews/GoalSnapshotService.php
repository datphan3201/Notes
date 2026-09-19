<?php

declare(strict_types=1);

namespace Planner\Application\Reviews;

use DateTimeZone;
use Planner\Application\Planning\PlanningService;
use Planner\Infrastructure\Database\TransactionManager;
use Planner\Infrastructure\Persistence\Pdo\Planning\PdoPlanningRepository;
use Planner\Infrastructure\Persistence\Pdo\Reviews\PdoReviewRepository;
use Planner\Support\Clock;
use Planner\Support\Timestamp;
use Planner\Support\UuidGenerator;
use Throwable;

final readonly class GoalSnapshotService
{
    public function __construct(
        private PdoReviewRepository $reviews,
        private PdoPlanningRepository $planningRepository,
        private PlanningService $planning,
        private TransactionManager $transactions,
        private UuidGenerator $uuid,
        private Clock $clock,
    ) {}

    /** @return array{created:int,warnings:list<string>,failed:list<int>} */
    public function capture(): array
    {
        $created = 0; $warnings = []; $failed = [];
        foreach ($this->reviews->users() as $owner) {
            $userId = (int) $owner['user_id'];
            try {
                $created += $this->transactions->run(function () use ($userId, $owner, &$warnings): int {
                    $this->planningRepository->lockOwner($userId);
                    $timezone = (string) $owner['timezone'];
                    $date = $this->clock->now()->setTimezone(new DateTimeZone($timezone))->modify('-1 day')->format('Y-m-d');
                    $progress = $this->planning->progress($userId);
                    $count = 0;
                    foreach ($progress as $goalId => $percentage) {
                        $checksum = hash('sha256', json_encode(['goal_id' => $goalId, 'date' => $date, 'progress' => round($percentage, 2)], JSON_THROW_ON_ERROR));
                        $existing = $this->reviews->goalSnapshot($userId, $goalId, $date);
                        if ($existing !== null) {
                            if (!hash_equals((string) $existing['checksum'], $checksum)) $warnings[] = "$userId:$goalId:$date";
                            continue;
                        }
                        $this->reviews->insertGoalSnapshot($this->uuid->generate(), $userId, $goalId, $date, $timezone, round($percentage, 2), $checksum, Timestamp::database($this->clock->now()));
                        $count++;
                    }
                    return $count;
                });
            } catch (Throwable) {
                $failed[] = $userId;
            }
        }
        return ['created' => $created, 'warnings' => $warnings, 'failed' => $failed];
    }
}
