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

    public function test_strategy_notes_are_versioned_without_affecting_progress_or_activity(): void
    {
        $area = $this->planning->create('area', $this->owner, ['name' => 'Learning']);
        $goal = $this->goal($area['id'], null, 'AI production engineer');
        $updated = $this->planning->update('goal', $this->owner, $goal['id'], [
            'base_version' => 1, 'strategy_notes' => "Diagnostic → Build → Debug\n70% build, 25% theory, 5% experiment",
        ]);
        self::assertSame(2, $updated['version']);
        self::assertSame(0.0, $this->planning->show('goal', $this->owner, $goal['id'])['progress']);
        self::assertSame(0, (int) $this->pdo->query('SELECT COUNT(*) FROM activities')->fetchColumn());
        self::assertSame(2, $this->planning->update('goal', $this->owner, $goal['id'], ['base_version' => 1, 'strategy_notes' => $updated['strategy_notes']])['version']);
        try {
            $this->planning->update('goal', $this->owner, $goal['id'], ['base_version' => 1, 'strategy_notes' => 'Different']);
            self::fail('Stale different strategy must conflict.');
        } catch (HttpException $exception) {
            self::assertSame(409, $exception->status);
        }
        $unicode = $this->planning->update('goal', $this->owner, $goal['id'], ['base_version' => 2, 'strategy_notes' => str_repeat('🌱', 20_000)]);
        self::assertSame(20_000, mb_strlen($unicode['strategy_notes']));
        $this->expectException(ValidationException::class);
        $this->planning->update('goal', $this->owner, $goal['id'], ['base_version' => 3, 'strategy_notes' => str_repeat('x', 20_001)]);
    }

    public function test_roadmap_groups_only_owned_active_work_and_excludes_occurrences_from_finite_progress(): void
    {
        $area = $this->planning->create('area', $this->owner, ['name' => 'Learning']);
        $goal = $this->goal($area['id'], null, 'Roadmap');
        $otherGoal = $this->goal($area['id'], null, 'Unrelated');
        $first = $this->planning->create('milestone', $this->owner, ['goal_id' => $goal['id'], 'name' => 'Foundation']);
        $second = $this->planning->create('milestone', $this->owner, ['goal_id' => $goal['id'], 'name' => 'ML core']);
        $this->planning->addDependency($this->owner, $second['id'], ['base_version' => 1, 'prerequisite_id' => $first['id']]);
        $task = $this->planning->create('task', $this->owner, ['milestone_id' => $first['id'], 'name' => 'Build service']);
        $this->planning->transition('task', $this->owner, $task['id'], 'complete', ['base_version' => 1]);
        $series = $this->runtime['task_series_service']->create($this->owner, [
            'milestone_id' => $first['id'], 'name' => 'Practice', 'frequency' => 'daily',
            'start_date' => $this->runtime['clock']->now()->format('Y-m-d'),
            'end_date' => $this->runtime['clock']->now()->format('Y-m-d'), 'timezone' => 'UTC',
        ]);
        self::assertSame(1, $this->runtime['task_series_service']->materialize()['created']);
        $direct = $this->planning->create('task', $this->owner, ['goal_id' => $goal['id'], 'name' => 'Direct']);
        $archived = $this->planning->create('task', $this->owner, ['milestone_id' => $first['id'], 'name' => 'Archived']);
        $this->planning->archive('task', $this->owner, $archived['id'], ['base_version' => 1]);
        $this->planning->create('task', $this->owner, ['goal_id' => $otherGoal['id'], 'name' => 'Unrelated task']);
        $map = $this->planning->roadmap($this->owner, $goal['id']);
        $byName = array_column($map['milestones'], null, 'name');
        self::assertSame([$task['id']], array_column($byName['Foundation']['tasks'], 'id'));
        self::assertCount(1, $byName['Foundation']['recurring_tasks']);
        self::assertSame($series['id'], $byName['Foundation']['recurring_tasks'][0]['series_id']);
        self::assertSame(100.0, $byName['Foundation']['progress']['percentage']);
        self::assertTrue($byName['ML core']['completion_locked']);
        self::assertSame([$direct['id']], array_column($map['direct_tasks'], 'id'));
        $foreign = $this->createOwner('roadmap-foreign@example.test');
        $this->expectException(HttpException::class);
        $this->expectExceptionMessage('The requested resource was not found.');
        $this->planning->roadmap($foreign, $goal['id']);
    }

    public function test_finite_reopen_requires_confirmation_and_reopens_ancestors_atomically(): void
    {
        $area = $this->planning->create('area', $this->owner, ['name' => 'Learning']);
        $root = $this->goal($area['id'], null, 'Root');
        $leaf = $this->goal(null, $root['id'], 'Leaf');
        $milestone = $this->planning->create('milestone', $this->owner, ['goal_id' => $leaf['id'], 'name' => 'Checkpoint']);
        $task = $this->planning->create('task', $this->owner, ['milestone_id' => $milestone['id'], 'name' => 'Work']);
        $task = $this->planning->transition('task', $this->owner, $task['id'], 'complete', ['base_version' => 1]);
        $milestone = $this->planning->transition('milestone', $this->owner, $milestone['id'], 'complete', ['base_version' => 1]);
        $leaf = $this->planning->transition('goal', $this->owner, $leaf['id'], 'complete', ['base_version' => 1]);
        $root = $this->planning->transition('goal', $this->owner, $root['id'], 'complete', ['base_version' => 1]);
        try {
            $this->planning->transition('task', $this->owner, $task['id'], 'reopen', ['base_version' => $task['version']]);
            self::fail('Ancestor reopen requires confirmation.');
        } catch (HttpException $exception) {
            self::assertSame('ANCESTOR_REOPEN_REQUIRED', $exception->errorCode);
            self::assertSame([$leaf['id'], $root['id']], array_column($exception->payload['ancestors'], 'id'));
        }
        self::assertSame('Done', $this->planning->show('task', $this->owner, $task['id'])['status']);
        $task = $this->planning->transition('task', $this->owner, $task['id'], 'reopen', ['base_version' => $task['version'], 'acknowledge_ancestor_reopen' => true]);
        self::assertSame('InProgress', $task['status']);
        self::assertSame('Active', $this->planning->show('goal', $this->owner, $root['id'])['status']);
        self::assertSame(3, $this->planning->show('goal', $this->owner, $leaf['id'])['version']);
        self::assertSame('Completed', $this->planning->show('milestone', $this->owner, $milestone['id'])['status']);
        self::assertSame(2, (int) $this->pdo->query("SELECT COUNT(*) FROM activities WHERE source_type = 'goal' AND action = 'reversed' AND reversal_of_id IS NOT NULL")->fetchColumn());
        self::assertSame($task['version'], $this->planning->transition('task', $this->owner, $task['id'], 'reopen', ['base_version' => 1])['version']);
    }

    public function test_failed_milestone_reopen_does_not_partially_reopen_completed_goals(): void
    {
        $area = $this->planning->create('area', $this->owner, ['name' => 'Learning']);
        $goal = $this->goal($area['id'], null, 'Goal');
        $first = $this->planning->create('milestone', $this->owner, ['goal_id' => $goal['id'], 'name' => 'First']);
        $second = $this->planning->create('milestone', $this->owner, ['goal_id' => $goal['id'], 'name' => 'Second']);
        $second = $this->planning->addDependency($this->owner, $second['id'], ['base_version' => 1, 'prerequisite_id' => $first['id']]);
        $first = $this->planning->transition('milestone', $this->owner, $first['id'], 'complete', ['base_version' => 1]);
        $this->planning->transition('milestone', $this->owner, $second['id'], 'complete', ['base_version' => $second['version']]);
        $this->planning->transition('goal', $this->owner, $goal['id'], 'complete', ['base_version' => 1]);
        try {
            $this->planning->transition('milestone', $this->owner, $first['id'], 'reopen', ['base_version' => $first['version'], 'acknowledge_ancestor_reopen' => true]);
            self::fail('Completed dependent must prevent reopening its prerequisite.');
        } catch (ValidationException) {
            self::assertSame('Completed', $this->planning->show('goal', $this->owner, $goal['id'])['status']);
            self::assertSame(2, $this->planning->show('goal', $this->owner, $goal['id'])['version']);
            self::assertSame(0, (int) $this->pdo->query("SELECT COUNT(*) FROM activities WHERE action = 'reversed'")->fetchColumn());
        }
    }

    public function test_recurring_work_does_not_prevent_leaf_goal_completion_or_reopen_it(): void
    {
        $area = $this->planning->create('area', $this->owner, ['name' => 'Learning']);
        $goal = $this->goal($area['id'], null, 'Goal');
        $today = $this->runtime['clock']->now()->format('Y-m-d');
        $this->runtime['task_series_service']->create($this->owner, ['goal_id' => $goal['id'], 'name' => 'Practice', 'frequency' => 'daily', 'start_date' => $today, 'end_date' => $today, 'timezone' => 'UTC']);
        self::assertSame(1, $this->runtime['task_series_service']->materialize()['created']);
        $goal = $this->planning->transition('goal', $this->owner, $goal['id'], 'complete', ['base_version' => 1]);
        $task = $this->planning->list('task', $this->owner)[0];
        $task = $this->planning->transition('task', $this->owner, $task['id'], 'complete', ['base_version' => 1]);
        $this->planning->transition('task', $this->owner, $task['id'], 'reopen', ['base_version' => $task['version']]);
        self::assertSame('Completed', $this->planning->show('goal', $this->owner, $goal['id'])['status']);
        self::assertSame($goal['version'], $this->planning->show('goal', $this->owner, $goal['id'])['version']);
    }

    public function test_completed_goal_rejects_new_or_moved_work_but_allows_strategy_edits(): void
    {
        $area = $this->planning->create('area', $this->owner, ['name' => 'Learning']);
        $goal = $this->goal($area['id'], null, 'Completed');
        $milestone = $this->planning->create('milestone', $this->owner, ['goal_id' => $goal['id'], 'name' => 'Checkpoint']);
        $this->planning->transition('milestone', $this->owner, $milestone['id'], 'complete', ['base_version' => 1]);
        $this->planning->transition('goal', $this->owner, $goal['id'], 'complete', ['base_version' => 1]);
        foreach (['task', 'milestone', 'goal'] as $type) {
            $parent = $type === 'goal' ? ['parent_goal_id' => $goal['id']] : ['goal_id' => $goal['id']];
            try {
                $this->planning->create($type, $this->owner, ['name' => 'New', ...$parent]);
                self::fail('Completed Goal must reject new finite children.');
            } catch (ValidationException $exception) {
                self::assertArrayHasKey('parent', $exception->errors);
            }
        }
        $inbox = $this->planning->create('task', $this->owner, ['name' => 'Inbox']);
        try {
            $this->planning->update('task', $this->owner, $inbox['id'], ['base_version' => 1, 'milestone_id' => $milestone['id']]);
            self::fail('A move cannot bypass a completed Goal ancestor.');
        } catch (ValidationException) {
            self::assertNull($this->planning->show('task', $this->owner, $inbox['id'])['milestone_id']);
        }
        self::assertSame('Keep practicing', $this->planning->update('goal', $this->owner, $goal['id'], ['base_version' => 2, 'strategy_notes' => 'Keep practicing'])['strategy_notes']);
    }

    public function test_empty_planning_objects_and_checklist_can_be_archived_with_native_prepares(): void
    {
        $area = $this->planning->create('area', $this->owner, ['name' => 'Learning']);
        $goal = $this->goal($area['id'], null, 'Goal');
        $milestone = $this->planning->create('milestone', $this->owner, ['goal_id' => $goal['id'], 'name' => 'Milestone']);
        $task = $this->planning->create('task', $this->owner, ['milestone_id' => $milestone['id'], 'name' => 'Task']);
        $item = $this->planning->createChecklist($this->owner, $task['id'], ['title' => 'Item']);
        self::assertNotNull($this->planning->archiveChecklist($this->owner, $task['id'], $item['id'], ['base_version' => 1])['deleted_at']);
        foreach ([['task', $task], ['milestone', $milestone], ['goal', $goal]] as [$type, $row]) {
            self::assertNotNull($this->planning->archive($type, $this->owner, $row['id'], ['base_version' => 1])['archived_at']);
        }
        $this->planning->create('area', $this->owner, ['name' => 'Remaining']);
        self::assertNotNull($this->planning->archive('area', $this->owner, $area['id'], ['base_version' => 1])['archived_at']);
    }

    /** @return array<string, mixed> */
    public function test_estimates_are_optional_versioned_and_do_not_change_completion_facts(): void
    {
        $task = $this->planning->create('task', $this->owner, ['name'=>'Estimate', 'estimated_minutes'=>45]);
        self::assertSame(45, $task['estimated_minutes']);
        foreach ([0,1441,'30',1.5] as $invalid) {
            try { $this->planning->update('task', $this->owner, $task['id'], ['base_version'=>$task['version'], 'estimated_minutes'=>$invalid]); self::fail('Invalid estimate must be rejected.'); }
            catch (ValidationException $error) { self::assertArrayHasKey('estimated_minutes', $error->errors); }
        }
        $updated=$this->planning->update('task', $this->owner, $task['id'], ['base_version'=>$task['version'], 'estimated_minutes'=>null]);
        self::assertNull($updated['estimated_minutes']);
        self::assertSame(2,$updated['version']);
        self::assertSame('NotStarted',$updated['status']);
        self::assertSame(0,(int)$this->pdo->query('SELECT COUNT(*) FROM activities')->fetchColumn());
        try { $this->planning->update('task',$this->owner,$task['id'],['base_version'=>1,'estimated_minutes'=>60]); self::fail('Stale estimate must conflict.'); }
        catch (HttpException $error) { self::assertSame(409,$error->status); }
    }

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
