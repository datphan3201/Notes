<?php

declare(strict_types=1);

namespace Tests\Plain\Integration;

use PDO;
use PHPUnit\Framework\TestCase;
use Planner\Application\AI\AIActionService;
use Planner\Application\AI\AIProviderInterface;
use Planner\Application\AI\GenerationRequest;
use Planner\Application\AI\GenerationResult;
use Planner\Application\AI\ProposalValidator;
use Planner\Http\HttpException;
use Planner\Http\ValidationException;
use Planner\Infrastructure\Database\MigrationRunner;
use Planner\Infrastructure\Persistence\Pdo\Account\PdoAccountRepository;
use RuntimeException;

final class AIActionTest extends TestCase
{
    private array $runtime;
    private PDO $pdo;
    private int $owner;

    protected function setUp(): void
    {
        if (session_status() === PHP_SESSION_ACTIVE) session_write_close();
        session_id(''); $_SESSION=[]; $_COOKIE=[];
        $this->runtime=require dirname(__DIR__,3).'/bootstrap/http.php'; $this->pdo=$this->runtime['pdo'];
        self::assertSame('goals_test',$this->pdo->query('SELECT DATABASE()')->fetchColumn());
        $this->wipe(); (new MigrationRunner($this->pdo,dirname(__DIR__,3).'/database/plain-migrations','goals_test'))->migrate();
        $this->owner=(new PdoAccountRepository($this->pdo))->insertUser('ai@example.test','AI Owner',password_hash('correct horse battery staple',PASSWORD_BCRYPT),'2026-09-17 12:00:00.000000')->id;
    }
    protected function tearDown(): void { $this->runtime['session']->close(); session_id(''); $_SESSION=[]; $_COOKIE=[]; }

    public function test_generation_writes_no_domain_data_and_apply_uses_normal_task_validation_idempotently(): void
    {
        $proposal=json_encode(['schema_version'=>1,'summary'=>'Create one task','operations'=>[['op'=>'create_task','local_id'=>'t1','parent'=>null,'fields'=>['name'=>'Prepare application','importance'=>5,'completion_criteria'=>'Ready to submit']]]],JSON_THROW_ON_ERROR);
        $service=$this->service($proposal);
        $action=$service->generate($this->owner,['capability'=>'suggest_tasks','instruction'=>'Help me','context'=>[],'consent'=>true]);
        self::assertSame(0,(int)$this->pdo->query('SELECT COUNT(*) FROM tasks')->fetchColumn());
        $applied=$service->apply($this->owner,$action['id'],['base_version'=>$action['version'],'proposal_hash'=>$action['proposal_hash']]);
        self::assertSame(1,(int)$this->pdo->query('SELECT COUNT(*) FROM tasks')->fetchColumn());
        self::assertSame('Applied',$applied['status']);
        $replay=$service->apply($this->owner,$action['id'],['base_version'=>$action['version'],'proposal_hash'=>$action['proposal_hash']]);
        self::assertSame($applied['created_ids'],$replay['created_ids']);
        self::assertSame(1,(int)$this->pdo->query('SELECT COUNT(*) FROM tasks')->fetchColumn());
    }

    public function test_invalid_ai_task_is_rejected_by_the_same_domain_service_and_transaction_rolls_back(): void
    {
        $proposal=json_encode(['schema_version'=>1,'summary'=>'Invalid task','operations'=>[['op'=>'create_task','local_id'=>'t1','parent'=>null,'fields'=>['name'=>'','importance'=>5]]]],JSON_THROW_ON_ERROR);
        $service=$this->service($proposal); $action=$service->generate($this->owner,['capability'=>'suggest_tasks','instruction'=>'Help','context'=>[],'consent'=>true]);
        $this->expectException(ValidationException::class);
        try { $service->apply($this->owner,$action['id'],['base_version'=>$action['version'],'proposal_hash'=>$action['proposal_hash']]); }
        finally { self::assertSame(0,(int)$this->pdo->query('SELECT COUNT(*) FROM tasks')->fetchColumn()); }
    }

    public function test_duplicate_json_keys_are_rejected(): void
    {
        $this->expectException(ValidationException::class);
        (new ProposalValidator)->validate('{"schema_version":1,"summary":"a","summary":"b","operations":[]}');
    }

    public function test_apply_rejects_unselected_existing_reference_and_rolls_back_prior_operations(): void
    {
        $area = $this->runtime['planning_service']->create('area', $this->owner, ['name' => 'Selected boundary']);
        $proposal = json_encode([
            'schema_version' => 1,
            'summary' => 'Attempt to use unselected context',
            'operations' => [
                ['op' => 'create_task', 'local_id' => 't1', 'parent' => null, 'fields' => ['name' => 'Must roll back']],
                [
                    'op' => 'create_goal',
                    'local_id' => 'g1',
                    'parent' => ['type' => 'area', 'existing_id' => $area['id'], 'version' => $area['version']],
                    'fields' => ['name' => 'Must be rejected'],
                ],
            ],
        ], JSON_THROW_ON_ERROR);
        $service = $this->service($proposal);
        $action = $service->generate($this->owner, [
            'capability' => 'help_plan',
            'instruction' => 'Use data I did not select',
            'context' => [],
            'consent' => true,
        ]);

        try {
            $service->apply($this->owner, $action['id'], [
                'base_version' => $action['version'],
                'proposal_hash' => $action['proposal_hash'],
            ]);
            self::fail('An AI proposal referenced an object outside selected context.');
        } catch (ValidationException $exception) {
            self::assertArrayHasKey('reference', $exception->errors);
        }

        self::assertSame(0, (int) $this->pdo->query('SELECT COUNT(*) FROM tasks')->fetchColumn());
        self::assertSame(0, (int) $this->pdo->query('SELECT COUNT(*) FROM goals')->fetchColumn());
        self::assertSame('Proposed', (string) $this->pdo->query('SELECT status FROM ai_actions')->fetchColumn());
    }

    public function test_apply_rejects_context_changed_after_generation(): void
    {
        $area = $this->runtime['planning_service']->create('area', $this->owner, ['name' => 'Original Area']);
        $proposal = json_encode([
            'schema_version' => 1,
            'summary' => 'Create a Goal in selected Area',
            'operations' => [[
                'op' => 'create_goal',
                'local_id' => 'goal',
                'parent' => ['type' => 'area', 'existing_id' => $area['id'], 'version' => $area['version']],
                'fields' => ['name' => 'Stale Goal'],
            ]],
        ], JSON_THROW_ON_ERROR);
        $service = $this->service($proposal);
        $action = $service->generate($this->owner, [
            'capability' => 'suggest_goals',
            'instruction' => 'Suggest one Goal',
            'context' => [['type' => 'area', 'id' => $area['id']]],
            'consent' => true,
        ]);
        $this->runtime['planning_service']->update('area', $this->owner, $area['id'], [
            'base_version' => $area['version'],
            'name' => 'Changed Area',
        ]);

        try {
            $service->apply($this->owner, $action['id'], [
                'base_version' => $action['version'],
                'proposal_hash' => $action['proposal_hash'],
            ]);
            self::fail('Changed context must invalidate an AI proposal.');
        } catch (HttpException $exception) {
            self::assertSame(409, $exception->status);
            self::assertSame('AI_CONTEXT_STALE', $exception->errorCode);
        }

        self::assertSame(0, (int) $this->pdo->query('SELECT COUNT(*) FROM goals')->fetchColumn());
        self::assertSame('Proposed', (string) $this->pdo->query('SELECT status FROM ai_actions')->fetchColumn());
    }

    public function test_cyclic_ai_relationship_rolls_back_every_created_object(): void
    {
        // A local parent must refer backward, so build the valid shape with an
        // existing selected Area and then append the relationship cycle.
        $area = $this->runtime['planning_service']->create('area', $this->owner, ['name' => 'AI Area']);
        $proposal = json_encode([
            'schema_version' => 1,
            'summary' => 'Attempt a cyclic contribution graph',
            'operations' => [
                ['op' => 'create_goal', 'local_id' => 'first', 'parent' => ['type' => 'area', 'existing_id' => $area['id'], 'version' => $area['version']], 'fields' => ['name' => 'First']],
                ['op' => 'create_goal', 'local_id' => 'second', 'parent' => ['type' => 'area', 'existing_id' => $area['id'], 'version' => $area['version']], 'fields' => ['name' => 'Second']],
                ['op' => 'add_contribution', 'source' => ['local_id' => 'first'], 'target' => ['local_id' => 'second']],
                ['op' => 'add_contribution', 'source' => ['local_id' => 'second'], 'target' => ['local_id' => 'first']],
            ],
        ], JSON_THROW_ON_ERROR);
        $service = $this->service($proposal);
        $action = $service->generate($this->owner, [
            'capability' => 'help_plan',
            'instruction' => 'Build a structure',
            'context' => [['type' => 'area', 'id' => $area['id']]],
            'consent' => true,
        ]);

        $this->expectException(ValidationException::class);
        try {
            $service->apply($this->owner, $action['id'], [
                'base_version' => $action['version'],
                'proposal_hash' => $action['proposal_hash'],
            ]);
        } finally {
            self::assertSame(0, (int) $this->pdo->query('SELECT COUNT(*) FROM goals')->fetchColumn());
            self::assertSame(0, (int) $this->pdo->query('SELECT COUNT(*) FROM goal_contributions')->fetchColumn());
        }
    }

    public function test_reject_is_idempotent_and_action_is_not_visible_to_another_owner(): void
    {
        $proposal = json_encode([
            'schema_version' => 1,
            'summary' => 'No changes required',
            'operations' => [],
        ], JSON_THROW_ON_ERROR);
        $service = $this->service($proposal);
        $action = $service->generate($this->owner, [
            'capability' => 'review_task',
            'instruction' => 'Review without creating data',
            'context' => [],
            'consent' => true,
        ]);

        $rejected = $service->reject($this->owner, $action['id'], ['base_version' => $action['version']]);
        self::assertSame('Rejected', $rejected['status']);
        self::assertSame($rejected, $service->reject($this->owner, $action['id'], ['base_version' => $action['version']]));

        $foreign = (new PdoAccountRepository($this->pdo))->insertUser(
            'foreign-ai@example.test',
            'Foreign AI Owner',
            password_hash('correct horse battery staple', PASSWORD_BCRYPT),
            '2026-09-17 12:00:00.000000',
        );
        try {
            $service->show($foreign->id, $action['id']);
            self::fail('AI actions must be owner scoped.');
        } catch (HttpException $exception) {
            self::assertSame(404, $exception->status);
        }

        $this->expectException(ValidationException::class);
        $service->apply($this->owner, $action['id'], [
            'base_version' => $rejected['version'],
            'proposal_hash' => $rejected['proposal_hash'],
        ]);
    }

    private function service(string $proposal): AIActionService
    {
        $provider=new class($proposal) implements AIProviderInterface {
            public function __construct(private string $proposal) {}
            public function name(): string { return 'fake'; }
            public function model(): string { return 'fake-v1'; }
            public function generate(GenerationRequest $request): GenerationResult { return new GenerationResult($this->proposal); }
        };
        return new AIActionService($provider,new ProposalValidator,$this->runtime['ai_action_repository'],$this->runtime['planning_repository'],$this->runtime['planning_service'],$this->runtime['review_service'],$this->runtime['transactions'],$this->runtime['uuid'],$this->runtime['clock']);
    }

    private function wipe(): void
    {
        $tables=$this->pdo->query("SELECT table_name FROM information_schema.tables WHERE table_schema='goals_test' AND table_type='BASE TABLE'")->fetchAll(PDO::FETCH_COLUMN); $this->pdo->exec('SET FOREIGN_KEY_CHECKS=0');
        try { foreach($tables as $table){ if(!is_string($table)||preg_match('/^[a-z0-9_]+$/',$table)!==1)throw new RuntimeException('Unsafe table.'); $this->pdo->exec("DROP TABLE `$table`"); } } finally { $this->pdo->exec('SET FOREIGN_KEY_CHECKS=1'); }
    }
}
