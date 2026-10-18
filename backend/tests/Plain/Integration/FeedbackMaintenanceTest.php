<?php

declare(strict_types=1);
namespace Tests\Plain\Integration;
use DateTimeImmutable;
use PDO;
use PHPUnit\Framework\TestCase;
use Planner\Application\Account\PasswordResetDelivery;
use Planner\Application\Account\PasswordResetService;
use Planner\Http\ValidationException;
use Planner\Infrastructure\Database\MigrationRunner;
use Planner\Infrastructure\Persistence\Pdo\Account\PdoPasswordResetRepository;
use Planner\Http\Security\RateLimiter;
use Planner\Support\Clock;
use Psr\Log\NullLogger;

final class FeedbackMaintenanceTest extends TestCase
{
    private array $app;
    private PDO $pdo;
    protected function setUp(): void
    {
        if (session_status() === PHP_SESSION_ACTIVE) { session_write_close(); }
        session_id(''); $_SESSION = []; $_COOKIE = [];
        $this->app = require dirname(__DIR__, 3).'/bootstrap/http.php';
        $this->pdo = $this->app['pdo'];
        self::assertSame('goals_test', $this->pdo->query('SELECT DATABASE()')->fetchColumn());
        $tables = $this->pdo->query("SELECT table_name FROM information_schema.tables WHERE table_schema = 'goals_test' AND table_type = 'BASE TABLE'")->fetchAll(PDO::FETCH_COLUMN);
        $this->pdo->exec('SET FOREIGN_KEY_CHECKS = 0');
        try { foreach ($tables as $table) { $this->pdo->exec('DROP TABLE `'.str_replace('`', '``', $table).'`'); } }
        finally { $this->pdo->exec('SET FOREIGN_KEY_CHECKS = 1'); }
        (new MigrationRunner($this->pdo, dirname(__DIR__, 3).'/database/plain-migrations', 'goals_test'))->migrate();
    }
    protected function tearDown(): void { $this->app['session']->close(); session_id(''); $_SESSION = []; $_COOKIE = []; }
    public function test_reset_replaces_token_expires_and_invalidates_sessions(): void
    {
        $clock = new class implements Clock {
            public DateTimeImmutable $time;
            public function __construct() { $this->time = new DateTimeImmutable('2026-10-19T12:00:00Z'); }
            public function now(): DateTimeImmutable { return $this->time; }
        };
        $delivery = new class implements PasswordResetDelivery {
            public array $urls = [];
            public function send(string $email, string $url): void { $this->urls[] = $url; }
        };
        $accounts = $this->app['account_repository'];
        $owner = $accounts->insertUser('reset@example.test', 'Reset', password_hash('original password', PASSWORD_BCRYPT), '2026-10-19 12:00:00.000000');
        $service = new PasswordResetService($accounts, new PdoPasswordResetRepository($this->pdo), $this->app['transactions'], new RateLimiter($this->pdo), $clock, $delivery, new NullLogger, 'http://localhost:8000');
        $service->request('unknown@example.test', '127.0.0.1'); self::assertCount(0, $delivery->urls);
        $service->request($owner->email, '127.0.0.1'); parse_str(parse_url($delivery->urls[0], PHP_URL_QUERY), $first);
        $service->request($owner->email, '127.0.0.1'); parse_str(parse_url($delivery->urls[1], PHP_URL_QUERY), $second);
        self::assertNotSame($first['token'], $second['token']);
        self::assertSame(hash('sha256', $second['token']), $this->pdo->query('SELECT token_hash FROM password_resets')->fetchColumn());
        try { $service->reset($owner->email, $first['token'], 'new password value', '127.0.0.1'); self::fail('Old link must fail'); }
        catch (ValidationException $error) { self::assertArrayHasKey('token', $error->errors); }
        $statement = $this->pdo->prepare("INSERT INTO sessions (id,user_id,payload,last_activity,expires_at) VALUES (:id,:user,'test',UTC_TIMESTAMP(6),UTC_TIMESTAMP(6) + INTERVAL 1 HOUR)");
        $statement->execute(['id' => str_repeat('a',64), 'user' => $owner->id]);
        $service->reset($owner->email, $second['token'], 'new password value', '127.0.0.1');
        self::assertTrue(password_verify('new password value', $accounts->findById($owner->id)->passwordHash));
        self::assertSame(2, $accounts->findById($owner->id)->authVersion);
        self::assertSame(0, (int) $this->pdo->query('SELECT COUNT(*) FROM sessions')->fetchColumn());
        self::assertSame(0, (int) $this->pdo->query('SELECT COUNT(*) FROM password_resets')->fetchColumn());
        try { $service->reset($owner->email, $second['token'], 'other password value', '127.0.0.1'); self::fail('Replay must fail'); }
        catch (ValidationException) { self::assertTrue(true); }
        $service->request($owner->email, '127.0.0.1'); parse_str(parse_url($delivery->urls[2], PHP_URL_QUERY), $third);
        $clock->time = $clock->time->modify('+30 minutes');
        $this->expectException(ValidationException::class);
        $service->reset($owner->email, $third['token'], 'expired password value', '127.0.0.1');
    }
    public function test_recurring_capture_and_reminders_are_owned_and_settings_stay_isolated(): void
    {
        $accounts = $this->app['account_repository'];
        $owner = $accounts->insertUser('owner@example.test', 'Owner', password_hash('original password', PASSWORD_BCRYPT), '2026-10-19 12:00:00.000000');
        $other = $accounts->insertUser('other@example.test', 'Other', password_hash('original password', PASSWORD_BCRYPT), '2026-10-19 12:00:00.000000');
        $series = $this->app['task_series_service']->createAndMaterialize($owner->id, ['name' => 'Monthly work', 'frequency' => 'monthly', 'interval_count' => 1, 'weekdays' => [], 'start_date' => $this->app['clock']->now()->format('Y-m-d'), 'timezone' => 'UTC']);
        self::assertSame('monthly', $series['frequency']);
        self::assertGreaterThan(0, count($this->app['planning_service']->list('task', $owner->id)));
        self::assertSame([], $this->app['planning_service']->list('task', $other->id));
        $this->app['planning_service']->create('task', $owner->id, ['name' => 'Reminder', 'reminder_at' => '2020-01-01T00:00:00Z']);
        self::assertCount(1, $this->app['reminder_service']->due($owner->id));
        self::assertSame([], $this->app['reminder_service']->due($other->id));
        $accounts->updatePreferences($owner->id, ['notifications_enabled' => false, 'background_color' => '#123456'], '2026-10-19 12:00:00.000000');
        self::assertSame([], $this->app['reminder_service']->due($owner->id));
        self::assertSame('#123456', $accounts->preferences($owner->id)['background_color']);
        self::assertSame('', $accounts->preferences($other->id)['background_color']);
        self::assertSame('', $accounts->preferences($other->id)['background_url']);
    }
}
