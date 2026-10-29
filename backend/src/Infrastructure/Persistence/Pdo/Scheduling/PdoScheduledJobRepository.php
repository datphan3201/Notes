<?php

declare(strict_types=1);

namespace Planner\Infrastructure\Persistence\Pdo\Scheduling;

use PDO;

final readonly class PdoScheduledJobRepository
{
    public function __construct(private PDO $pdo)
    {
    }

    public function lastRun(string $name): ?string
    {
        $statement = $this->pdo->prepare('SELECT last_run_at FROM scheduled_jobs WHERE name = :name');
        $statement->execute(['name' => $name]);
        $value = $statement->fetchColumn();

        return $value === false || $value === null ? null : (string) $value;
    }

    public function record(string $name, string $ranAt, string $status): void
    {
        $statement = $this->pdo->prepare('INSERT INTO scheduled_jobs (name, last_run_at, last_status) VALUES (:name, :ran_at, :status) ON DUPLICATE KEY UPDATE last_run_at = VALUES(last_run_at), last_status = VALUES(last_status)');
        $statement->execute(['name' => $name, 'ran_at' => $ranAt, 'status' => mb_substr($status, 0, 255)]);
    }

    /** A named MySQL lock keeps two workers from running one job at once. */
    public function tryLock(string $name): bool
    {
        $statement = $this->pdo->prepare('SELECT GET_LOCK(:lock, 0)');
        $statement->execute(['lock' => 'planner-job:'.$name]);

        return (int) $statement->fetchColumn() === 1;
    }

    public function unlock(string $name): void
    {
        $statement = $this->pdo->prepare('SELECT RELEASE_LOCK(:lock)');
        $statement->execute(['lock' => 'planner-job:'.$name]);
    }
}
