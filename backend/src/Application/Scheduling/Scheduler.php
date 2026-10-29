<?php

declare(strict_types=1);

namespace Planner\Application\Scheduling;

use DateTimeImmutable;
use DateTimeZone;
use Planner\Infrastructure\Persistence\Pdo\Scheduling\PdoScheduledJobRepository;
use Planner\Support\Clock;
use Planner\Support\Timestamp;
use Throwable;

/**
 * Runs periodic jobs whose interval has elapsed. Cron can call `schedule:run`
 * every minute, or `schedule:work` keeps doing so in one long-lived process.
 */
final readonly class Scheduler
{
    /** @param array<string, array{interval:int, run:callable():string}> $definitions */
    public function __construct(private PdoScheduledJobRepository $jobs, private Clock $clock, private array $definitions)
    {
    }

    /** @return array<string, string> job name => outcome, for the jobs that ran */
    public function runDue(): array
    {
        $results = [];
        foreach ($this->definitions as $name => $job) {
            if (!$this->jobs->tryLock($name)) {
                continue;
            }
            try {
                $last = $this->jobs->lastRun($name);
                $now = $this->clock->now();
                if ($last !== null && $now->getTimestamp() - (new DateTimeImmutable($last, new DateTimeZone('UTC')))->getTimestamp() < $job['interval']) {
                    continue;
                }
                try {
                    $status = ($job['run'])();
                } catch (Throwable $error) {
                    $status = 'failed: '.$error->getMessage();
                }
                $this->jobs->record($name, Timestamp::database($now), $status);
                $results[$name] = $status;
            } finally {
                $this->jobs->unlock($name);
            }
        }

        return $results;
    }
}
