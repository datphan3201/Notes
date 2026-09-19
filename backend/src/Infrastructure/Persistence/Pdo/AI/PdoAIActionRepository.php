<?php

declare(strict_types=1);

namespace Planner\Infrastructure\Persistence\Pdo\AI;

use PDO;

final readonly class PdoAIActionRepository
{
    public function __construct(private PDO $pdo) {}

    public function consented(int $userId): bool
    {
        $statement = $this->pdo->prepare(
            'SELECT ai_consent_at IS NOT NULL FROM user_preferences WHERE user_id = :user_id',
        );
        $statement->execute(['user_id' => $userId]);

        return (bool) $statement->fetchColumn();
    }

    public function consent(int $userId, string $timestamp): void
    {
        $statement = $this->pdo->prepare(
            'UPDATE user_preferences SET ai_consent_at = :consent_at, updated_at = :updated_at WHERE user_id = :user_id',
        );
        $statement->execute([
            'consent_at' => $timestamp,
            'updated_at' => $timestamp,
            'user_id' => $userId,
        ]);
    }

    /** @param array<string, mixed> $values @return array<string, mixed> */
    public function insert(array $values): array
    {
        $columns = array_keys($values);
        $placeholders = array_map(static fn (string $column): string => ':'.$column, $columns);
        $statement = $this->pdo->prepare(
            'INSERT INTO ai_actions ('.implode(', ', $columns).') VALUES ('.implode(', ', $placeholders).')',
        );
        $statement->execute($values);

        return $this->find((int) $values['user_id'], (string) $values['id'])
            ?? throw new \RuntimeException('AI action missing after insert.');
    }

    /** @return array<string, mixed>|null */
    public function find(int $userId, string $id, bool $lock = false): ?array
    {
        $statement = $this->pdo->prepare(
            'SELECT * FROM ai_actions WHERE user_id = :user_id AND id = :id'.($lock ? ' FOR UPDATE' : ''),
        );
        $statement->execute(['user_id' => $userId, 'id' => $id]);
        $row = $statement->fetch();

        return is_array($row) ? $row : null;
    }

    /** @param array<string, mixed> $changes @return array<string, mixed> */
    public function update(int $userId, string $id, array $changes, string $timestamp): array
    {
        $assignments = array_map(
            static fn (string $column): string => "$column = :$column",
            array_keys($changes),
        );
        $assignments[] = 'version = version + 1';
        $assignments[] = 'updated_at = :updated_at';
        $statement = $this->pdo->prepare(
            'UPDATE ai_actions SET '.implode(', ', $assignments).' WHERE user_id = :user_id AND id = :id',
        );
        $statement->execute([
            ...$changes,
            'updated_at' => $timestamp,
            'user_id' => $userId,
            'id' => $id,
        ]);

        return $this->find($userId, $id)
            ?? throw new \RuntimeException('AI action missing after update.');
    }
}
