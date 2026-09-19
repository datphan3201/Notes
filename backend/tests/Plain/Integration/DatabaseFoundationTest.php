<?php

declare(strict_types=1);

namespace Tests\Plain\Integration;

use PDO;
use PHPUnit\Framework\TestCase;
use Planner\Config\ConfigLoader;
use Planner\Infrastructure\Database\ConnectionFactory;
use Planner\Infrastructure\Database\MigrationRunner;
use Planner\Infrastructure\Database\TransactionManager;
use Planner\Http\Security\RateLimiter;
use Planner\Infrastructure\Session\SessionPruner;
use RuntimeException;

final class DatabaseFoundationTest extends TestCase
{
    private PDO $pdo;

    protected function setUp(): void
    {
        $basePath = dirname(__DIR__, 3);
        $config = (new ConfigLoader)->load($basePath);
        self::assertSame('testing', $config->string('app.env'));
        self::assertSame('goals_test', $config->string('database.name'));

        $this->pdo = (new ConnectionFactory($config))->create();
        self::assertSame('goals_test', $this->pdo->query('SELECT DATABASE()')->fetchColumn());
        $this->wipeTargetDatabase();
    }

    public function test_connection_uses_native_prepares_utc_and_strict_sql(): void
    {
        $settings = $this->pdo->query('SELECT @@session.time_zone AS time_zone, @@session.sql_mode AS sql_mode')->fetch();

        self::assertSame('+00:00', $settings['time_zone']);
        self::assertStringContainsString('STRICT_TRANS_TABLES', $settings['sql_mode']);
        self::assertFalse($this->pdo->getAttribute(PDO::ATTR_EMULATE_PREPARES));
    }

    public function test_nested_failure_marks_outer_transaction_for_rollback(): void
    {
        $manager = new TransactionManager($this->pdo);
        $this->pdo->exec('CREATE TEMPORARY TABLE transaction_probe (value INT NOT NULL)');

        try {
            $manager->run(function (PDO $pdo) use ($manager): void {
                $pdo->exec('INSERT INTO transaction_probe (value) VALUES (1)');

                try {
                    $manager->run(static function (): void {
                        throw new RuntimeException('nested failure');
                    });
                } catch (RuntimeException) {
                }
            });

            self::fail('Rollback-only transaction unexpectedly committed.');
        } catch (\LogicException $exception) {
            self::assertStringContainsString('rollback-only', $exception->getMessage());
        }

        self::assertSame(0, (int) $this->pdo->query('SELECT COUNT(*) FROM transaction_probe')->fetchColumn());
    }

    public function test_migrations_apply_once_and_checksum_state_is_healthy(): void
    {
        $runner = new MigrationRunner(
            $this->pdo,
            dirname(__DIR__, 3).'/database/plain-migrations',
            'goals_test',
        );

        $first = $runner->migrate();
        $second = $runner->migrate();
        $runner->check();

        self::assertContains('0001_create_legacy_parity_schema', $first);
        self::assertSame([], $second);
        self::assertSame('applied', $runner->status()[0]['status']);
    }

    public function test_migration_runner_refuses_wrong_database_identity(): void
    {
        $runner = new MigrationRunner(
            $this->pdo,
            dirname(__DIR__, 3).'/database/plain-migrations',
            'notes_test',
        );

        $this->expectException(RuntimeException::class);
        $this->expectExceptionMessage('do not match');

        $runner->status();
    }

    public function test_migration_check_rejects_recorded_checksum_change(): void
    {
        $runner = new MigrationRunner(
            $this->pdo,
            dirname(__DIR__, 3).'/database/plain-migrations',
            'goals_test',
        );
        $runner->migrate();
        $this->pdo->exec("UPDATE schema_migrations SET checksum = REPEAT('0', 64)");

        $this->expectException(RuntimeException::class);
        $this->expectExceptionMessage('checksum_mismatch');

        $runner->check();
    }

    public function test_maintenance_pruners_delete_only_expired_rows(): void
    {
        (new MigrationRunner(
            $this->pdo,
            dirname(__DIR__, 3).'/database/plain-migrations',
            'goals_test',
        ))->migrate();
        $this->pdo->exec(<<<'SQL'
INSERT INTO sessions (id, payload, last_activity, expires_at) VALUES
    (REPEAT('a', 64), X'00', UTC_TIMESTAMP(6), UTC_TIMESTAMP(6) - INTERVAL 1 SECOND),
    (REPEAT('b', 64), X'00', UTC_TIMESTAMP(6), UTC_TIMESTAMP(6) + INTERVAL 1 HOUR)
SQL);
        $this->pdo->exec(<<<'SQL'
INSERT INTO rate_limit_buckets (bucket_key, attempts, window_started_at, expires_at) VALUES
    (REPEAT('c', 64), 1, UTC_TIMESTAMP(6), UTC_TIMESTAMP(6) - INTERVAL 1 SECOND),
    (REPEAT('d', 64), 1, UTC_TIMESTAMP(6), UTC_TIMESTAMP(6) + INTERVAL 1 HOUR)
SQL);

        $sessionCount = (new SessionPruner($this->pdo))->pruneExpired();
        $bucketCount = (new RateLimiter($this->pdo))->pruneExpired();

        self::assertSame(1, $sessionCount);
        self::assertSame(1, $bucketCount);
        self::assertSame(1, (int) $this->pdo->query('SELECT COUNT(*) FROM sessions')->fetchColumn());
        self::assertSame(1, (int) $this->pdo->query('SELECT COUNT(*) FROM rate_limit_buckets')->fetchColumn());
    }

    private function wipeTargetDatabase(): void
    {
        $tables = $this->pdo->query(
            "SELECT table_name FROM information_schema.tables WHERE table_schema = 'goals_test' AND table_type = 'BASE TABLE'",
        )->fetchAll(PDO::FETCH_COLUMN);

        $this->pdo->exec('SET FOREIGN_KEY_CHECKS = 0');

        try {
            foreach ($tables as $table) {
                if (! is_string($table) || preg_match('/^[a-z0-9_]+$/', $table) !== 1) {
                    throw new RuntimeException('Unsafe test table name.');
                }

                $this->pdo->exec("DROP TABLE `$table`");
            }
        } finally {
            $this->pdo->exec('SET FOREIGN_KEY_CHECKS = 1');
        }
    }
}
