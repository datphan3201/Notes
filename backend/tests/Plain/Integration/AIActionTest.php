<?php

declare(strict_types=1);

namespace Tests\Plain\Integration;

use PDO;
use PHPUnit\Framework\TestCase;
use Planner\Application\AI\AIActionService;
use Planner\Application\AI\AIChatService;
use Planner\Application\AI\AIProviderInterface;
use Planner\Application\AI\GenerationRequest;
use Planner\Application\AI\GenerationResult;
use Planner\Application\AI\ProposalValidator;
use Planner\Application\Notes\NoteValidator;
use Planner\Http\Validation\InputValidator;
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
        session_id('');
        $_SESSION=[];
        $_COOKIE=[];
        $this->runtime=require dirname(__DIR__,3).'/bootstrap/http.php';
        $this->pdo=$this->runtime['pdo'];
        self::assertSame('goals_test',$this->pdo->query('SELECT DATABASE()')->fetchColumn());
        $this->wipe();
        (new MigrationRunner($this->pdo,dirname(__DIR__,3).'/database/plain-migrations','goals_test'))->migrate();
        $this->owner=(new PdoAccountRepository($this->pdo))->insertUser('ai@example.test','AI Owner',password_hash('correct horse battery staple',PASSWORD_BCRYPT),'2026-09-17 12:00:00.000000')->id;
    }
    protected function tearDown(): void
    {
        $this->runtime['session']->close();
        session_id('');
        $_SESSION=[];
        $_COOKIE=[];
    }

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
        $service=$this->service($proposal);
        $action=$service->generate($this->owner,['capability'=>'suggest_tasks','instruction'=>'Help','context'=>[],'consent'=>true]);
        $this->expectException(ValidationException::class);
        try {
            $service->apply($this->owner,$action['id'],['base_version'=>$action['version'],'proposal_hash'=>$action['proposal_hash']]);
        } finally {
            self::assertSame(0,(int)$this->pdo->query('SELECT COUNT(*) FROM tasks')->fetchColumn());
        }
    }

    public function test_chat_task_request_creates_nothing_until_the_proposal_is_applied(): void
    {
        $provider=$this->scriptedProvider([
            fn (): array => $this->step('', [['name'=>'create_tasks','args'=>['tasks'=>[
                ['name'=>'Learn 20 words','importance'=>4,'deadline'=>'2999-01-01'],
                ['name'=>'Listen to a podcast','deadline'=>'2000-01-01','importance'=>9,'extra'=>'ignored'],
                ['name'=>'   '],
            ]]]]),
            fn (): array => $this->step('Prepared for confirmation.'),
        ]);
        $actions=$this->actionService($provider);
        $chat=$this->chatService($provider,$actions);

        $reply=$chat->ask($this->owner,'Create those tasks',[['role'=>'assistant','text'=>'Try learning words and a podcast.']]);

        self::assertSame('Prepared for confirmation.',$reply['answer']);
        self::assertSame(0,(int)$this->pdo->query('SELECT COUNT(*) FROM tasks')->fetchColumn());
        $operations=$reply['proposal']['proposal']['operations'];
        self::assertCount(2,$operations);
        self::assertSame(['name'=>'Listen to a podcast'],$operations[1]['fields']);
        $actions->apply($this->owner,$reply['proposal']['id'],['base_version'=>$reply['proposal']['version'],'proposal_hash'=>$reply['proposal']['proposal_hash']]);
        self::assertSame(2,(int)$this->pdo->query('SELECT COUNT(*) FROM tasks')->fetchColumn());
    }

    public function test_chat_agent_reads_then_queues_task_and_note_changes_applied_only_on_confirmation(): void
    {
        $task=$this->runtime['planning_service']->create('task',$this->owner,['name'=>'Write report','description'=>'Draft']);
        $done=$this->runtime['planning_service']->create('task',$this->owner,['name'=>'Old chore']);
        $note=$this->runtime['note_service']->create($this->owner,['id'=>$this->runtime['uuid']->generate(),'title'=>'Ideas','content'=>'one'])['note'];
        $old=$this->runtime['note_service']->create($this->owner,['id'=>$this->runtime['uuid']->generate(),'title'=>'Scratch','content'=>'x'])['note'];
        $provider=$this->scriptedProvider([
            fn (): array => $this->step('', [['name'=>'search_tasks','args'=>['query'=>'report']],['name'=>'get_note','args'=>['id'=>$note->id]]]),
            function (array $contents) use ($task,$done,$note,$old): array {
                // The read results reached the model before it queued changes.
                $responses=json_encode(end($contents),JSON_THROW_ON_ERROR);
                self::assertStringContainsString('Write report',$responses);
                self::assertStringContainsString('one',$responses);
                return $this->step('', [
                    ['name'=>'update_task','args'=>['id'=>$task['id'],'append_description'=>'Add charts','importance'=>5]],
                    ['name'=>'complete_task','args'=>['id'=>$done['id']]],
                    ['name'=>'update_note','args'=>['id'=>$note->id,'append_content'=>'two']],
                    ['name'=>'delete_note','args'=>['id'=>$old->id]],
                    ['name'=>'get_task','args'=>['id'=>'00000000-0000-0000-0000-000000000000']],
                ]);
            },
            fn (): array => $this->step('Queued 4 changes for your confirmation.'),
        ]);
        $actions=$this->actionService($provider);

        $reply=$this->chatService($provider,$actions)->ask($this->owner,'Update my report task, finish the chore, add to Ideas and delete Scratch');

        self::assertCount(4,$reply['preview']);
        self::assertContains(['field'=>'description','from'=>'Draft','to'=>"Draft\nAdd charts"],$reply['preview'][0]['changes']);
        self::assertSame('Draft',$this->runtime['planning_service']->show('task',$this->owner,$task['id'])['description']);
        self::assertSame('one',$this->runtime['note_service']->show($this->owner,$note->id)->content);

        $actions->apply($this->owner,$reply['proposal']['id'],['base_version'=>$reply['proposal']['version'],'proposal_hash'=>$reply['proposal']['proposal_hash']]);

        $updated=$this->runtime['planning_service']->show('task',$this->owner,$task['id']);
        self::assertSame("Draft\nAdd charts",$updated['description']);
        self::assertSame(5,(int)$updated['importance']);
        self::assertSame('Done',$this->runtime['planning_service']->show('task',$this->owner,$done['id'])['status']);
        self::assertSame("one\ntwo",$this->runtime['note_service']->show($this->owner,$note->id)->content);
        self::assertNotNull($this->pdo->query("SELECT deleted_at FROM notes WHERE id = '{$old->id}'")->fetchColumn());
    }

    public function test_chat_agent_queues_goal_and_habit_changes_applied_only_on_confirmation(): void
    {
        $planning=$this->runtime['planning_service'];
        $habits=$this->runtime['habit_service'];
        $area=$planning->create('area',$this->owner,['name'=>'Study']);
        $goal=$planning->create('goal',$this->owner,['name'=>'Pass IELTS','area_id'=>$area['id']]);
        $run=$habits->create($this->owner,['name'=>'Run','timezone'=>'UTC']);
        $old=$habits->create($this->owner,['name'=>'Old habit','timezone'=>'UTC']);
        $provider=$this->scriptedProvider([
            fn (): array => $this->step('', [
                ['name'=>'create_goal','args'=>['name'=>'Speak fluently','area_id'=>$area['id']]],
                ['name'=>'create_goal','args'=>['name'=>'No location']],
                ['name'=>'create_tasks','args'=>['tasks'=>[['name'=>'Vocabulary','goal_id'=>$goal['id']]]]],
                ['name'=>'create_habit','args'=>['name'=>'Read','period'=>'weekly','target_frequency'=>3,'goal_id'=>$goal['id']]],
                ['name'=>'update_goal','args'=>['id'=>$goal['id'],'importance'=>5]],
                ['name'=>'check_in_habit','args'=>['id'=>$run['id']]],
                ['name'=>'check_in_habit','args'=>['id'=>$run['id'],'date'=>'2999-01-01']],
                ['name'=>'delete_habit','args'=>['id'=>$old['id']]],
            ]),
            function (array $contents): array {
                // Invalid requests come back to the model as errors instead of being queued.
                self::assertSame(2,substr_count(json_encode(end($contents),JSON_THROW_ON_ERROR),'"error"'));
                return $this->step('Prepared 6 changes.');
            },
        ]);
        $actions=$this->actionService($provider);

        $reply=$this->chatService($provider,$actions)->ask($this->owner,'Plan my IELTS goal and habits');

        self::assertCount(6,$reply['preview']);
        self::assertSame(1,(int)$this->pdo->query('SELECT COUNT(*) FROM goals')->fetchColumn());
        self::assertSame(0,(int)$this->pdo->query('SELECT COUNT(*) FROM habit_check_ins')->fetchColumn());

        $actions->apply($this->owner,$reply['proposal']['id'],['base_version'=>$reply['proposal']['version'],'proposal_hash'=>$reply['proposal']['proposal_hash']]);

        self::assertSame($area['id'],$this->pdo->query("SELECT area_id FROM goals WHERE name = 'Speak fluently'")->fetchColumn());
        self::assertSame($goal['id'],$this->pdo->query("SELECT goal_id FROM tasks WHERE name = 'Vocabulary'")->fetchColumn());
        self::assertSame([$goal['id'],'weekly',3],array_values(array_map(static fn ($v) => is_numeric($v) ? (int) $v : $v,$this->pdo->query("SELECT primary_goal_id, period, target_frequency FROM habits WHERE name = 'Read'")->fetch(PDO::FETCH_ASSOC))));
        self::assertSame(5,(int)$planning->show('goal',$this->owner,$goal['id'])['importance']);
        self::assertSame(1,(int)$this->pdo->query("SELECT COUNT(*) FROM habit_check_ins WHERE habit_id = '{$run['id']}'")->fetchColumn());
        self::assertNotNull($this->pdo->query("SELECT archived_at FROM habits WHERE id = '{$old['id']}'")->fetchColumn());
    }

    public function test_chat_change_is_rejected_when_the_object_changed_after_the_proposal(): void
    {
        $task=$this->runtime['planning_service']->create('task',$this->owner,['name'=>'Write report']);
        $provider=$this->scriptedProvider([
            fn (): array => $this->step('', [['name'=>'delete_task','args'=>['id'=>$task['id']]]]),
            fn (): array => $this->step('Confirm to delete.'),
        ]);
        $actions=$this->actionService($provider);
        $reply=$this->chatService($provider,$actions)->ask($this->owner,'Delete the report task');
        $this->runtime['planning_service']->update('task',$this->owner,$task['id'],['name'=>'Write final report','base_version'=>$task['version']]);

        try {
            $actions->apply($this->owner,$reply['proposal']['id'],['base_version'=>$reply['proposal']['version'],'proposal_hash'=>$reply['proposal']['proposal_hash']]);
            self::fail('A stale proposal must not be applied.');
        } catch (HttpException $error) {
            self::assertSame(409,$error->status);
        }
        self::assertSame(0,(int)$this->pdo->query("SELECT COUNT(*) FROM tasks WHERE archived_at IS NOT NULL")->fetchColumn());
    }

    /** @param list<callable(array):array> $steps */
    private function scriptedProvider(array $steps): AIProviderInterface
    {
        return new class($steps) implements AIProviderInterface {
            public function __construct(private array $steps)
            {
            }
            public function name(): string
            {
                return 'fake';
            }
            public function model(): string
            {
                return 'fake-v1';
            }
            public function generate(GenerationRequest $request): GenerationResult
            {
                throw new RuntimeException('Chat must not use free-form generation.');
            }
            public function chat(string $system, array $contents, array $tools): array
            {
                return (array_shift($this->steps) ?? throw new RuntimeException('Unexpected model call.'))($contents);
            }
        };
    }

    /** @param list<array{name:string,args:array<string,mixed>}> $calls */
    private function step(string $text, array $calls = []): array
    {
        return ['content'=>['role'=>'model','parts'=>array_map(static fn (array $call): array => ['functionCall'=>$call],$calls)],'text'=>$text,'calls'=>$calls];
    }

    private function actionService(AIProviderInterface $provider): AIActionService
    {
        return new AIActionService($provider,new ProposalValidator,$this->runtime['ai_action_repository'],$this->runtime['planning_repository'],$this->runtime['planning_service'],$this->runtime['review_service'],$this->runtime['transactions'],$this->runtime['uuid'],$this->runtime['clock'],$this->runtime['note_service'],new NoteValidator(new InputValidator),$this->runtime['file_cleanup'],$this->runtime['habit_service']);
    }

    private function chatService(AIProviderInterface $provider, AIActionService $actions): AIChatService
    {
        return new AIChatService($provider,$this->runtime['ai_action_repository'],$actions,$this->runtime['planning_service'],$this->runtime['habit_service'],$this->runtime['clock']);
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
            public function __construct(private string $proposal)
            {
            }
            public function name(): string
            {
                return 'fake';
            }
            public function chat(string $system, array $contents, array $tools): array
            {
                return ['content' => ['role' => 'model', 'parts' => [['text' => 'fake answer']]], 'text' => 'fake answer', 'calls' => []];
            }
            public function model(): string
            {
                return 'fake-v1';
            }
            public function generate(GenerationRequest $request): GenerationResult
            {
                return new GenerationResult($this->proposal);
            }
        };
        return $this->actionService($provider);
    }

    private function wipe(): void
    {
        $tables=$this->pdo->query("SELECT table_name FROM information_schema.tables WHERE table_schema='goals_test' AND table_type='BASE TABLE'")->fetchAll(PDO::FETCH_COLUMN);
        $this->pdo->exec('SET FOREIGN_KEY_CHECKS=0');
        try {
            foreach($tables as $table) {
                if(!is_string($table)||preg_match('/^[a-z0-9_]+$/',$table)!==1)throw new RuntimeException('Unsafe table.');
                $this->pdo->exec("DROP TABLE `$table`");
            }
        } finally {
            $this->pdo->exec('SET FOREIGN_KEY_CHECKS=1');
        }
    }
}
