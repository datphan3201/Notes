<?php

declare(strict_types=1);

namespace Planner\Infrastructure\Session;

use PDO;

/** Removes one bounded batch so scheduled cleanup never holds a large lock. */
final readonly class SessionPruner
{
    private const BATCH_SIZE = 1_000;

    public function __construct(private PDO $pdo) {}

    public function pruneExpired(): int
    {
        $statement = $this->pdo->prepare(
            'DELETE FROM sessions WHERE expires_at <= UTC_TIMESTAMP(6) ORDER BY expires_at LIMIT '.self::BATCH_SIZE,
        );
        $statement->execute();

        return $statement->rowCount();
    }
}
