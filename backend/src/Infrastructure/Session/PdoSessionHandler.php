<?php

declare(strict_types=1);

namespace Planner\Infrastructure\Session;

use DateInterval;
use PDO;
use Psr\Log\LoggerInterface;
use SessionHandlerInterface;
use SessionIdInterface;
use SessionUpdateTimestampHandlerInterface;
use Throwable;

final class PdoSessionHandler implements SessionHandlerInterface, SessionIdInterface, SessionUpdateTimestampHandlerInterface
{
    private ?int $userId = null;

    private string $ipAddress = '';

    private string $userAgent = '';

    public function __construct(
        private readonly PDO $pdo,
        private readonly SessionCipher $cipher,
        private readonly LoggerInterface $logger,
        private readonly int $lifetimeSeconds,
    ) {}

    public function setRequestMetadata(string $ipAddress, string $userAgent): void
    {
        $this->ipAddress = mb_substr($ipAddress, 0, 45);
        $this->userAgent = mb_substr($userAgent, 0, 500);
    }

    public function setUserId(?int $userId): void
    {
        $this->userId = $userId;
    }

    public function open(string $path, string $name): bool
    {
        return true;
    }

    public function close(): bool
    {
        return true;
    }

    public function create_sid(): string
    {
        return bin2hex(random_bytes(32));
    }

    public function read(string $id): string|false
    {
        $statement = $this->pdo->prepare(
            'SELECT payload FROM sessions WHERE id = :id AND expires_at > UTC_TIMESTAMP(6)',
        );
        $statement->execute(['id' => $id]);
        $payload = $statement->fetchColumn();

        if (! is_string($payload)) {
            return '';
        }

        try {
            return $this->cipher->decrypt($id, $payload);
        } catch (Throwable $exception) {
            $this->logger->warning('Invalid encrypted session payload.', [
                'session_id_hash' => hash('sha256', $id),
                'exception' => $exception::class,
            ]);

            return '';
        }
    }

    public function write(string $id, string $data): bool
    {
        $now = new \DateTimeImmutable('now', new \DateTimeZone('UTC'));
        $expires = $now->add(new DateInterval('PT'.$this->lifetimeSeconds.'S'));
        $statement = $this->pdo->prepare(<<<'SQL'
INSERT INTO sessions (id, user_id, payload, ip_address, user_agent, last_activity, expires_at)
VALUES (:id, :user_id, :payload, :ip_address, :user_agent, :last_activity, :expires_at)
ON DUPLICATE KEY UPDATE
    user_id = VALUES(user_id), payload = VALUES(payload), ip_address = VALUES(ip_address),
    user_agent = VALUES(user_agent), last_activity = VALUES(last_activity), expires_at = VALUES(expires_at)
SQL);

        return $statement->execute([
            'id' => $id,
            'user_id' => $this->userId,
            'payload' => $this->cipher->encrypt($id, $data),
            'ip_address' => $this->ipAddress !== '' ? $this->ipAddress : null,
            'user_agent' => $this->userAgent !== '' ? $this->userAgent : null,
            'last_activity' => $now->format('Y-m-d H:i:s.u'),
            'expires_at' => $expires->format('Y-m-d H:i:s.u'),
        ]);
    }

    public function destroy(string $id): bool
    {
        $statement = $this->pdo->prepare('DELETE FROM sessions WHERE id = :id');

        return $statement->execute(['id' => $id]);
    }

    public function gc(int $max_lifetime): int|false
    {
        $statement = $this->pdo->prepare('DELETE FROM sessions WHERE expires_at <= UTC_TIMESTAMP(6) LIMIT 1000');
        $statement->execute();

        return $statement->rowCount();
    }

    public function validateId(string $id): bool
    {
        $statement = $this->pdo->prepare(
            'SELECT 1 FROM sessions WHERE id = :id AND expires_at > UTC_TIMESTAMP(6)',
        );
        $statement->execute(['id' => $id]);

        return $statement->fetchColumn() !== false;
    }

    public function updateTimestamp(string $id, string $data): bool
    {
        $expires = (new \DateTimeImmutable('now', new \DateTimeZone('UTC')))
            ->add(new DateInterval('PT'.$this->lifetimeSeconds.'S'));
        $statement = $this->pdo->prepare(
            'UPDATE sessions SET last_activity = UTC_TIMESTAMP(6), expires_at = :expires_at WHERE id = :id',
        );

        return $statement->execute(['id' => $id, 'expires_at' => $expires->format('Y-m-d H:i:s.u')]);
    }
}
