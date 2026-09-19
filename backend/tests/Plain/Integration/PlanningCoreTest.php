<?php

declare(strict_types=1);

namespace Tests\Plain\Integration;

use PDO;
use PHPUnit\Framework\TestCase;
use Planner\Application\Planning\PlanningService;
use Planner\Http\HttpException;
use Planner\Http\ValidationException;
use Planner\Infrastructure\Database\MigrationRunner;
use Planner\Infrastructure\Persistence\Pdo\Account\PdoAccountRepository;
use RuntimeException;

final class PlanningCoreTest extends TestCase
{
    /** @var array<string, mixed> */
    private array $runtime;

    private PDO $pdo;

    private PlanningService $planning;

    private int $owner;

    protected function setUp(): void
    {
        if (session_status() === PHP_SESSION_ACTIVE) {
            session_write_close();
        }

        session_id('');
        $_SESSION = [];
        $_COOKIE = [];
        $this->runtime = require dirname(__DIR__, 3).'/bootstrap/http.php';
        $this->pdo = $this->runtime['pdo'];
        self::assertSame('goals_test', $this->pdo->query('SELECT DATABASE()')->fetchColumn());
        $this->wipeTargetDatabase();
        (new MigrationRunner(
            $this->pdo,
            dirname(__DIR__, 3).'/database/plain-migrations',
            'goals_test',
        ))->migrate();
        $this->planning = $this->runtime['planning_service'];
        $this->owner = $this->createOwner('planning@example.test');
    }

    protected function tearDown(): void
    {
        $this->runtime['session']->close();
        session_id('');
        $_SESSION = [];
        $_COOKIE = [];
    }

    public function test_arbitrary_goal_nesting_rejects_cycle_and_progress_propagates_iteratively(): void
    {
        $area = $this->planning->create('area', $this->owner, ['name' => 'Career']);
        $root = $this->goal($area['id'], null, 'Root');
        $middle = $this->goal(null, $root['id'], 'Middle');
        $leaf = $this->goal(null, $middle['id'], 'Leaf');
        $task = $this->planning->create('task', $this->owner, [
            'goal_id' => $leaf['id'],
            'milestone_id' => null,
            'name' => 'Ship it',
        ]);
        $task = $this->planning->transition('task', $this->owner, $task['id'], 'complete', [
            'base_version' => $task['version'],
        ]);

        self::assertSame('Done', $task['status']);
        self::assertSame(100.0, $this->planning->show('goal', $this->owner, $root['id'])['progress']);

        $this->expectException(ValidationException::class);
        $this->planning->moveGoal($this->owner, $root['id'], [
            'base_version' => $root['version'],
            'area_id' => null,
            'parent_goal_id' => $leaf['id'],
            'position' => 0,
        ]);
    }

    public function test_contributions_are_multi_target_and_separate_from_primary_hierarchy(): void
    {
        $area = $this->planning->create('area', $this->owner, ['name' => 'Life']);
        $source = $this->goal($area['id'], null, 'Build app');
        $one = $this->goal($area['id'], null, 'Portfolio');
        $two = $this->goal($area['id'], null, 'Learn');

        $source = $this->planning->addContribution('goal', $this->owner, $source['id'], [
            'goal_id' => $one['id'], 'base_version' => $source['version'],
        ]);
        $source = $this->planning->addContribution('goal', $this->owner, $source['id'], [
            'goal_id' => $two['id'], 'base_version' => $source['version'],
        ]);

        self::assertSame(2, (int) $this->pdo->query('SELECT COUNT(*) FROM goal_contributions')->fetchColumn());
        self::assertSame($area['id'], $this->planning->show('goal', $this->owner, $source['id'])['area_id']);

        $this->expectException(ValidationException::class);
        $this->planning->addContribution('goal', $this->owner, $one['id'], [
            'goal_id' => $source['id'], 'base_version' => $one['version'],
        ]);
    }

    public function test_milestone_dependency_blocks_milestone_but_not_its_task(): void
    {
        $area = $this->planning->create('area', $this->owner, ['name' => 'Work']);
        $goal = $this->goal($area['id'], null, 'Backend');
        $first = $this->planning->create('milestone', $this->owner, ['goal_id' => $goal['id'], 'name' => 'Foundation']);
        $second = $this->planning->create('milestone', $this->owner, ['goal_id' => $goal['id'], 'name' => 'Deploy']);
        $second = $this->planning->addDependency($this->owner, $second['id'], [
            'prerequisite_id' => $first['id'], 'base_version' => $second['version'],
        ]);
        $task = $this->planning->create('task', $this->owner, [
            'goal_id' => null, 'milestone_id' => $second['id'], 'name' => 'Prepare deployment',
        ]);
        $task = $this->planning->transition('task', $this->owner, $task['id'], 'complete', ['base_version' => $task['version']]);
        self::assertSame('Done', $task['status']);

        try {
            $this->planning->transition('milestone', $this->owner, $second['id'], 'complete', ['base_version' => $second['version']]);
            self::fail('Locked Milestone completion must be rejected.');
        } catch (ValidationException $exception) {
            self::assertArrayHasKey('status', $exception->errors);
        }

        $first = $this->planning->transition('milestone', $this->owner, $first['id'], 'complete', ['base_version' => $first['version']]);
        self::assertSame('Completed', $first['status']);
        $second = $this->planning->transition('milestone', $this->owner, $second['id'], 'complete', ['base_version' => $second['version']]);
        self::assertSame('Completed', $second['status']);
    }

    public function test_checklist_state_is_independent_and_task_completion_requires_acknowledgement(): void
    {
        $task = $this->planning->create('task', $this->owner, [
            'goal_id' => null, 'milestone_id' => null, 'name' => 'Authentication',
        ]);
        $item = $this->planning->createChecklist($this->owner, $task['id'], ['title' => 'Login']);

        self::assertSame('NotStarted', $this->planning->show('task', $this->owner, $task['id'])['status']);

        try {
            $this->planning->transition('task', $this->owner, $task['id'], 'complete', ['base_version' => $task['version']]);
            self::fail('Unchecked items require acknowledgement.');
        } catch (ValidationException $exception) {
            self::assertArrayHasKey('acknowledge_unchecked_items', $exception->errors);
        }

        $task = $this->planning->transition('task', $this->owner, $task['id'], 'complete', [
            'base_version' => $task['version'], 'acknowledge_unchecked_items' => true,
        ]);
        self::assertSame('Done', $task['status']);
        self::assertFalse($this->planning->list('checklist', $this->owner)[0]['checked']);

        $item = $this->planning->updateChecklist($this->owner, $task['id'], $item['id'], [
            'base_version' => $item['version'], 'checked' => true,
        ]);
        self::assertTrue($item['checked']);
        self::assertSame('Done', $this->planning->show('task', $this->owner, $task['id'])['status']);
    }

    public function test_owner_isolation_returns_not_found_for_every_direct_lookup(): void
    {
        $area = $this->planning->create('area', $this->owner, ['name' => 'Private']);
        $other = $this->createOwner('other-planning@example.test');

        $this->expectException(HttpException::class);
        $this->expectExceptionMessage('not found');
        $this->planning->show('area', $other, $area['id']);
    }

    public function test_hierarchical_tags_reject_cycles_and_snapshots_are_owner_scoped(): void
    {
        $tags = $this->runtime['tag_repository'];
        $tagService = new \Planner\Application\Tags\TagService(
            $tags,
            $this->runtime['note_repository'],
            $this->runtime['account_repository'],
            $this->runtime['transactions'],
            new \Planner\Application\Tags\LabelSerializer,
            $this->runtime['clock'],
            new \Planner\Domain\Planning\GraphGuard,
        );
        $parent = $tagService->createTag($this->owner, [
            'name' => 'Programming', 'parent_id' => null, 'color' => 'sky', 'position' => 0,
        ]);
        $child = $tagService->createTag($this->owner, [
            'name' => 'PHP', 'parent_id' => $parent->id, 'color' => 'mint', 'position' => 0,
        ]);
        $area = $this->planning->create('area', $this->owner, ['name' => 'Learning']);
        $goal = $this->planning->create('goal', $this->owner, [
            'area_id' => $area['id'], 'parent_goal_id' => null, 'name' => 'Backend',
            'tag_ids' => [(string) $child->id],
        ]);
        self::assertSame([(string) $child->id], $goal['tag_ids']);

        try {
            $tagService->updateTag($this->owner, $parent->id, [
                'parent_id' => $child->id, 'base_version' => $parent->version,
            ]);
            self::fail('Tag hierarchy cycles must be rejected.');
        } catch (ValidationException $exception) {
            self::assertArrayHasKey('parent_id', $exception->errors);
        }

        $other = $this->createOwner('other-tags@example.test');
        $foreign = $tagService->createTag($other, [
            'name' => 'Foreign', 'parent_id' => null, 'color' => 'neutral', 'position' => 0,
        ]);

        $this->expectException(ValidationException::class);
        $this->planning->update('goal', $this->owner, $goal['id'], [
            'base_version' => $goal['version'], 'tag_ids' => [(string) $foreign->id],
        ]);
    }

    public function test_default_area_backfill_is_idempotent_and_preserves_existing_accounts(): void
    {
        $other = $this->createOwner('backfill@example.test');
        self::assertSame(6, $this->planning->backfillDefaultAreas());
        self::assertSame(0, $this->planning->backfillDefaultAreas());
        self::assertSame(3, count($this->planning->list('area', $this->owner)));
        self::assertSame(3, count($this->planning->list('area', $other)));

        $this->planning->update('area', $this->owner, $this->planning->list('area', $this->owner)[0]['id'], [
            'base_version' => 1, 'name' => 'Customized',
        ]);
        self::assertSame(0, $this->planning->backfillDefaultAreas());
        self::assertSame('Customized', $this->planning->list('area', $this->owner)[0]['name']);
    }

    /** @return array<string, mixed> */
    private function goal(?string $areaId, ?string $parentId, string $name): array
    {
        return $this->planning->create('goal', $this->owner, [
            'area_id' => $areaId,
            'parent_goal_id' => $parentId,
            'name' => $name,
        ]);
    }

    private function createOwner(string $email): int
    {
        $account = new PdoAccountRepository($this->pdo);

        return $account->insertUser(
            $email,
            'Planning Owner',
            password_hash('correct horse battery staple', PASSWORD_BCRYPT),
            '2026-09-17 12:00:00.000000',
        )->id;
    }

    private function wipeTargetDatabase(): void
    {
        $tables = $this->pdo->query(
            "SELECT table_name FROM information_schema.tables WHERE table_schema = 'goals_test' AND table_type = 'BASE TABLE'",
        )->fetchAll(PDO::FETCH_COLUMN);
        $this->pdo->exec('SET FOREIGN_KEY_CHECKS = 0');

        try {
            foreach ($tables as $table) {
                if (!is_string($table) || preg_match('/^[a-z0-9_]+$/', $table) !== 1) {
                    throw new RuntimeException('Unsafe test table name.');
                }

                $this->pdo->exec("DROP TABLE `$table`");
            }
        } finally {
            $this->pdo->exec('SET FOREIGN_KEY_CHECKS = 1');
        }
    }
}
