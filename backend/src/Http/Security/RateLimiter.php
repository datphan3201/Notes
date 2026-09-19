<?php

declare(strict_types=1);

namespace Planner\Http\Security;

use DateInterval;
use DateTimeImmutable;
use DateTimeZone;
use PDO;
use Planner\Http\HttpException;

final readonly class RateLimiter
{
    private const PRUNE_BATCH_SIZE = 1_000;

    public function __construct(private PDO $pdo) {}

    public function consume(string $scope, string $identity, int $limit, int $windowSeconds): void
    {
        $result = $this->hit($scope, $identity, $windowSeconds);

        if ($result['attempts'] > $limit) {
            throw $this->exceeded($result['retry_after']);
        }
    }

    public function assertAvailable(string $scope, string $identity, int $limit): void
    {
        $statement = $this->pdo->prepare(
            'SELECT attempts, expires_at FROM rate_limit_buckets WHERE bucket_key = :bucket_key AND expires_at > UTC_TIMESTAMP(6)',
        );
        $statement->execute(['bucket_key' => $this->key($scope, $identity)]);
        $row = $statement->fetch();

        if (is_array($row) && (int) $row['attempts'] >= $limit) {
            $retryAfter = max(1, (new DateTimeImmutable((string) $row['expires_at'], new DateTimeZone('UTC')))->getTimestamp() - time());
            throw $this->exceeded($retryAfter);
        }
    }

    /** @return array{attempts: int, retry_after: int} */
    public function hit(string $scope, string $identity, int $windowSeconds): array
    {
        $now = new DateTimeImmutable('now', new DateTimeZone('UTC'));
        $expires = $now->add(new DateInterval('PT'.$windowSeconds.'S'));
        $key = $this->key($scope, $identity);
        $statement = $this->pdo->prepare(<<<'SQL'
INSERT INTO rate_limit_buckets (bucket_key, attempts, window_started_at, expires_at)
VALUES (:bucket_key, 1, :now_at, :expires_at)
ON DUPLICATE KEY UPDATE
    attempts = IF(expires_at <= VALUES(window_started_at), 1, attempts + 1),
    window_started_at = IF(expires_at <= VALUES(window_started_at), VALUES(window_started_at), window_started_at),
    expires_at = IF(expires_at <= VALUES(window_started_at), VALUES(expires_at), expires_at)
SQL);
        $statement->execute([
            'bucket_key' => $key,
            'now_at' => $now->format('Y-m-d H:i:s.u'),
            'expires_at' => $expires->format('Y-m-d H:i:s.u'),
        ]);
        $select = $this->pdo->prepare('SELECT attempts, expires_at FROM rate_limit_buckets WHERE bucket_key = :bucket_key');
        $select->execute(['bucket_key' => $key]);
        $row = $select->fetch();

        if (! is_array($row)) {
            throw new \RuntimeException('Rate limit bucket could not be read.');
        }

        return [
            'attempts' => (int) $row['attempts'],
            'retry_after' => max(1, (new DateTimeImmutable((string) $row['expires_at'], new DateTimeZone('UTC')))->getTimestamp() - $now->getTimestamp()),
        ];
    }

    public function clear(string $scope, string $identity): void
    {
        $statement = $this->pdo->prepare('DELETE FROM rate_limit_buckets WHERE bucket_key = :bucket_key');
        $statement->execute(['bucket_key' => $this->key($scope, $identity)]);
    }

    /** Removes one indexed batch so hourly maintenance has a bounded lock. */
    public function pruneExpired(): int
    {
        $statement = $this->pdo->prepare(
            'DELETE FROM rate_limit_buckets WHERE expires_at <= UTC_TIMESTAMP(6) ORDER BY expires_at LIMIT '.self::PRUNE_BATCH_SIZE,
        );
        $statement->execute();

        return $statement->rowCount();
    }

    private function key(string $scope, string $identity): string
    {
        return hash('sha256', $scope."\0".$identity);
    }

    private function exceeded(int $retryAfter): HttpException
    {
        return new HttpException(
            429,
            'TOO_MANY_REQUESTS',
            'Too many requests. Please try again later.',
            ['Retry-After' => (string) $retryAfter],
        );
    }
}
