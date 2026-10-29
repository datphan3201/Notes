<?php

declare(strict_types=1);

namespace Tests\Plain\Integration;

use DateTimeImmutable;
use DateTimeZone;
use PDO;
use PHPUnit\Framework\TestCase;
use Planner\Application\Account\EmailVerificationService;
use Planner\Application\Account\MessageDelivery;
use Planner\Application\Scheduling\Scheduler;
use Planner\Http\HttpException;
use Planner\Http\Security\RateLimiter;
use Planner\Http\ValidationException;
use Planner\Infrastructure\Database\MigrationRunner;
use Planner\Infrastructure\Persistence\Pdo\Account\PdoEmailTokenRepository;
use Planner\Infrastructure\Persistence\Pdo\Scheduling\PdoScheduledJobRepository;
use Planner\Support\Clock;
use Psr\Log\NullLogger;
use RuntimeException;

final class ProductCompletionTest extends TestCase
{
    private array $runtime;
    private PDO $pdo;
    private int $owner;

    protected function setUp(): void
    {
        if (session_status() === PHP_SESSION_ACTIVE) session_write_close();
        session_id('');
        $_SESSION = [];
        $_COOKIE = [];
        $this->runtime = require dirname(__DIR__, 3).'/bootstrap/http.php';
        $this->pdo = $this->runtime['pdo'];
        self::assertSame('goals_test', $this->pdo->query('SELECT DATABASE()')->fetchColumn());
        $this->wipeTargetDatabase();
        (new MigrationRunner($this->pdo, dirname(__DIR__, 3).'/database/plain-migrations', 'goals_test'))->migrate();
        $this->owner = $this->runtime['account_repository']->insertUser('complete@example.test', 'Owner', password_hash('correct horse battery staple', PASSWORD_BCRYPT), '2026-09-17 12:00:00.000000')->id;
    }

    protected function tearDown(): void
    {
        $this->runtime['session']->close();
        session_id('');
        $_SESSION = [];
        $_COOKIE = [];
    }

    public function test_email_verification_and_change_follow_their_own_links(): void
    {
        $delivery = new class implements MessageDelivery {
            /** @var list<array{0:string,1:string,2:string}> */
            public array $sent = [];
            public function sendMessage(string $email, string $subject, string $body): void { $this->sent[] = [$email, $subject, $body]; }
        };
        $accounts = $this->runtime['account_repository'];
        $service = new EmailVerificationService($accounts, new PdoEmailTokenRepository($this->pdo), $this->runtime['transactions'],
            new RateLimiter($this->pdo), $this->runtime['clock'], $delivery, new NullLogger, 'http://planner.test');
        $token = static function (string $body, string $path): string {
            preg_match('#'.preg_quote($path, '#').'\?token=([a-f0-9]{64})#', $body, $match);
            return $match[1] ?? '';
        };

        $service->sendVerification($this->owner);
        self::assertSame('complete@example.test', $delivery->sent[0][0]);
        try {
            $service->verify(str_repeat('a', 64));
            self::fail('An unknown token must be rejected.');
        } catch (ValidationException) {
        }
        $service->verify($token($delivery->sent[0][2], '/verify-email'));
        self::assertNotNull($accounts->findById($this->owner)->emailVerifiedAt);
        $service->sendVerification($this->owner);
        self::assertCount(1, $delivery->sent, 'A verified address is not asked again.');

        try {
            $service->requestChange($this->owner, 'wrong password', 'new@example.test');
            self::fail('The current password is required.');
        } catch (ValidationException $error) {
            self::assertArrayHasKey('current_password', $error->errors);
        }
        $accounts->insertUser('taken@example.test', 'Other', password_hash('another password', PASSWORD_BCRYPT), '2026-09-17 12:00:00.000000');
        try {
            $service->requestChange($this->owner, 'correct horse battery staple', 'taken@example.test');
            self::fail('A registered address cannot be claimed.');
        } catch (ValidationException $error) {
            self::assertArrayHasKey('email', $error->errors);
        }
        $service->requestChange($this->owner, 'correct horse battery staple', 'new@example.test');
        self::assertSame('new@example.test', $service->pendingChange($this->owner));
        self::assertSame('complete@example.test', $accounts->findById($this->owner)->email, 'Nothing changes before the link is followed.');
        $changed = $service->confirmChange($token($delivery->sent[1][2], '/confirm-email'));
        self::assertSame('new@example.test', $changed->email);
        self::assertNull($service->pendingChange($this->owner));
        self::assertSame('complete@example.test', $delivery->sent[2][0], 'The previous address is told about the change.');
        $this->expectException(ValidationException::class);
        $service->confirmChange($token($delivery->sent[1][2], '/confirm-email'));
    }

    public function test_due_reminders_can_be_dismissed_and_return_when_rescheduled(): void
    {
        $planning = $this->runtime['planning_service'];
        $reminders = $this->runtime['reminder_service'];
        $past = (new DateTimeImmutable('-5 minutes'))->format(DATE_ATOM);
        $task = $planning->create('task', $this->owner, ['goal_id' => null, 'milestone_id' => null, 'name' => 'Call back', 'reminder_at' => $past]);
        $other = $planning->create('task', $this->owner, ['goal_id' => null, 'milestone_id' => null, 'name' => 'Pay bill', 'reminder_at' => $past]);
        self::assertCount(2, $reminders->due($this->owner));

        $reminders->markRead($this->owner, $task['id']);
        self::assertSame([$other['id']], array_column($reminders->due($this->owner), 'id'));
        self::assertSame(1, $this->runtime['notification_service']->inbox($this->owner)['unread']);

        $this->runtime['notification_service']->markRead($this->owner, null);
        self::assertSame([], $reminders->due($this->owner));

        $planning->update('task', $this->owner, $task['id'], ['base_version' => $task['version'], 'reminder_at' => (new DateTimeImmutable('-1 minute'))->format(DATE_ATOM)]);
        self::assertSame([$task['id']], array_column($reminders->due($this->owner), 'id'));
    }

    public function test_goal_and_milestone_can_be_archived_with_everything_inside(): void
    {
        $planning = $this->runtime['planning_service'];
        $area = $planning->create('area', $this->owner, ['name' => 'Health']);
        $planning->create('area', $this->owner, ['name' => 'Work']);
        $goal = $planning->create('goal', $this->owner, ['area_id' => $area['id'], 'parent_goal_id' => null, 'name' => 'Run a race']);
        $child = $planning->create('goal', $this->owner, ['area_id' => null, 'parent_goal_id' => $goal['id'], 'name' => 'Build stamina']);
        $milestone = $planning->create('milestone', $this->owner, ['goal_id' => $goal['id'], 'name' => '5 km']);
        $prerequisite = $planning->create('milestone', $this->owner, ['goal_id' => $goal['id'], 'name' => 'Shoes']);
        $planning->addDependency($this->owner, $milestone['id'], ['prerequisite_id' => $prerequisite['id'], 'base_version' => $milestone['version']]);
        $planning->create('task', $this->owner, ['goal_id' => null, 'milestone_id' => $milestone['id'], 'name' => 'Jog']);
        $planning->create('task', $this->owner, ['goal_id' => $goal['id'], 'milestone_id' => null, 'name' => 'Plan']);
        $planning->create('task', $this->owner, ['goal_id' => $child['id'], 'milestone_id' => null, 'name' => 'Stretch']);
        $kept = $planning->create('task', $this->owner, ['goal_id' => null, 'milestone_id' => null, 'name' => 'Unrelated']);
        $today = $this->runtime['clock']->now()->format('Y-m-d');
        $this->runtime['task_series_service']->createAndMaterialize($this->owner, [
            'name' => 'Daily run', 'milestone_id' => $milestone['id'], 'frequency' => 'daily', 'interval_count' => 1,
            'weekdays' => [], 'start_date' => $today, 'timezone' => 'UTC',
        ]);

        // Without the explicit opt-in the old rule still protects content.
        try {
            $planning->archive('goal', $this->owner, $goal['id'], ['base_version' => $planning->show('goal', $this->owner, $goal['id'])['version']]);
            self::fail('A Goal with content needs include_contents.');
        } catch (ValidationException) {
        }

        $prerequisite = $planning->show('milestone', $this->owner, $prerequisite['id']);
        $planning->archive('milestone', $this->owner, $prerequisite['id'], ['base_version' => $prerequisite['version'], 'include_contents' => true]);
        self::assertSame([], $planning->prerequisites($this->owner, $milestone['id']), 'Archiving a prerequisite drops the link.');

        $goal = $planning->show('goal', $this->owner, $goal['id']);
        $planning->archive('goal', $this->owner, $goal['id'], ['base_version' => $goal['version'], 'include_contents' => true]);
        self::assertSame([], $planning->list('goal', $this->owner));
        self::assertSame([], $planning->list('milestone', $this->owner));
        self::assertSame([$kept['id']], array_column($planning->list('task', $this->owner), 'id'));
        self::assertSame([], $this->runtime['task_series_service']->list($this->owner));
    }

    public function test_review_can_be_deleted_with_its_current_version(): void
    {
        $reviews = $this->runtime['review_service'];
        $review = $reviews->create($this->owner, ['kind' => 'Daily', 'date' => $this->runtime['clock']->now()->format('Y-m-d')]);
        try {
            $reviews->delete($this->owner, $review['id'], ['base_version' => $review['version'] + 1]);
            self::fail('A stale version must not delete.');
        } catch (HttpException $error) {
            self::assertSame(409, $error->status);
        }
        $reviews->delete($this->owner, $review['id'], ['base_version' => $review['version']]);
        $this->expectException(HttpException::class);
        $reviews->show($this->owner, $review['id']);
    }

    public function test_repeating_tasks_carry_a_local_reminder_and_extend_without_a_scheduler(): void
    {
        $series = $this->runtime['task_series_service'];
        $today = (new DateTimeImmutable('now', new DateTimeZone('Asia/Ho_Chi_Minh')))->format('Y-m-d');
        $created = $series->createAndMaterialize($this->owner, [
            'name' => 'Read', 'frequency' => 'daily', 'interval_count' => 1, 'weekdays' => [],
            'start_date' => $today, 'timezone' => 'Asia/Ho_Chi_Minh', 'reminder_time' => '09:30',
        ]);
        self::assertSame('09:30:00', $created['reminder_time']);
        $first = array_values(array_filter($this->runtime['planning_service']->list('task', $this->owner), static fn (array $task): bool => $task['occurrence_date'] === $today))[0];
        // 09:30 in Ho Chi Minh City is 02:30 UTC.
        self::assertSame($today.'T02:30:00.000000Z', $first['reminder_at']);

        $soon = (new DateTimeImmutable($today))->modify('+3 days')->format('Y-m-d');
        $this->pdo->prepare('UPDATE task_series SET cursor_date = :cursor WHERE id = :id')->execute(['cursor' => $soon, 'id' => $created['id']]);
        $series->materializeDue($this->owner);
        self::assertGreaterThanOrEqual((new DateTimeImmutable($today))->modify('+28 days')->format('Y-m-d'), $series->show($this->owner, $created['id'])['cursor_date']);

        try {
            $series->create($this->owner, ['name' => 'Bad', 'frequency' => 'daily', 'interval_count' => 1, 'weekdays' => [], 'start_date' => $today, 'timezone' => 'UTC', 'reminder_time' => '25:00']);
            self::fail('An invalid reminder time must be rejected.');
        } catch (ValidationException $error) {
            self::assertArrayHasKey('reminder_time', $error->errors);
        }
    }

    public function test_scheduler_runs_each_job_once_per_interval(): void
    {
        $clock = new class implements Clock {
            public DateTimeImmutable $time;
            public function __construct() { $this->time = new DateTimeImmutable('2026-10-29T08:00:00Z'); }
            public function now(): DateTimeImmutable { return $this->time; }
        };
        $runs = 0;
        $scheduler = new Scheduler(new PdoScheduledJobRepository($this->pdo), $clock, [
            'demo' => ['interval' => 3600, 'run' => static function () use (&$runs): string { $runs++; return 'ok'; }],
            'broken' => ['interval' => 60, 'run' => static function (): string { throw new RuntimeException('boom'); }],
        ]);
        self::assertSame(['demo' => 'ok', 'broken' => 'failed: boom'], $scheduler->runDue());
        $clock->time = $clock->time->modify('+10 minutes');
        self::assertSame(['broken' => 'failed: boom'], $scheduler->runDue());
        $clock->time = $clock->time->modify('+1 hour');
        self::assertSame(['demo' => 'ok', 'broken' => 'failed: boom'], $scheduler->runDue());
        self::assertSame(2, $runs);
    }

    private function wipeTargetDatabase(): void
    {
        $tables = $this->pdo->query("SELECT table_name FROM information_schema.tables WHERE table_schema = 'goals_test' AND table_type = 'BASE TABLE'")->fetchAll(PDO::FETCH_COLUMN);
        $this->pdo->exec('SET FOREIGN_KEY_CHECKS = 0');
        try {
            foreach ($tables as $table) {
                if (!is_string($table) || preg_match('/^[a-z0-9_]+$/', $table) !== 1) throw new RuntimeException('Unsafe test table name.');
                $this->pdo->exec("DROP TABLE `$table`");
            }
        } finally {
            $this->pdo->exec('SET FOREIGN_KEY_CHECKS = 1');
        }
    }
}
