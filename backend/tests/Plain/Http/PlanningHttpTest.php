<?php

declare(strict_types=1);

namespace Tests\Plain\Http;

use PDO;
use PHPUnit\Framework\TestCase;
use Planner\Http\Application;
use Planner\Http\Request;
use Planner\Http\Response;
use Planner\Infrastructure\Database\MigrationRunner;
use Planner\Infrastructure\Session\SessionManager;
use RuntimeException;

final class PlanningHttpTest extends TestCase
{
    private array $runtime;
    private Application $application;
    private SessionManager $session;
    private PDO $pdo;

    protected function setUp(): void
    {
        if (session_status() === PHP_SESSION_ACTIVE) session_write_close();
        session_id('');
        $_SESSION=[];
        $_COOKIE=[];
        $this->runtime=require dirname(__DIR__,3).'/bootstrap/http.php';
        $this->application=$this->runtime['application'];
        $this->session=$this->runtime['session'];
        $this->pdo=$this->runtime['pdo'];
        self::assertSame('goals_test',$this->pdo->query('SELECT DATABASE()')->fetchColumn());
        $this->wipe();
        (new MigrationRunner($this->pdo,dirname(__DIR__,3).'/database/plain-migrations','goals_test'))->migrate();
    }
    protected function tearDown(): void
    {
        $this->session->close();
        session_id('');
        $_SESSION=[];
        $_COOKIE=[];
    }

    public function test_planning_habit_dashboard_review_and_disabled_ai_http_contracts(): void
    {
        [$cookie,$csrf]=$this->register();
        foreach(['/goals','/tasks','/habits','/dashboard','/reviews'] as $page) self::assertSame(200,$this->request('GET',$page,cookie:$cookie)->status);
        // Proposals have no page any more; the floating chat is the only AI entry point.
        self::assertSame(404,$this->request('GET','/ai',cookie:$cookie)->status);
        self::assertSame(419,$this->request('POST','/api/v1/goals',['name'=>'No CSRF'],$cookie,json:true)->status);
        $areas=$this->json($this->request('GET','/api/v1/areas',cookie:$cookie))['data'];
        $goal=$this->json($this->request('POST','/api/v1/goals',['area_id'=>$areas[0]['id'],'parent_goal_id'=>null,'name'=>'Backend','completion_criteria'=>'Can ship'], $cookie,$csrf,true))['data'];
        self::assertSame('Backend',$goal['name']);
        self::assertSame(200,$this->request('GET','/goals/'.$goal['id'],cookie:$cookie)->status);
        $milestone=$this->json($this->request('POST','/api/v1/milestones',['goal_id'=>$goal['id'],'name'=>'Deploy'], $cookie,$csrf,true))['data'];
        $task=$this->json($this->request('POST','/api/v1/tasks',['goal_id'=>null,'milestone_id'=>$milestone['id'],'name'=>'Prepare'], $cookie,$csrf,true))['data'];
        self::assertSame(200,$this->request('GET','/tasks/'.$task['id'],cookie:$cookie)->status);
        self::assertSame(201,$this->request('POST','/api/v1/tasks/'.$task['id'].'/checklist',['title'=>'Verify release','position'=>0],$cookie,$csrf,true)->status);
        self::assertSame(200,$this->request('POST','/api/v1/tasks/'.$task['id'].'/note',['body'=>'Release notes','base_version'=>null],$cookie,$csrf,true)->status);
        self::assertSame(200,$this->request('POST','/api/v1/weekly-selections/task',['id'=>$task['id'],'position'=>0],$cookie,$csrf,true)->status);
        self::assertSame(200,$this->request('POST','/api/v1/tasks/'.$task['id'].'/complete',['base_version'=>$task['version'],'acknowledge_unchecked_items'=>true],$cookie,$csrf,true)->status);
        $habit=$this->json($this->request('POST','/api/v1/habits',['name'=>'Exercise','period'=>'daily','target_frequency'=>1,'timezone'=>'UTC'],$cookie,$csrf,true))['data'];
        $date=$this->runtime['clock']->now()->format('Y-m-d');
        self::assertSame(200,$this->request('PUT','/api/v1/habits/'.$habit['id'].'/check-ins/'.$date,[],$cookie,$csrf)->status);
        self::assertSame(200,$this->request('GET','/api/v1/dashboard',cookie:$cookie)->status);
        $review=$this->request('POST','/api/v1/reviews',['kind'=>'Daily','date'=>$date],$cookie,$csrf,true);
        self::assertSame(201,$review->status);
        $ai=$this->request('POST','/api/v1/ai/actions',['capability'=>'help_plan','instruction'=>'Plan','context'=>[],'consent'=>true],$cookie,$csrf,true);
        self::assertSame(503,$ai->status);
        self::assertSame('AI_DISABLED',$this->json($ai)['code']);
        self::assertSame(0,(int)$this->pdo->query('SELECT COUNT(*) FROM ai_actions')->fetchColumn());
    }

    public function test_roadmap_and_strategy_http_contracts_are_owner_scoped_and_versioned(): void
    {
        [$cookie, $csrf] = $this->register();
        $areas = $this->json($this->request('GET', '/api/v1/areas', cookie: $cookie))['data'];
        $response = $this->request('POST', '/api/v1/goals', ['area_id' => $areas[0]['id'], 'name' => 'Roadmap', 'strategy_notes' => 'Build and debug'], $cookie, $csrf, true);
        self::assertSame(201, $response->status);
        $goal = $this->json($response)['data'];
        $map = $this->request('GET', '/api/v1/goals/'.$goal['id'].'/roadmap', cookie: $cookie);
        self::assertSame(200, $map->status);
        self::assertSame('Build and debug', $this->json($map)['data']['goal']['strategy_notes']);
        self::assertSame([], $this->json($map)['data']['milestones']);
        self::assertSame(419, $this->request('PATCH', '/api/v1/goals/'.$goal['id'], ['base_version' => 1, 'strategy_notes' => 'No CSRF'], $cookie, json: true)->status);
        self::assertSame(422, $this->request('PATCH', '/api/v1/goals/'.$goal['id'], ['base_version' => 1, 'strategy_notes' => 'New', 'unknown' => true], $cookie, $csrf, true)->status);
        self::assertSame(200, $this->request('PATCH', '/api/v1/goals/'.$goal['id'], ['base_version' => 1, 'strategy_notes' => 'New'], $cookie, $csrf, true)->status);
        self::assertSame(409, $this->request('PATCH', '/api/v1/goals/'.$goal['id'], ['base_version' => 1, 'strategy_notes' => 'Stale'], $cookie, $csrf, true)->status);
        self::assertSame(404, $this->request('GET', '/api/v1/goals/00000000-0000-4000-8000-000000000000/roadmap', cookie: $cookie)->status);
        $other = $this->runtime['account_repository']->insertUser('foreign-roadmap@example.test', 'Other', password_hash('long test password', PASSWORD_BCRYPT), '2026-10-07 00:00:00.000000')->id;
        $foreignArea = $this->runtime['planning_service']->create('area', $other, ['name' => 'Other']);
        $foreignGoal = $this->runtime['planning_service']->create('goal', $other, ['name' => 'Foreign', 'area_id' => $foreignArea['id']]);
        self::assertSame(404, $this->request('GET', '/api/v1/goals/'.$foreignGoal['id'].'/roadmap', cookie: $cookie)->status);
        $page = $this->request('GET', '/goals/'.$goal['id'], cookie: $cookie);
        self::assertStringContainsString('id="goal-information-dialog"', $page->body);
        self::assertStringContainsString('data-goal-information-description', $page->body);
        self::assertStringContainsString('name="goal-information-sections"', $page->body);
        self::assertStringContainsString('data-goal-strategy-form', $page->body);
        self::assertStringContainsString('data-goal-details-form', $page->body);
        self::assertStringNotContainsString('data-goal-tab', $page->body);
    }

    public function test_timezone_aliases_are_canonicalized_for_habit_and_series_http_creation(): void
    {
        [$cookie, $csrf] = $this->register();
        foreach (['habits', 'task-series'] as $resource) {
            $input = ['name' => 'Canonical timezone', 'timezone' => 'Asia/Saigon'];
            if ($resource === 'task-series') {
                $input += ['frequency' => 'daily', 'start_date' => $this->runtime['clock']->now()->format('Y-m-d')];
            }
            $response = $this->request('POST', '/api/v1/'.$resource, $input, $cookie, $csrf, true);
            self::assertSame(201, $response->status);
            self::assertSame('Asia/Ho_Chi_Minh', $this->json($response)['data']['timezone']);
            $input['timezone'] = 'Bogus/Zone';
            $invalid = $this->request('POST', '/api/v1/'.$resource, $input, $cookie, $csrf, true);
            self::assertSame(422, $invalid->status);
            self::assertArrayHasKey('timezone', $this->json($invalid)['errors']);
        }
    }

    public function test_ended_series_http_transitions_preserve_auth_csrf_ownership_versions_and_replay(): void
    {
        [$cookie, $csrf] = $this->register();
        $today = $this->runtime['clock']->now()->format('Y-m-d');
        $created = $this->request('POST', '/api/v1/task-series', [
            'name' => 'End once', 'frequency' => 'daily', 'timezone' => 'UTC',
            'start_date' => $today, 'end_date' => $today,
        ], $cookie, $csrf, true);
        self::assertSame(201, $created->status);
        $series = $this->json($created)['data'];
        $path = '/api/v1/task-series/'.$series['id'];
        $response = $this->request('POST', $path.'/end', ['base_version' => $series['version'], 'end_date' => $today], $cookie, $csrf, true);
        self::assertSame(200, $response->status);
        $ended = $this->json($response)['data'];
        self::assertSame('Ended', $ended['state']);
        self::assertSame(401, $this->request('POST', $path.'/resume', ['base_version' => $ended['version']], json: true)->status);
        self::assertSame(419, $this->request('POST', $path.'/resume', ['base_version' => $ended['version']], $cookie, json: true)->status);
        self::assertSame(409, $this->request('POST', $path.'/resume', ['base_version' => $series['version']], $cookie, $csrf, true)->status);
        foreach (['pause', 'resume'] as $action) {
            $rejected = $this->request('POST', $path.'/'.$action, ['base_version' => $ended['version']], $cookie, $csrf, true);
            self::assertSame(422, $rejected->status);
            self::assertArrayHasKey('state', $this->json($rejected)['errors']);
        }
        $replay = $this->request('POST', $path.'/end', ['base_version' => $ended['version'], 'end_date' => $today], $cookie, $csrf, true);
        self::assertSame(200, $replay->status);
        self::assertSame($ended, $this->json($replay)['data']);
        self::assertSame($ended, $this->json($this->request('GET', $path, cookie: $cookie))['data']);

        $other = $this->runtime['account_repository']->insertUser('foreign-series@example.test', 'Other', password_hash('long test password', PASSWORD_BCRYPT), '2026-11-02 00:00:00.000000');
        $foreign = $this->runtime['task_series_service']->create($other->id, [
            'name' => 'Private ended', 'frequency' => 'daily', 'timezone' => 'UTC', 'start_date' => $today,
        ]);
        $foreign = $this->runtime['task_series_service']->transition($other->id, $foreign['id'], 'end', ['base_version' => $foreign['version'], 'end_date' => $today]);
        foreach (['pause', 'resume'] as $action) {
            self::assertSame(404, $this->request('POST', '/api/v1/task-series/'.$foreign['id'].'/'.$action, ['base_version' => $foreign['version']], $cookie, $csrf, true)->status);
        }
    }

    public function test_daily_selection_http_preserves_ownership_csrf_validation_and_task_version(): void
    {
        [$cookie, $csrf] = $this->register();
        $created = $this->request('POST', '/api/v1/tasks', ['name' => 'Choose today'], $cookie, $csrf, true);
        $task = $this->json($created)['data'];
        $path = '/api/v1/daily-selections/task';
        self::assertSame(401, $this->request('POST', $path, ['id' => $task['id']], json: true)->status);
        self::assertSame(419, $this->request('POST', $path, ['id' => $task['id']], $cookie, json: true)->status);
        self::assertSame(422, $this->request('POST', $path, ['id' => 'bad'], $cookie, $csrf, true)->status);
        self::assertSame(422, $this->request('POST', $path, ['id' => $task['id'], 'date' => '2030-01-01'], $cookie, $csrf, true)->status);
        for ($attempt = 0; $attempt < 2; $attempt++) {
            $response = $this->request('POST', $path, ['id' => $task['id']], $cookie, $csrf, true);
            self::assertSame(200, $response->status);
            self::assertSame([$task['id']], array_column($this->json($response)['data'], 'id'));
        }
        self::assertSame($task, $this->json($this->request('GET', '/api/v1/tasks/'.$task['id'], cookie: $cookie))['data']);
        self::assertSame([$task['id']], array_column($this->json($this->request('GET', $path, cookie: $cookie))['data'], 'id'));
        self::assertCount(1, $this->json($this->request('GET', '/api/v1/weekly-selections/task', cookie: $cookie))['data']);
        $other = $this->runtime['account_repository']->insertUser('daily-other@example.test', 'Other', password_hash('long test password', PASSWORD_BCRYPT), '2026-11-02 00:00:00.000000');
        $foreign = $this->runtime['planning_service']->create('task', $other->id, ['name' => 'Private']);
        self::assertSame(404, $this->request('POST', $path, ['id' => $foreign['id']], $cookie, $csrf, true)->status);
        self::assertSame(404, $this->request('DELETE', $path.'/'.$foreign['id'], [], $cookie, $csrf)->status);
        self::assertSame(204, $this->request('DELETE', $path.'/'.$task['id'], [], $cookie, $csrf)->status);
        self::assertSame([], $this->json($this->request('GET', $path, cookie: $cookie))['data']);
        self::assertCount(1, $this->json($this->request('GET', '/api/v1/weekly-selections/task', cookie: $cookie))['data']);
    }

    public function test_today_capture_creates_and_selects_atomically_and_overdue_reopen_requires_date_decision(): void
    {
        [$cookie, $csrf] = $this->register();
        $path = '/api/v1/daily-selections/task';
        $invalid = $this->request('POST', $path, ['name' => ''], $cookie, $csrf, true);
        self::assertSame(422, $invalid->status);
        self::assertSame(0, (int) $this->pdo->query('SELECT COUNT(*) FROM tasks')->fetchColumn());
        $captured = $this->request('POST', $path, ['name' => 'Captured today'], $cookie, $csrf, true);
        self::assertSame(200, $captured->status);
        $task = $this->json($captured)['data'][0];
        self::assertSame('Captured today', $task['name']);
        self::assertSame('NotStarted', $task['status']);
        self::assertNull($task['deadline']);
        $data = $this->json($this->request('GET', '/api/v1/dashboard', cookie: $cookie))['data'];
        self::assertSame([$task['id']], array_column($data['today_tasks'], 'id'));
        self::assertSame([$task['id']], array_column($data['selected_tasks'], 'id'));
        $yesterday = $this->runtime['clock']->now()->modify('-1 day')->format('Y-m-d');
        $updated = $this->json($this->request('PATCH', '/api/v1/tasks/'.$task['id'], ['base_version' => $task['version'], 'deadline' => $yesterday], $cookie, $csrf, true))['data'];
        $reopenPath = '/api/v1/tasks/'.$task['id'].'/reopen';
        $missing = $this->request('POST', $reopenPath, ['base_version' => $updated['version']], $cookie, $csrf, true);
        self::assertSame(422, $missing->status);
        self::assertSame('REOPEN_DEADLINE_REQUIRED', $this->json($missing)['code']);
        self::assertSame(409, $this->request('POST', $reopenPath, ['base_version' => $task['version'], 'deadline' => null], $cookie, $csrf, true)->status);
        self::assertSame(422, $this->request('POST', $reopenPath, ['base_version' => $updated['version'], 'deadline' => $yesterday], $cookie, $csrf, true)->status);
        $reopened = $this->request('POST', $reopenPath, ['base_version' => $updated['version'], 'deadline' => null], $cookie, $csrf, true);
        self::assertSame(200, $reopened->status);
        self::assertNull($this->json($reopened)['data']['deadline']);
        self::assertSame('InProgress', $this->json($reopened)['data']['status']);
        self::assertSame(0, (int) $this->pdo->query('SELECT COUNT(*) FROM activities')->fetchColumn());
    }

    public function test_dashboard_roadmap_choice_is_persisted_owner_scoped_and_explicitly_cleared(): void
    {
        [$cookie, $csrf] = $this->register();
        $path = '/api/v1/dashboard/roadmap';
        $dashboard = fn (): array => $this->json($this->request('GET', '/api/v1/dashboard', cookie: $cookie))['data'];
        self::assertNull($dashboard()['roadmap_goal_id']);
        $areas = $this->json($this->request('GET', '/api/v1/areas', cookie: $cookie))['data'];
        $goal = $this->json($this->request('POST', '/api/v1/goals', ['area_id' => $areas[0]['id'], 'name' => 'Chosen roadmap'], $cookie, $csrf, true))['data'];
        self::assertNull($dashboard()['roadmap_goal_id']);
        self::assertSame(401, $this->request('PATCH', $path, ['goal_id' => $goal['id']], json: true)->status);
        self::assertSame(419, $this->request('PATCH', $path, ['goal_id' => $goal['id']], $cookie, json: true)->status);
        self::assertSame(422, $this->request('PATCH', $path, ['goal_id' => 'bad'], $cookie, $csrf, true)->status);
        self::assertSame(422, $this->request('PATCH', $path, ['goal_id' => $goal['id'], 'unknown' => true], $cookie, $csrf, true)->status);
        $response = $this->request('PATCH', $path, ['goal_id' => $goal['id']], $cookie, $csrf, true);
        self::assertSame(200, $response->status);
        self::assertSame(['goal_id' => $goal['id']], $this->json($response)['data']);
        self::assertSame($goal['id'], $dashboard()['roadmap_goal_id']);
        self::assertSame($goal['version'], $this->json($this->request('GET', '/api/v1/goals/'.$goal['id'], cookie: $cookie))['data']['version']);
        $other = $this->runtime['account_repository']->insertUser('roadmap-other@example.test', 'Other', password_hash('long test password', PASSWORD_BCRYPT), '2026-11-02 00:00:00.000000');
        $area = $this->runtime['planning_service']->create('area', $other->id, ['name' => 'Private']);
        $foreign = $this->runtime['planning_service']->create('goal', $other->id, ['area_id' => $area['id'], 'name' => 'Private roadmap']);
        self::assertSame(404, $this->request('PATCH', $path, ['goal_id' => $foreign['id']], $cookie, $csrf, true)->status);
        self::assertSame($goal['id'], $dashboard()['roadmap_goal_id']);
        self::assertSame(200, $this->request('DELETE', '/api/v1/goals/'.$goal['id'], ['base_version' => $goal['version']], $cookie, $csrf, true)->status);
        self::assertNull($dashboard()['roadmap_goal_id']);
        self::assertSame(404, $this->request('PATCH', $path, ['goal_id' => $goal['id']], $cookie, $csrf, true)->status);
        self::assertSame(200, $this->request('PATCH', $path, ['goal_id' => null], $cookie, $csrf, true)->status);
        $owner = $this->runtime['account_repository']->findByEmail('planner-http@example.test')->id;
        $statement = $this->pdo->prepare('SELECT dashboard_roadmap_goal_id FROM user_preferences WHERE user_id = :user_id');
        $statement->execute(['user_id' => $owner]);
        self::assertNull($statement->fetchColumn());
    }

    private function register(): array
    {
        $page=$this->request('GET','/register');
        preg_match('/name="_token" value="([a-f0-9]{64})"/',$page->body,$match);
        $cookie=$this->session->id();
        $this->request('POST','/register',['_token'=>$match[1],'display_name'=>'Planner','email'=>'planner-http@example.test','password'=>'correct horse battery staple','password_confirmation'=>'correct horse battery staple'],$cookie);
        $cookie=$this->session->id();
        $response=$this->request('GET','/api/v1/session',cookie:$cookie);
        return [$cookie,$this->json($response)['data']['csrf_token']];
    }
    private function request(string $method,string $path,array $input=[],?string $cookie=null,?string $csrf=null,bool $json=false): Response
    {
        $headers=['accept'=>str_starts_with($path,'/api/')?'application/json':'text/html'];
        $form=$input;
        $body='';
        if($json) {
            $headers['content-type']='application/json';
            $body=json_encode($input,JSON_THROW_ON_ERROR);
            $form=[];
        } if($csrf!==null)$headers['x-csrf-token']=$csrf;
        return $this->application->handle(new Request($method,$path,headers:$headers,cookies:$cookie===null?[]:['planner_session'=>$cookie],form:$form,server:['REMOTE_ADDR'=>'198.51.100.77'],rawBody:$body));
    }
    private function json(Response $response): array
    {
        return json_decode($response->body,true,512,JSON_THROW_ON_ERROR);
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
