<?php

declare(strict_types=1);

namespace Planner\Console;

use PDO;
use DateTimeImmutable;
use DateTimeZone;
use Ramsey\Uuid\Uuid;
use Planner\Infrastructure\Persistence\Pdo\Reviews\PdoReviewRepository;
use Planner\Support\Timestamp;

/** Build demo Review facts with the same schema consumed by ReviewService and the UI. */
function roadmapDemoReviewSnapshot(PDO $pdo, int $userId, string $kind, string $from, string $to, string $generatedAt, string $timezone = 'UTC'): string
{
    return json_encode([
        'schema_version' => 1,
        'generated_at' => Timestamp::api($generatedAt),
        'timezone' => $timezone,
        'period_start' => $from,
        'period_end' => $to,
        ...(new PdoReviewRepository($pdo))->facts($userId, $from, $to, $kind),
    ], JSON_THROW_ON_ERROR);
}

/**
 * Seeder script for roadmap-demo@example.test (user_id = 2).
 * Simulates 2 months of active, realistic usage (Sept 2026 to Nov 2, 2026).
 */
function seedRoadmapDemo(PDO $pdo): void
{
    $userId = 2;

    // Verify user exists
    $stmt = $pdo->prepare('SELECT id, email FROM users WHERE id = :id');
    $stmt->execute(['id' => $userId]);
    $user = $stmt->fetch(PDO::FETCH_ASSOC);
    if (!$user) {
        throw new \RuntimeException('User roadmap-demo@example.test (ID 2) not found.');
    }

    echo "Seeding roadmap-demo account (ID {$userId}: {$user['email']})...\n";

    $pdo->beginTransaction();
    try {
        // 1. Clean existing records belonging strictly to user 2
        $tablesToClean = [
            'activities',
            'daily_task_selections',
            'weekly_task_selections',
            'weekly_milestone_selections',
            'checklist_items',
            'task_notes',
            'task_tags',
            'tasks',
            'milestone_dependencies',
            'milestone_tags',
            'milestones',
            'goal_contributions',
            'goal_tags',
            'goal_daily_snapshots',
            'goals',
            'areas',
            'habit_check_ins',
            'habit_rest_days',
            'habit_tags',
            'habits',
            'reviews',
            'notes',
        ];

        $pdo->exec('SET FOREIGN_KEY_CHECKS = 0');
        foreach ($tablesToClean as $table) {
            $stmt = $pdo->prepare("DELETE FROM {$table} WHERE user_id = :user_id");
            $stmt->execute(['user_id' => $userId]);
        }
        $pdo->exec('SET FOREIGN_KEY_CHECKS = 1');

        $now = new DateTimeImmutable('2026-11-02 12:00:00', new DateTimeZone('UTC'));
        $todayStr = '2026-11-02';
        $currentWeekStart = '2026-11-02';

        // 2. Create Area
        $areaId = Uuid::uuid4()->toString();
        $stmt = $pdo->prepare(<<<'SQL'
INSERT INTO areas (id, user_id, name, description, position, version, created_at, updated_at)
VALUES (:id, :user_id, :name, :description, 0, 1, :created_at, :updated_at)
SQL);
        $stmt->execute([
            'id' => $areaId,
            'user_id' => $userId,
            'name' => 'Career & Engineering',
            'description' => 'Professional AI, Quant engineering and career development goals.',
            'created_at' => '2026-09-01 08:00:00.000000',
            'updated_at' => '2026-09-01 08:00:00.000000',
        ]);

        // 3. Create Main Goal
        $goalId = '736af3b9-d979-4acb-86bd-bd8ec14f8a19'; // Keep stable Goal UUID
        $stmt = $pdo->prepare(<<<'SQL'
INSERT INTO goals (id, user_id, area_id, name, description, expected_result, completion_criteria, importance, status, deadline, position, version, created_at, updated_at)
VALUES (:id, :user_id, :area_id, :name, :description, :expected_result, :completion_criteria, 5, 'Active', '2027-03-31', 0, 1, :created_at, :updated_at)
SQL);
        $stmt->execute([
            'id' => $goalId,
            'user_id' => $userId,
            'area_id' => $areaId,
            'name' => 'AI production engineer + Quant secondary',
            'description' => 'Master production AI deployment, low-latency inferencing and quant trading pipeline architecture.',
            'expected_result' => 'Deploy high-throughput LLM pipelines and automated algorithmic backtest engines.',
            'completion_criteria' => 'Complete all 6 core milestones and pass benchmark portfolio backtests.',
            'created_at' => '2026-09-01 08:30:00.000000',
            'updated_at' => '2026-09-01 08:30:00.000000',
        ]);

        // Update preferences to point roadmap to this goal
        $stmt = $pdo->prepare('UPDATE user_preferences SET dashboard_roadmap_goal_id = :goal_id WHERE user_id = :user_id');
        $stmt->execute(['goal_id' => $goalId, 'user_id' => $userId]);

        // 4. Create 6 Milestones with progressive states
        // Milestone 0: Completed (100%) -> solid green node, connector to M1 is 100% green
        // Milestone 1: InProgress (4/6 done = 66.7%) -> active outline node, connector to M2 is 67% green
        // Milestone 2: InProgress (1/5 done = 20%) -> active outline node, connector to M3 is 20% green
        // Milestone 3: NotStarted (0%) -> gray node, connector to M4 is 0%
        // Milestone 4: NotStarted (0%) -> gray node, connector to M5 is 0%
        // Milestone 5: NotStarted (0%) -> last node, no connector
        $milestonesConfig = [
            ['id' => '6a7b5bb8-6047-43d8-a584-ba19c83bda79', 'name' => 'Foundations (2–3 day sprint)', 'status' => 'Completed', 'importance' => 5, 'deadline' => '2026-09-15', 'completed_at' => '2026-09-14 17:00:00.000000'],
            ['id' => '394bc6a4-2c7b-4f44-8d76-b2610807174a', 'name' => 'ML core', 'status' => 'InProgress', 'importance' => 5, 'deadline' => '2026-11-10', 'completed_at' => null],
            ['id' => '358c5f84-5e0b-4306-9400-4278450e57a4', 'name' => 'AI / LLM', 'status' => 'InProgress', 'importance' => 4, 'deadline' => '2026-11-30', 'completed_at' => null],
            ['id' => 'e975bb1e-1b14-49eb-98c7-e4b53c4a452d', 'name' => 'Production LLM', 'status' => 'NotStarted', 'importance' => 4, 'deadline' => '2026-12-31', 'completed_at' => null],
            ['id' => '3ad2223e-5cdc-42cd-97d6-e497ea137701', 'name' => 'Optimization', 'status' => 'NotStarted', 'importance' => 3, 'deadline' => '2027-01-31', 'completed_at' => null],
            ['id' => 'a74414d4-f5cd-4bc7-a0bb-3634e6ebd19b', 'name' => 'Production depth', 'status' => 'NotStarted', 'importance' => 3, 'deadline' => '2027-02-28', 'completed_at' => null],
        ];

        $insertMilestoneStmt = $pdo->prepare(<<<'SQL'
INSERT INTO milestones (id, user_id, goal_id, name, description, completion_criteria, importance, status, deadline, position, version, completed_at, created_at, updated_at)
VALUES (:id, :user_id, :goal_id, :name, :description, :completion_criteria, :importance, :status, :deadline, :position, 1, :completed_at, :created_at, :updated_at)
SQL);

        foreach ($milestonesConfig as $pos => $m) {
            $insertMilestoneStmt->execute([
                'id' => $m['id'],
                'user_id' => $userId,
                'goal_id' => $goalId,
                'name' => $m['name'],
                'description' => "Checkpoint for {$m['name']}.",
                'completion_criteria' => "Complete all associated development and testing tasks for {$m['name']}.",
                'importance' => $m['importance'],
                'status' => $m['status'],
                'deadline' => $m['deadline'],
                'position' => $pos,
                'completed_at' => $m['completed_at'],
                'created_at' => '2026-09-02 09:00:00.000000',
                'updated_at' => $m['completed_at'] ?? '2026-09-02 09:00:00.000000',
            ]);
        }

        // 5. Tasks creation
        $insertTaskStmt = $pdo->prepare(<<<'SQL'
INSERT INTO tasks (id, user_id, goal_id, milestone_id, name, description, expected_result, completion_criteria, importance, status, start_date, deadline, scheduled_start, scheduled_end, position, version, completed_at, created_at, updated_at)
VALUES (:id, :user_id, :goal_id, :milestone_id, :name, :description, :expected_result, :completion_criteria, :importance, :status, :start_date, :deadline, :scheduled_start, :scheduled_end, :position, 1, :completed_at, :created_at, :updated_at)
SQL);

        // --- Tasks for Milestone 0 (Foundations - 4/4 Done = 100%) ---
        $m0Tasks = [
            ['name' => 'Python 3.12 modern features & typing mastery', 'date' => '2026-09-05'],
            ['name' => 'FastAPI async microservice scaffolding', 'date' => '2026-09-08'],
            ['name' => 'Docker Compose multi-stage build setup', 'date' => '2026-09-11'],
            ['name' => 'Pytest integration test suite with coverage', 'date' => '2026-09-14'],
        ];
        foreach ($m0Tasks as $pos => $t) {
            $taskId = Uuid::uuid4()->toString();
            $completedAt = "{$t['date']} 16:30:00.000000";
            $insertTaskStmt->execute([
                'id' => $taskId,
                'user_id' => $userId,
                'goal_id' => null,
                'milestone_id' => $milestonesConfig[0]['id'],
                'name' => $t['name'],
                'description' => "Foundational task {$t['name']}.",
                'expected_result' => 'Functional and tested codebase.',
                'completion_criteria' => 'Pass all test cases.',
                'importance' => 4,
                'status' => 'Done',
                'start_date' => '2026-09-03',
                'deadline' => $t['date'],
                'scheduled_start' => null,
                'scheduled_end' => null,
                'position' => $pos,
                'completed_at' => $completedAt,
                'created_at' => '2026-09-02 10:00:00.000000',
                'updated_at' => $completedAt,
            ]);
        }

        // --- Tasks for Milestone 1 (ML core - 4 Done, 1 InProgress, 1 NotStarted = 6 total, 4/6 = 66.7%) ---
        $m1DoneTasks = [
            ['name' => 'NumPy vectorization & tensor benchmarking', 'date' => '2026-09-22'],
            ['name' => 'PyTorch custom Autograd function implementation', 'date' => '2026-10-04'],
            ['name' => 'Feature engineering pipeline with Polars', 'date' => '2026-10-18'],
            ['name' => 'Distributed Data Parallel (DDP) multi-GPU training setup', 'date' => '2026-10-27'],
        ];
        foreach ($m1DoneTasks as $pos => $t) {
            $taskId = Uuid::uuid4()->toString();
            $completedAt = "{$t['date']} 17:00:00.000000";
            $insertTaskStmt->execute([
                'id' => $taskId,
                'user_id' => $userId,
                'goal_id' => null,
                'milestone_id' => $milestonesConfig[1]['id'],
                'name' => $t['name'],
                'description' => "Core ML module {$t['name']}.",
                'expected_result' => 'High performance ML module.',
                'completion_criteria' => 'Performance tests exceed baseline.',
                'importance' => 5,
                'status' => 'Done',
                'start_date' => '2026-09-16',
                'deadline' => $t['date'],
                'scheduled_start' => null,
                'scheduled_end' => null,
                'position' => $pos,
                'completed_at' => $completedAt,
                'created_at' => '2026-09-15 10:00:00.000000',
                'updated_at' => $completedAt,
            ]);
        }

        // --- Tasks for Milestone 2 (AI / LLM - 1 Done, 4 NotStarted = 1/5 = 20%) ---
        $taskIdM2Done = Uuid::uuid4()->toString();
        $insertTaskStmt->execute([
            'id' => $taskIdM2Done,
            'user_id' => $userId,
            'goal_id' => null,
            'milestone_id' => $milestonesConfig[2]['id'],
            'name' => 'Transformer architecture mathematical review & Tokenizer setup',
            'description' => 'BPE tokenization and self-attention tensor mechanics.',
            'expected_result' => 'Clean standalone tokenizer and attention module.',
            'completion_criteria' => 'Matches reference HuggingFace output.',
            'importance' => 5,
            'status' => 'Done',
            'start_date' => '2026-10-20',
            'deadline' => '2026-10-30',
            'scheduled_start' => null,
            'scheduled_end' => null,
            'position' => 0,
            'completed_at' => '2026-10-30 18:00:00.000000',
            'created_at' => '2026-10-20 10:00:00.000000',
            'updated_at' => '2026-10-30 18:00:00.000000',
        ]);

        $m2PendingTasks = [
            'Fine-tune Llama 3 8B with QLoRA & Unsloth',
            'RAG pipeline with Hybrid Search (BM25 + Dense Vectors)',
            'vLLM high-throughput inference serving cluster',
            'Tool-calling agent with function calling schema validation',
        ];
        foreach ($m2PendingTasks as $pos => $name) {
            $taskId = Uuid::uuid4()->toString();
            $insertTaskStmt->execute([
                'id' => $taskId,
                'user_id' => $userId,
                'goal_id' => null,
                'milestone_id' => $milestonesConfig[2]['id'],
                'name' => $name,
                'description' => "Advanced LLM engineering: {$name}.",
                'expected_result' => 'Functional system.',
                'completion_criteria' => 'Pass all unit & integration tests.',
                'importance' => 4,
                'status' => 'NotStarted',
                'start_date' => '2026-11-05',
                'deadline' => '2026-11-28',
                'scheduled_start' => null,
                'scheduled_end' => null,
                'position' => $pos + 1,
                'completed_at' => null,
                'created_at' => '2026-10-20 10:00:00.000000',
                'updated_at' => '2026-10-20 10:00:00.000000',
            ]);
        }

        // --- Active Tasks for THIS WEEK & TODAY ---
        // Let's create specific tasks that exercise every UI badge and feature:

        // 1. Task in Today: Scheduled (has scheduled_start today) & InProgress
        $taskScheduledToday = Uuid::uuid4()->toString();
        $insertTaskStmt->execute([
            'id' => $taskScheduledToday,
            'user_id' => $userId,
            'goal_id' => null,
            'milestone_id' => $milestonesConfig[1]['id'],
            'name' => 'Implement FlashAttention-2 Triton kernel integration',
            'description' => 'Write custom GPU forward kernel benchmark.',
            'expected_result' => '3x speedup over standard scaled dot-product attention.',
            'completion_criteria' => 'Benchmark passes on A100 testbed.',
            'importance' => 5,
            'status' => 'InProgress',
            'start_date' => '2026-11-02',
            'deadline' => '2026-11-04',
            'scheduled_start' => '2026-11-02 09:00:00.000000',
            'scheduled_end' => '2026-11-02 12:00:00.000000',
            'position' => 4,
            'completed_at' => null,
            'created_at' => '2026-11-01 08:00:00.000000',
            'updated_at' => '2026-11-02 09:00:00.000000',
        ]);

        // 2. Task in Today: Due today (deadline = 2026-11-02) & NotStarted
        $taskDueToday = Uuid::uuid4()->toString();
        $insertTaskStmt->execute([
            'id' => $taskDueToday,
            'user_id' => $userId,
            'goal_id' => null,
            'milestone_id' => $milestonesConfig[1]['id'],
            'name' => 'Quant backtest benchmark report submission',
            'description' => 'Compile Sharpe ratio and max drawdown metrics from Q3 paper trading data.',
            'expected_result' => 'Complete PDF report and raw CSV logs.',
            'completion_criteria' => 'Reviewed and submitted.',
            'importance' => 4,
            'status' => 'NotStarted',
            'start_date' => null,
            'deadline' => '2026-11-02',
            'scheduled_start' => null,
            'scheduled_end' => null,
            'position' => 5,
            'completed_at' => null,
            'created_at' => '2026-11-01 10:00:00.000000',
            'updated_at' => '2026-11-01 10:00:00.000000',
        ]);

        // 3. Task in Today: Completed today (Done, completed_at = 2026-11-02 11:30:00)
        $taskDoneToday = Uuid::uuid4()->toString();
        $insertTaskStmt->execute([
            'id' => $taskDoneToday,
            'user_id' => $userId,
            'goal_id' => null,
            'milestone_id' => null,
            'name' => 'Docker staging cluster health & memory leak check',
            'description' => 'Verify Prometheus metrics and Redis memory consumption.',
            'expected_result' => 'No memory leak detected.',
            'completion_criteria' => 'All containers running under 500MB.',
            'importance' => 3,
            'status' => 'Done',
            'start_date' => '2026-11-02',
            'deadline' => '2026-11-02',
            'scheduled_start' => null,
            'scheduled_end' => null,
            'position' => 0,
            'completed_at' => '2026-11-02 11:30:00.000000',
            'created_at' => '2026-11-02 08:00:00.000000',
            'updated_at' => '2026-11-02 11:30:00.000000',
        ]);

        // 4. Task in Today: Manually added for today (daily_task_selections) with remove '×' button
        $taskManuallySelected = Uuid::uuid4()->toString();
        $insertTaskStmt->execute([
            'id' => $taskManuallySelected,
            'user_id' => $userId,
            'goal_id' => null,
            'milestone_id' => null,
            'name' => 'Review pull request #128: Async order execution handler',
            'description' => 'Review safety guards on margin check logic.',
            'expected_result' => 'Approved PR with feedback comments.',
            'completion_criteria' => 'Merge to develop branch.',
            'importance' => 3,
            'status' => 'InProgress',
            'start_date' => null,
            'deadline' => '2026-11-06',
            'scheduled_start' => null,
            'scheduled_end' => null,
            'position' => 1,
            'completed_at' => null,
            'created_at' => '2026-11-01 14:00:00.000000',
            'updated_at' => '2026-11-02 09:30:00.000000',
        ]);

        // 5. Overdue Tasks (Unfinished with deadline in the past, within history retention)
        $taskOverdue1 = Uuid::uuid4()->toString();
        $insertTaskStmt->execute([
            'id' => $taskOverdue1,
            'user_id' => $userId,
            'goal_id' => null,
            'milestone_id' => null,
            'name' => 'Fix order book drift in WebSocket stream',
            'description' => 'Investigate dropped sequence numbers during high volatility bursts.',
            'expected_result' => 'Zero dropped packet reconnect loop.',
            'completion_criteria' => 'Run for 24h simulated market feeds.',
            'importance' => 5,
            'status' => 'InProgress',
            'start_date' => '2026-10-29',
            'deadline' => '2026-10-31', // Past deadline
            'scheduled_start' => null,
            'scheduled_end' => null,
            'position' => 2,
            'completed_at' => null,
            'created_at' => '2026-10-28 10:00:00.000000',
            'updated_at' => '2026-10-31 18:00:00.000000',
        ]);

        $taskOverdue2 = Uuid::uuid4()->toString();
        $insertTaskStmt->execute([
            'id' => $taskOverdue2,
            'user_id' => $userId,
            'goal_id' => null,
            'milestone_id' => null,
            'name' => 'Update production SSL certificate on API gateway',
            'description' => 'Renew Let’s Encrypt wildcard cert and reload NGINX.',
            'expected_result' => 'HTTPS cert valid until 2027.',
            'completion_criteria' => 'Verify SSL labs grade A+.',
            'importance' => 4,
            'status' => 'NotStarted',
            'start_date' => null,
            'deadline' => '2026-11-01', // Yesterday deadline
            'scheduled_start' => null,
            'scheduled_end' => null,
            'position' => 3,
            'completed_at' => null,
            'created_at' => '2026-10-30 09:00:00.000000',
            'updated_at' => '2026-10-30 09:00:00.000000',
        ]);

        // 6. Blocked task (for testing status filter: Blocked)
        $taskBlocked = Uuid::uuid4()->toString();
        $insertTaskStmt->execute([
            'id' => $taskBlocked,
            'user_id' => $userId,
            'goal_id' => null,
            'milestone_id' => null,
            'name' => 'Connect live exchange broker API key (Awaiting KYC approval)',
            'description' => 'Waiting for compliance email verification from broker.',
            'expected_result' => 'Live API key provisioned.',
            'completion_criteria' => 'Ping broker auth endpoint with success.',
            'importance' => 3,
            'status' => 'Blocked',
            'start_date' => '2026-11-02',
            'deadline' => '2026-11-08',
            'scheduled_start' => '2026-11-05 14:00:00.000000',
            'scheduled_end' => '2026-11-05 15:00:00.000000',
            'position' => 4,
            'completed_at' => null,
            'created_at' => '2026-11-02 08:00:00.000000',
            'updated_at' => '2026-11-02 08:00:00.000000',
        ]);

        // 7. General Week Task
        $taskWeekNormal = Uuid::uuid4()->toString();
        $insertTaskStmt->execute([
            'id' => $taskWeekNormal,
            'user_id' => $userId,
            'goal_id' => null,
            'milestone_id' => null,
            'name' => 'Profile memory consumption of multi-tenant Vector Store',
            'description' => 'Run memory profiler on Qdrant / FAISS embeddings index.',
            'expected_result' => 'Memory report with optimization recommendations.',
            'completion_criteria' => 'Profile under 1M vectors completed.',
            'importance' => 2,
            'status' => 'NotStarted',
            'start_date' => '2026-11-04',
            'deadline' => '2026-11-07',
            'scheduled_start' => '2026-11-04 10:00:00.000000',
            'scheduled_end' => '2026-11-04 12:00:00.000000',
            'position' => 5,
            'completed_at' => null,
            'created_at' => '2026-11-02 08:30:00.000000',
            'updated_at' => '2026-11-02 08:30:00.000000',
        ]);

        // Add checklist items to taskScheduledToday
        $insertChecklistStmt = $pdo->prepare(<<<'SQL'
INSERT INTO checklist_items (id, user_id, task_id, title, checked, position, version, checked_at, created_at, updated_at)
VALUES (:id, :user_id, :task_id, :title, :checked, :position, 1, :checked_at, :created_at, :updated_at)
SQL);
        $insertChecklistStmt->execute([
            'id' => Uuid::uuid4()->toString(),
            'user_id' => $userId,
            'task_id' => $taskScheduledToday,
            'title' => 'Profile baseline torch.nn.functional.scaled_dot_product_attention',
            'checked' => 1,
            'position' => 0,
            'checked_at' => '2026-11-02 09:30:00.000000',
            'created_at' => '2026-11-02 09:00:00.000000',
            'updated_at' => '2026-11-02 09:30:00.000000',
        ]);
        $insertChecklistStmt->execute([
            'id' => Uuid::uuid4()->toString(),
            'user_id' => $userId,
            'task_id' => $taskScheduledToday,
            'title' => 'Implement blocked causal mask in Triton kernel',
            'checked' => 1,
            'position' => 1,
            'checked_at' => '2026-11-02 10:45:00.000000',
            'created_at' => '2026-11-02 09:00:00.000000',
            'updated_at' => '2026-11-02 10:45:00.000000',
        ]);
        $insertChecklistStmt->execute([
            'id' => Uuid::uuid4()->toString(),
            'user_id' => $userId,
            'task_id' => $taskScheduledToday,
            'title' => 'Validate backward pass gradients against PyTorch reference',
            'checked' => 0,
            'position' => 2,
            'checked_at' => null,
            'created_at' => '2026-11-02 09:00:00.000000',
            'updated_at' => '2026-11-02 09:00:00.000000',
        ]);

        // Add task notes
        $insertNoteStmt = $pdo->prepare(<<<'SQL'
INSERT INTO task_notes (task_id, user_id, body, version, created_at, updated_at)
VALUES (:task_id, :user_id, :body, 1, :created_at, :updated_at)
SQL);
        $insertNoteStmt->execute([
            'task_id' => $taskScheduledToday,
            'user_id' => $userId,
            'body' => "# Triton FlashAttention-2 Notes\n- Using BLOCK_M=128, BLOCK_N=64 on A100 SXM4\n- Check warp divergence in softmax rescale step.",
            'created_at' => '2026-11-02 09:00:00.000000',
            'updated_at' => '2026-11-02 09:00:00.000000',
        ]);

        // 6. Record Daily Task Selections for Today
        $insertDailySelectionStmt = $pdo->prepare(<<<'SQL'
INSERT INTO daily_task_selections (user_id, local_date, task_id, created_at)
VALUES (:user_id, :local_date, :task_id, :created_at)
SQL);
        // Only taskManuallySelected is explicitly in daily_task_selections (gives it the remove '×' button)
        $insertDailySelectionStmt->execute([
            'user_id' => $userId,
            'local_date' => $todayStr,
            'task_id' => $taskManuallySelected,
            'created_at' => '2026-11-02 08:30:00.000000',
        ]);

        // 7. Record Weekly Task Selections (Week starting 2026-11-02)
        $insertWeeklyTaskStmt = $pdo->prepare(<<<'SQL'
INSERT INTO weekly_task_selections (user_id, week_start, task_id, position, created_at)
VALUES (:user_id, :week_start, :task_id, :position, :created_at)
SQL);
        $weekTasks = [
            $taskScheduledToday,
            $taskDueToday,
            $taskDoneToday,
            $taskManuallySelected,
            $taskBlocked,
            $taskWeekNormal,
        ];
        foreach ($weekTasks as $pos => $taskId) {
            $insertWeeklyTaskStmt->execute([
                'user_id' => $userId,
                'week_start' => $currentWeekStart,
                'task_id' => $taskId,
                'position' => $pos,
                'created_at' => '2026-11-02 08:00:00.000000',
            ]);
        }

        // Also record a Milestone selection for this week: Milestone 1 (ML core)
        $stmt = $pdo->prepare(<<<'SQL'
INSERT INTO weekly_milestone_selections (user_id, week_start, milestone_id, position, created_at)
VALUES (:user_id, :week_start, :milestone_id, 0, :created_at)
SQL);
        $stmt->execute([
            'user_id' => $userId,
            'week_start' => $currentWeekStart,
            'milestone_id' => $milestonesConfig[1]['id'],
            'created_at' => '2026-11-02 08:00:00.000000',
        ]);

        // 8. Create Habits (Daily & Weekly) with rich 2-month history
        $insertHabitStmt = $pdo->prepare(<<<'SQL'
INSERT INTO habits (id, user_id, primary_goal_id, name, description, importance, period, target_frequency, timezone, position, version, first_check_in_at, created_at, updated_at)
VALUES (:id, :user_id, :primary_goal_id, :name, :description, :importance, :period, :target_frequency, 'UTC', :position, 1, :first_check_in_at, :created_at, :updated_at)
SQL);

        $hDaily1 = Uuid::uuid4()->toString(); // LeetCode / Algorithmic Problem (NOT done today -> user can click tick!)
        $insertHabitStmt->execute([
            'id' => $hDaily1,
            'user_id' => $userId,
            'primary_goal_id' => $goalId,
            'name' => 'LeetCode / Hard algorithmic problem',
            'description' => 'Solve at least one medium or hard dynamic programming / graph problem daily.',
            'importance' => 5,
            'period' => 'daily',
            'target_frequency' => 1,
            'position' => 0,
            'first_check_in_at' => '2026-09-02 07:00:00.000000',
            'created_at' => '2026-09-01 09:00:00.000000',
            'updated_at' => '2026-09-01 09:00:00.000000',
        ]);

        $hDaily2 = Uuid::uuid4()->toString(); // Read Technical Paper (DONE today -> shows checkmark!)
        $insertHabitStmt->execute([
            'id' => $hDaily2,
            'user_id' => $userId,
            'primary_goal_id' => $goalId,
            'name' => 'Read arXiv AI / Quant paper (30 mins)',
            'description' => 'Annotate one paper on attention mechanisms, LLM quantization or market microstructure.',
            'importance' => 4,
            'period' => 'daily',
            'target_frequency' => 1,
            'position' => 1,
            'first_check_in_at' => '2026-09-02 07:30:00.000000',
            'created_at' => '2026-09-01 09:00:00.000000',
            'updated_at' => '2026-09-01 09:00:00.000000',
        ]);

        $hWeekly1 = Uuid::uuid4()->toString(); // Explain concept (Weekly, target 4)
        $insertHabitStmt->execute([
            'id' => $hWeekly1,
            'user_id' => $userId,
            'primary_goal_id' => $goalId,
            'name' => 'Explain one concept after building',
            'description' => 'Write a concise technical summary explaining mathematical intuition.',
            'importance' => 4,
            'period' => 'weekly',
            'target_frequency' => 4,
            'position' => 2,
            'first_check_in_at' => '2026-09-03 18:00:00.000000',
            'created_at' => '2026-09-01 09:00:00.000000',
            'updated_at' => '2026-09-01 09:00:00.000000',
        ]);

        $hWeekly2 = Uuid::uuid4()->toString(); // Quant Backtest validation (Weekly, target 2)
        $insertHabitStmt->execute([
            'id' => $hWeekly2,
            'user_id' => $userId,
            'primary_goal_id' => $goalId,
            'name' => 'Weekly Quant Backtest & Risk Audit',
            'description' => 'Run automated Monte Carlo stress tests across historical data.',
            'importance' => 3,
            'period' => 'weekly',
            'target_frequency' => 2,
            'position' => 3,
            'first_check_in_at' => '2026-09-06 18:00:00.000000',
            'created_at' => '2026-09-01 09:00:00.000000',
            'updated_at' => '2026-09-01 09:00:00.000000',
        ]);

        // Habit check-ins across last 60 days (Sept 3 to Nov 2)
        $insertHabitCheckInStmt = $pdo->prepare(<<<'SQL'
INSERT INTO habit_check_ins (id, user_id, habit_id, local_date, timezone, recorded_at)
VALUES (:id, :user_id, :habit_id, :local_date, 'UTC', :recorded_at)
SQL);

        // Generate steady check-ins for the last 60 days
        $startDay = new DateTimeImmutable('2026-09-02', new DateTimeZone('UTC'));
        $endDay = new DateTimeImmutable('2026-11-01', new DateTimeZone('UTC')); // yesterday

        $curr = $startDay;
        $dayIndex = 0;
        while ($curr <= $endDay) {
            $dateStr = $curr->format('Y-m-d');
            $dayOfWeek = (int) $curr->format('N'); // 1 = Mon, 7 = Sun

            // For daily habits: check in most days to build a solid 14+ day streak
            // Keep a continuous streak from 2026-10-18 to 2026-11-01 (15 consecutive days!)
            $inRecentStreak = ($dateStr >= '2026-10-18');
            $doDaily = $inRecentStreak || ($dayIndex % 7 !== 3); // occasionally miss on older days

            if ($doDaily) {
                // Check in hDaily1
                $insertHabitCheckInStmt->execute([
                    'id' => Uuid::uuid4()->toString(),
                    'user_id' => $userId,
                    'habit_id' => $hDaily1,
                    'local_date' => $dateStr,
                    'recorded_at' => "{$dateStr} 08:00:00.000000",
                ]);
                // Check in hDaily2
                $insertHabitCheckInStmt->execute([
                    'id' => Uuid::uuid4()->toString(),
                    'user_id' => $userId,
                    'habit_id' => $hDaily2,
                    'local_date' => $dateStr,
                    'recorded_at' => "{$dateStr} 08:30:00.000000",
                ]);
            }

            // Weekly habit 1: 3-4 times a week
            if (in_array($dayOfWeek, [2, 4, 6], true)) {
                $insertHabitCheckInStmt->execute([
                    'id' => Uuid::uuid4()->toString(),
                    'user_id' => $userId,
                    'habit_id' => $hWeekly1,
                    'local_date' => $dateStr,
                    'recorded_at' => "{$dateStr} 19:00:00.000000",
                ]);
            }

            // Weekly habit 2: on Fridays and Sundays
            if (in_array($dayOfWeek, [5, 7], true)) {
                $insertHabitCheckInStmt->execute([
                    'id' => Uuid::uuid4()->toString(),
                    'user_id' => $userId,
                    'habit_id' => $hWeekly2,
                    'local_date' => $dateStr,
                    'recorded_at' => "{$dateStr} 20:00:00.000000",
                ]);
            }

            $curr = $curr->modify('+1 day');
            $dayIndex++;
        }

        // Today (2026-11-02):
        // Check in hDaily2 (Read paper) today -> so it is done_today = true
        // Leave hDaily1 (LeetCode) unchecked -> so it is done_today = false (user can click tick!)
        $insertHabitCheckInStmt->execute([
            'id' => Uuid::uuid4()->toString(),
            'user_id' => $userId,
            'habit_id' => $hDaily2,
            'local_date' => $todayStr,
            'recorded_at' => "{$todayStr} 07:45:00.000000",
        ]);

        // Today: also check in hWeekly1 once for this week (shows 1/4 this week)
        $insertHabitCheckInStmt->execute([
            'id' => Uuid::uuid4()->toString(),
            'user_id' => $userId,
            'habit_id' => $hWeekly1,
            'local_date' => $todayStr,
            'recorded_at' => "{$todayStr} 10:15:00.000000",
        ]);

        // Add 1 Rest day on an older date to demonstrate the 'R' symbol in streak history
        $stmt = $pdo->prepare(<<<'SQL'
INSERT INTO habit_rest_days (id, user_id, habit_id, local_date, created_at)
VALUES (:id, :user_id, :habit_id, :local_date, :created_at)
SQL);
        $stmt->execute([
            'id' => Uuid::uuid4()->toString(),
            'user_id' => $userId,
            'habit_id' => $hDaily1,
            'local_date' => '2026-10-17',
            'created_at' => '2026-10-17 07:00:00.000000',
        ]);
        $stmt->execute([
            'id' => Uuid::uuid4()->toString(),
            'user_id' => $userId,
            'habit_id' => $hDaily2,
            'local_date' => '2026-10-17',
            'created_at' => '2026-10-17 07:00:00.000000',
        ]);

        // 9. Generate Realistic 60-Day Activities Heatmap
        // Populate the `activities` table with tasks, habits, milestones completed across Sep, Oct, Nov.
        $insertActivityStmt = $pdo->prepare(<<<'SQL'
INSERT INTO activities (id, user_id, source_type, source_id, source_version, action, occurred_at, effective_date, timezone, reversal_of_id, metadata)
VALUES (:id, :user_id, :source_type, :source_id, 1, 'completed', :occurred_at, :effective_date, 'UTC', NULL, :metadata)
SQL);

        $curr = $startDay;
        while ($curr <= new DateTimeImmutable('2026-11-02', new DateTimeZone('UTC'))) {
            $dateStr = $curr->format('Y-m-d');
            $dayOfWeek = (int) $curr->format('N');

            // Activity level variance: some days have 1, some 3, some 5 contributions
            // Level 0: ~15% of days
            // Level 1 (1 count): ~30% of days
            // Level 2 (2-3 count): ~35% of days
            // Level 3 (4-6 count): ~15% of days
            // Level 4 (7+ count): ~5% of days
            $count = match ($dayOfWeek) {
                1, 3 => 3, // Mon, Wed active
                2, 4 => 2, // Tue, Thu medium
                5 => 4,    // Fri high
                6 => 1,    // Sat light
                7 => ($dateStr >= '2026-10-15' ? 2 : 0), // Sun rest
            };

            for ($i = 0; $i < $count; $i++) {
                $type = match ($i % 3) {
                    0 => 'habit',
                    1 => 'task',
                    2 => 'checklist',
                };
                $insertActivityStmt->execute([
                    'id' => Uuid::uuid4()->toString(),
                    'user_id' => $userId,
                    'source_type' => $type,
                    'source_id' => Uuid::uuid4()->toString(),
                    'occurred_at' => "{$dateStr} " . sprintf('%02d:%02d:00.000000', 8 + ($i * 2), 15 + ($i * 7)),
                    'effective_date' => $dateStr,
                    'metadata' => json_encode(['source' => 'seed_roadmap_demo'], JSON_THROW_ON_ERROR),
                ]);
            }

            $curr = $curr->modify('+1 day');
        }

        // Add milestone completion activities for Milestone 0
        $insertActivityStmt->execute([
            'id' => Uuid::uuid4()->toString(),
            'user_id' => $userId,
            'source_type' => 'milestone',
            'source_id' => $milestonesConfig[0]['id'],
            'occurred_at' => '2026-09-14 17:00:00.000000',
            'effective_date' => '2026-09-14',
            'metadata' => json_encode(['name' => $milestonesConfig[0]['name']], JSON_THROW_ON_ERROR),
        ]);

        // 10. Reviews: Add Weekly Review and Monthly Reviews
        $insertReviewStmt = $pdo->prepare(<<<'SQL'
INSERT INTO reviews (id, user_id, kind, period_start, period_end, timezone, snapshot_schema_version, snapshot, reflection, went_well, went_wrong, change_next, status, version, finalized_at, created_at, updated_at)
VALUES (:id, :user_id, :kind, :period_start, :period_end, 'UTC', 1, :snapshot, :reflection, :went_well, :went_wrong, :change_next, 'Finalized', 1, :finalized_at, :created_at, :updated_at)
SQL);

        // Weekly review for last week (2026-10-26 to 2026-11-01)
        $insertReviewStmt->execute([
            'id' => Uuid::uuid4()->toString(),
            'user_id' => $userId,
            'kind' => 'Weekly',
            'period_start' => '2026-10-26',
            'period_end' => '2026-11-01',
            'snapshot' => roadmapDemoReviewSnapshot($pdo, $userId, 'Weekly', '2026-10-26', '2026-11-01', $now->format('Y-m-d H:i:s.u')),
            'reflection' => 'Solid progress on PyTorch distributed training and attention mechanics. Maintained 14-day daily habit streak.',
            'went_well' => 'DDP cluster scaled cleanly to 4 GPUs; completed all planned LeetCode problem sets.',
            'went_wrong' => 'WebSocket order book drift issue occurred during late Friday session.',
            'change_next' => 'Focus on Triton FlashAttention integration early in the week.',
            'finalized_at' => '2026-11-01 21:00:00.000000',
            'created_at' => '2026-11-01 20:30:00.000000',
            'updated_at' => '2026-11-01 21:00:00.000000',
        ]);

        // Monthly review for September
        $insertReviewStmt->execute([
            'id' => Uuid::uuid4()->toString(),
            'user_id' => $userId,
            'kind' => 'Monthly',
            'period_start' => '2026-09-01',
            'period_end' => '2026-09-30',
            'snapshot' => roadmapDemoReviewSnapshot($pdo, $userId, 'Monthly', '2026-09-01', '2026-09-30', $now->format('Y-m-d H:i:s.u')),
            'reflection' => 'Month 1 completed! Solidified Python typing, FastAPI and Foundations milestone.',
            'went_well' => 'Completed Milestone 1 Foundations ahead of schedule.',
            'went_wrong' => 'Initial Docker multi-stage build caching was slow.',
            'change_next' => 'Transition deeper into ML core and vectorization.',
            'finalized_at' => '2026-10-01 10:00:00.000000',
            'created_at' => '2026-09-30 20:00:00.000000',
            'updated_at' => '2026-10-01 10:00:00.000000',
        ]);

        // 11. Notes: Create two helpful study notes
        $insertNoteStmt = $pdo->prepare(<<<'SQL'
INSERT INTO notes (id, user_id, title, content, color, version, created_at, updated_at)
VALUES (:id, :user_id, :title, :content, :color, 1, :created_at, :updated_at)
SQL);
        $insertNoteStmt->execute([
            'id' => Uuid::uuid4()->toString(),
            'user_id' => $userId,
            'title' => 'Triton Kernel Optimization Checklist',
            'content' => "- [x] Ensure tensor memory is 128-byte aligned\n- [x] Maximize L2 cache reuse across thread blocks\n- [ ] Check register spilling with ptxas\n- [ ] Compare roofline model vs cuBLAS baseline",
            'color' => 'sky',
            'created_at' => '2026-10-15 14:00:00.000000',
            'updated_at' => '2026-11-01 16:00:00.000000',
        ]);

        $insertNoteStmt->execute([
            'id' => Uuid::uuid4()->toString(),
            'user_id' => $userId,
            'title' => 'Market Microstructure & Order Book Architecture',
            'content' => "Key principles:\n- L2 vs L3 book representation\n- Tick-to-trade latency measurement points\n- WebSocket ping-pong keepalive intervals\n- Idempotent order client request IDs",
            'color' => 'neutral',
            'created_at' => '2026-09-20 11:00:00.000000',
            'updated_at' => '2026-10-25 15:30:00.000000',
        ]);

        $pdo->commit();
        echo "SUCCESS: roadmap-demo account data seeded successfully.\n";
    } catch (\Throwable $e) {
        $pdo->rollBack();
        echo "ERROR: " . $e->getMessage() . "\n";
        throw $e;
    }
}
