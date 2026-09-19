<?php

declare(strict_types=1);

namespace Planner\Infrastructure\Database;

use PDO;
use RuntimeException;
use Throwable;

final readonly class MigrationRunner
{
    public function __construct(
        private PDO $pdo,
        private string $directory,
        private string $expectedDatabase,
    ) {}

    /** @return list<array{name: string, status: string, checksum: string}> */
    public function status(): array
    {
        $this->guardDatabase();
        $this->ensureLedger();
        $applied = $this->applied();
        $status = [];

        foreach ($this->files() as $file) {
            $migration = $this->load($file);
            $checksum = $this->checksum($file);
            $recorded = $applied[$migration->name()] ?? null;

            $status[] = [
                'name' => $migration->name(),
                'status' => $recorded === null ? 'pending' : ($recorded === $checksum ? 'applied' : 'checksum_mismatch'),
                'checksum' => $checksum,
            ];
        }

        return $status;
    }

    /** @return list<string> */
    public function migrate(): array
    {
        $this->guardDatabase();
        $lockName = 'planner:migrate:'.$this->expectedDatabase;
        $statement = $this->pdo->prepare('SELECT GET_LOCK(:name, 10)');
        $statement->execute(['name' => $lockName]);

        if ((int) $statement->fetchColumn() !== 1) {
            throw new RuntimeException('Could not acquire the migration advisory lock.');
        }

        try {
            $this->ensureLedger();
            $applied = $this->applied();
            $completed = [];

            foreach ($this->files() as $file) {
                $migration = $this->load($file);
                $name = $migration->name();
                $checksum = $this->checksum($file);

                if (isset($applied[$name])) {
                    if (! hash_equals($applied[$name], $checksum)) {
                        throw new RuntimeException("Migration checksum mismatch [$name].");
                    }

                    continue;
                }

                $migration->up($this->pdo);
                $insert = $this->pdo->prepare(
                    'INSERT INTO schema_migrations (name, checksum, applied_at) VALUES (:name, :checksum, UTC_TIMESTAMP(6))',
                );
                $insert->execute(['name' => $name, 'checksum' => $checksum]);
                $completed[] = $name;
            }

            return $completed;
        } finally {
            try {
                $release = $this->pdo->prepare('SELECT RELEASE_LOCK(:name)');
                $release->execute(['name' => $lockName]);
            } catch (Throwable) {
                // The server also releases named locks when this connection closes.
            }
        }
    }

    public function check(): void
    {
        foreach ($this->status() as $migration) {
            if ($migration['status'] !== 'applied') {
                throw new RuntimeException("Migration is not healthy [{$migration['name']}]: {$migration['status']}.");
            }
        }
    }

    private function guardDatabase(): void
    {
        $actual = (string) $this->pdo->query('SELECT DATABASE()')->fetchColumn();

        if ($actual !== $this->expectedDatabase) {
            throw new RuntimeException('Configured and actual database names do not match.');
        }
    }

    private function ensureLedger(): void
    {
        $this->pdo->exec('CREATE TABLE IF NOT EXISTS schema_migrations (
            name VARCHAR(190) NOT NULL PRIMARY KEY,
            checksum CHAR(64) CHARACTER SET ascii COLLATE ascii_bin NOT NULL,
            applied_at DATETIME(6) NOT NULL
        ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci');
    }

    /** @return array<string, string> */
    private function applied(): array
    {
        $rows = $this->pdo->query('SELECT name, checksum FROM schema_migrations ORDER BY name')->fetchAll();
        $applied = [];

        foreach ($rows as $row) {
            $applied[(string) $row['name']] = (string) $row['checksum'];
        }

        return $applied;
    }

    /** @return list<string> */
    private function files(): array
    {
        $files = glob($this->directory.'/*.php');

        if ($files === false) {
            throw new RuntimeException('Unable to read migration directory.');
        }

        sort($files, SORT_STRING);

        return $files;
    }

    private function load(string $file): Migration
    {
        $migration = require $file;

        if (! $migration instanceof Migration) {
            throw new RuntimeException("Migration file did not return a Migration [$file].");
        }

        return $migration;
    }

    private function checksum(string $file): string
    {
        $checksum = hash_file('sha256', $file);

        if ($checksum === false) {
            throw new RuntimeException("Unable to checksum migration [$file].");
        }

        return $checksum;
    }
}
