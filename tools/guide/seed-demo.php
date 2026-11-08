<?php

// Creates the demo accounts whose screens illustrate the user guide (one Vietnamese and one
// English account, each with a helper account for Note sharing), through the ordinary
// services. Dates are relative to today so the screenshots always look current.
//
//   php tools/guide/seed-demo.php <file-for-passwords>
//
// It refuses to run when a guide.* account already exists. Demo accounts use @example.test
// addresses and have email off, so nothing is mailed. Passwords are random and written only to
// the given file.

declare(strict_types=1);

use Planner\Application\Notes\NoteLinkService;
use Planner\Http\Validation\InputValidator;
use Planner\Infrastructure\Persistence\Pdo\Notes\PdoNoteLinkRepository;
use Ramsey\Uuid\Uuid;

$passwordFile = $argv[1] ?? exit("Usage: php tools/guide/seed-demo.php <file-for-passwords>\n");
chdir(dirname(__DIR__, 2).'/backend');
$runtime = require 'bootstrap/http.php';
$pdo = $runtime['pdo'];
$database = (string) $pdo->query('SELECT DATABASE()')->fetchColumn();
$accounts = $runtime['account_repository'];
$planning = $runtime['planning_service'];
$habits = $runtime['habit_service'];
$series = $runtime['task_series_service'];
$notes = $runtime['note_service'];
$shares = $runtime['note_share_service'];
$locks = $runtime['note_lock_service'];
$reviews = $runtime['review_service'];
$dashboard = $runtime['dashboard_service'];
$links = new NoteLinkService($notes, $planning, new PdoNoteLinkRepository($pdo), $runtime['transactions'], $runtime['clock'], new InputValidator());

foreach (['guide.vi@example.test', 'guide.en@example.test'] as $email) {
    if ($accounts->findByEmail($email) !== null) {
        exit("Guide demo accounts already exist in $database; nothing changed.\n");
    }
}

$timezone = 'Asia/Ho_Chi_Minh';
$zone = new DateTimeZone($timezone);
$today = new DateTimeImmutable('today', $zone);
$day = static fn (int $offset): string => $today->modify(sprintf('%+d days', $offset))->format('Y-m-d');
/** A local wall-clock time as the UTC instant the Task API stores. */
$at = static fn (int $offset, string $time): string => (new DateTimeImmutable($day($offset).' '.$time, $zone))
    ->setTimezone(new DateTimeZone('UTC'))->format('Y-m-d\TH:i:s\Z');
$v = static fn (array $row): int => (int) $row['version'];
$passwords = [];

/** Creates a verified account with the given language and Asia/Ho_Chi_Minh time zone. */
$account = function (string $email, string $name, string $locale) use ($accounts, $pdo, $timezone, &$passwords): int {
    $password = rtrim(strtr(base64_encode(random_bytes(15)), '+/', 'Ab'), '=');
    $passwords[$email] = $password;
    $user = $accounts->insertUser($email, $name, password_hash($password, PASSWORD_BCRYPT), gmdate('Y-m-d H:i:s').'.000000');
    $pdo->prepare('UPDATE users SET email_verified_at = UTC_TIMESTAMP(6) WHERE id = ?')->execute([$user->id]);
    $pdo->prepare('UPDATE user_preferences SET locale = ?, timezone = ?, email_notifications = 0, walkthrough_dismissed_at = UTC_TIMESTAMP(6), visual_theme = ? WHERE user_id = ?')
        ->execute([$locale, $timezone, 'mountain', $user->id]);

    return $user->id;
};

/** Moves a completion (Task, Milestone) and its Activity to a past local day. */
$backdate = function (string $table, string $type, string $id, string $date, string $time = '19:30:00') use ($pdo, $zone): void {
    $instant = (new DateTimeImmutable("$date $time", $zone))->setTimezone(new DateTimeZone('UTC'))->format('Y-m-d H:i:s.u');
    $pdo->prepare("UPDATE $table SET completed_at = ? WHERE id = ?")->execute([$instant, $id]);
    $pdo->prepare('UPDATE activities SET occurred_at = ?, effective_date = ? WHERE source_type = ? AND source_id = ?')->execute([$instant, $date, $type, $id]);
};

$tag = function (int $userId, string $name, string $color) use ($pdo): int {
    $pdo->prepare('INSERT INTO labels (user_id, parent_id, name, color, position, version, created_at, updated_at) VALUES (?, NULL, ?, ?, 0, 1, UTC_TIMESTAMP(6), UTC_TIMESTAMP(6))')
        ->execute([$userId, $name, $color]);

    return (int) $pdo->lastInsertId();
};

$note = function (int $userId, string $title, string $content, string $color = 'neutral', bool $pinned = false, array $labels = []) use ($notes): string {
    $id = Uuid::uuid4()->toString();
    $created = $notes->create($userId, ['id' => $id, 'title' => $title, 'content' => $content])['note'];
    if ($color !== 'neutral' || $pinned || $labels !== []) {
        $notes->updateAttributes($userId, $id, ['base_version' => $created->version, 'color' => $color, 'is_pinned' => $pinned, 'label_ids' => $labels]);
    }

    return $id;
};

$task = function (int $userId, array $fields) use ($planning): array {
    return $planning->create('task', $userId, $fields);
};

$complete = function (int $userId, array $item, string $type = 'task') use ($planning): array {
    $extra = $type === 'task' ? ['acknowledge_unchecked_items' => true] : ['acknowledge_open_tasks' => true];

    return $planning->transition($type, $userId, (string) $item['id'], 'complete', ['base_version' => (int) $item['version'], ...$extra]);
};

$texts = require __DIR__.'/demo-content.php';

foreach (['vi', 'en'] as $language) {
    $c = $texts[$language];
    $me = $account($c['email'], $c['name'], $language);
    $friend = $account($c['friend_email'], $c['friend_name'], $language);

    // Areas: replace any registration placeholders with the guide's four.
    foreach ($planning->list('area', $me) as $index => $existing) {
        $planning->update('area', $me, (string) $existing['id'], ['name' => $c['areas'][$index] ?? $existing['name'], 'base_version' => $v($existing)]);
    }
    $areas = array_column($planning->list('area', $me), null, 'name');
    foreach ($c['areas'] as $name) {
        $areas[$name] ??= $planning->create('area', $me, ['name' => $name]);
    }
    [$study, $health, $work, $personal] = array_map(static fn (string $name): array => $areas[$name], $c['areas']);

    $tags = [];
    foreach ($c['tags'] as $key => [$name, $color]) {
        $tags[$key] = $tag($me, $name, $color);
    }

    // Goal 1: a full roadmap with ordered Milestones.
    $g = $c['goal1'];
    $goal1 = $planning->create('goal', $me, ['name' => $g['name'], 'area_id' => $study['id'], 'deadline' => $day(75), 'importance' => 5,
        'description' => $g['description'], 'expected_result' => $g['expected_result'], 'completion_criteria' => $g['criteria'], 'icon' => 'book', 'icon_color' => 'teal']);
    $goal1 = $planning->update('goal', $me, (string) $goal1['id'], ['strategy_notes' => $g['strategy'], 'base_version' => $v($goal1)]);
    $milestones = [];
    $previous = null;
    foreach ($g['milestones'] as $index => [$name, $offset]) {
        $milestone = $planning->create('milestone', $me, ['name' => $name, 'goal_id' => $goal1['id'], 'deadline' => $day($offset), 'position' => $index, 'importance' => 4 - min($index, 2)]);
        if ($previous !== null) {
            $milestone = $planning->addDependency($me, (string) $milestone['id'], ['prerequisite_id' => $previous['id'], 'base_version' => $v($milestone)]);
        }
        $milestones[] = $previous = $milestone;
    }
    $taskIds = [];
    foreach ($g['tasks'] as $key => $spec) {
        $fields = ['name' => $spec['name'], 'milestone_id' => $milestones[$spec['milestone']]['id'], 'importance' => $spec['importance'] ?? 3, 'description' => $spec['description'] ?? ''];
        if (isset($spec['due'])) {
            $fields['deadline'] = $day($spec['due']);
        }
        if (isset($spec['start'])) {
            $fields['start_date'] = $day($spec['start']);
        }
        if (isset($spec['slot'])) {
            $fields['scheduled_start'] = $at($spec['slot'][0], $spec['slot'][1]);
            $fields['scheduled_end'] = $at($spec['slot'][0], $spec['slot'][2]);
        }
        if (isset($spec['tags'])) {
            $fields['tag_ids'] = array_map(static fn (string $t): int => $tags[$t], $spec['tags']);
        }
        $created = $task($me, $fields);
        foreach ($spec['checklist'] ?? [] as $position => [$title, $checked]) {
            $item = $planning->createChecklist($me, (string) $created['id'], ['title' => $title, 'position' => $position]);
            if ($checked) {
                $planning->updateChecklist($me, (string) $created['id'], (string) $item['id'], ['checked' => true, 'base_version' => $v($item)]);
            }
        }
        $created = $planning->show('task', $me, (string) $created['id']);
        if (($spec['status'] ?? null) === 'InProgress') {
            $created = $planning->update('task', $me, (string) $created['id'], ['status' => 'InProgress', 'base_version' => $v($created)]);
        }
        if (isset($spec['done'])) {
            $complete($me, $created);
            $backdate('tasks', 'task', (string) $created['id'], $day($spec['done']));
        }
        if (isset($spec['note'])) {
            $planning->saveTaskNote($me, (string) $created['id'], ['body' => $spec['note']]);
        }
        $taskIds[$key] = (string) $created['id'];
    }
    // The first Milestone is finished.
    $first = $planning->show('milestone', $me, (string) $milestones[0]['id']);
    $complete($me, $first, 'milestone');
    $backdate('milestones', 'milestone', (string) $first['id'], $day(-6));

    // Goal 2 (Health) with Milestones, Goal 3 (Work) with Tasks directly inside it.
    $goal2 = $planning->create('goal', $me, ['name' => $c['goal2']['name'], 'area_id' => $health['id'], 'deadline' => $day(110), 'importance' => 4, 'description' => $c['goal2']['description'], 'icon' => 'heart', 'icon_color' => 'rose']);
    $previous = null;
    foreach ($c['goal2']['milestones'] as $index => [$name, $offset]) {
        $milestone = $planning->create('milestone', $me, ['name' => $name, 'goal_id' => $goal2['id'], 'deadline' => $day($offset), 'position' => $index]);
        if ($previous !== null) {
            $milestone = $planning->addDependency($me, (string) $milestone['id'], ['prerequisite_id' => $previous['id'], 'base_version' => $v($milestone)]);
        }
        $previous = $milestone;
        if ($index === 0) {
            $run = $task($me, ['name' => $c['goal2']['task'], 'milestone_id' => $milestone['id'], 'deadline' => $day(2), 'importance' => 3]);
            $taskIds['run'] = (string) $run['id'];
        }
    }
    $goal3 = $planning->create('goal', $me, ['name' => $c['goal3']['name'], 'area_id' => $work['id'], 'deadline' => $day(12), 'importance' => 4, 'description' => $c['goal3']['description'], 'icon' => 'briefcase', 'icon_color' => 'amber']);
    foreach ($c['goal3']['tasks'] as $key => $spec) {
        $fields = ['name' => $spec['name'], 'goal_id' => $goal3['id'], 'importance' => $spec['importance'] ?? 3];
        if (isset($spec['due'])) {
            $fields['deadline'] = $day($spec['due']);
        }
        if (isset($spec['slot'])) {
            $fields['scheduled_start'] = $at($spec['slot'][0], $spec['slot'][1]);
            $fields['scheduled_end'] = $at($spec['slot'][0], $spec['slot'][2]);
        }
        $taskIds[$key] = (string) $task($me, $fields)['id'];
    }
    $planning->create('goal', $me, ['name' => $c['goal4']['name'], 'area_id' => $personal['id'], 'deadline' => $day(150), 'importance' => 2, 'description' => $c['goal4']['description']]);

    // Inbox Tasks: one with a reminder, one without any date (Calendar › Unscheduled).
    foreach ($c['inbox'] as $key => $spec) {
        $fields = ['name' => $spec['name'], 'importance' => $spec['importance'] ?? 3];
        if (isset($spec['due'])) {
            $fields['deadline'] = $day($spec['due']);
        }
        if (isset($spec['remind'])) {
            $fields['reminder_at'] = $at($spec['remind'][0], $spec['remind'][1]);
        }
        $taskIds[$key] = (string) $task($me, $fields)['id'];
    }

    // Finished work over the last eight weeks fills Activity and Task history.
    $doneNames = $c['done'];
    for ($offset = 56, $n = 0; $offset >= 1; $offset--) {
        $count = [0, 1, 2, 1, 3, 0, 2, 1, 4, 2][($offset * 7) % 10];
        for ($k = 0; $k < $count; $k++, $n++) {
            $finished = $task($me, ['name' => $doneNames[$n % count($doneNames)], 'deadline' => $day(-$offset)]);
            $complete($me, $finished);
            $backdate('tasks', 'task', (string) $finished['id'], $day(-$offset), sprintf('%02d:15:00', 8 + ($k * 3) % 12));
        }
    }

    // Repeating work.
    $series->createAndMaterialize($me, ['name' => $c['series_daily'], 'frequency' => 'weekly', 'interval_count' => 1, 'weekdays' => [1, 3, 5], 'start_date' => $day(0),
        'timezone' => $timezone, 'local_time' => '07:00', 'duration_minutes' => 20, 'milestone_id' => $milestones[1]['id']]);
    $series->createAndMaterialize($me, ['name' => $c['series_weekly'], 'frequency' => 'weekly', 'interval_count' => 1, 'weekdays' => [6], 'start_date' => $day(0),
        'timezone' => $timezone, 'local_time' => '09:00', 'duration_minutes' => 60]);

    // Habits with three weeks of check-ins.
    foreach ($c['habits'] as $index => $spec) {
        $habit = $habits->create($me, ['name' => $spec['name'], 'description' => $spec['description'], 'period' => $spec['period'], 'target_frequency' => $spec['target'],
            'timezone' => $timezone, 'importance' => $spec['importance'], 'primary_goal_id' => $spec['goal'] === 2 ? $goal2['id'] : ($spec['goal'] === 1 ? $goal1['id'] : null), 'icon' => $spec['icon']]);
        for ($offset = 21; $offset >= 1; $offset--) {
            if (in_array(($offset + $index) % $spec['every'], $spec['days'], true)) {
                $habits->checkIn($me, (string) $habit['id'], $day(-$offset));
            }
        }
        if ($index === 0) {
            $habits->checkIn($me, (string) $habit['id'], $day(0));
            $habits->rest($me, (string) $habit['id'], $day(2));
        }
    }

    // Dashboard: Goal 1 as the roadmap, a few Tasks for Today and This week.
    $dashboard->updateRoadmap($me, ['goal_id' => $goal1['id']]);
    foreach (['today_listening', 'docs'] as $key) {
        $dashboard->addDailySelection($me, ['id' => $taskIds[$key]]);
    }
    foreach (['vocabulary', 'writing', 'slides', 'run'] as $position => $key) {
        $dashboard->addSelection('task', $me, ['id' => $taskIds[$key], 'position' => $position]);
    }
    $dashboard->addSelection('milestone', $me, ['id' => $milestones[1]['id'], 'position' => 0]);

    // Notes: pinned checklist, colours, tags, a link to Goal 1, a password and sharing.
    $n = $c['notes'];
    $plan = $note($me, $n['plan'][0], $n['plan'][1], 'lemon', true, [$tags['english']]);
    $vocabulary = $note($me, $n['vocabulary'][0], $n['vocabulary'][1], 'mint', false, [$tags['english']]);
    $links->link($me, $vocabulary, ['goal_id' => $goal1['id']]);
    $note($me, $n['ideas'][0], $n['ideas'][1], 'sky', false, [$tags['project']]);
    $note($me, $n['recipe'][0], $n['recipe'][1], 'rose');
    $note($me, $n['books'][0], $n['books'][1]);
    $secret = $note($me, $n['secret'][0], $n['secret'][1]);
    $locks->enable($me, $secret, ['password' => 'demo-1234', 'password_confirmation' => 'demo-1234']);
    $sharedNote = $note($me, $n['shared'][0], $n['shared'][1], 'sky', false, [$tags['project']]);
    $share = $shares->shareMany($me, $sharedNote, [$c['friend_email']], 'edit');
    $shares->respond($friend, $share[0]['id'], true);
    $fromFriend = $note($friend, $n['from_friend'][0], $n['from_friend'][1], 'mint');
    $shares->respond($me, $shares->shareMany($friend, $fromFriend, [$c['email']], 'view')[0]['id'], true);
    // A pending invitation waits in the bell.
    $shares->shareMany($friend, $note($friend, $n['invite'][0], $n['invite'][1]), [$c['email']], 'edit');

    // A weekly Review with reflections.
    $review = $reviews->create($me, ['kind' => 'Weekly', 'date' => $day(-7)]);
    $reviews->update($me, (string) $review['id'], ['base_version' => $v($review)] + $c['review']);

    // Archive: a Goal archived together with its Milestone and Tasks.
    $old = $planning->create('goal', $me, ['name' => $c['archived']['name'], 'area_id' => $personal['id']]);
    $oldMilestone = $planning->create('milestone', $me, ['name' => $c['archived']['milestone'], 'goal_id' => $old['id']]);
    foreach ($c['archived']['tasks'] as $name) {
        $task($me, ['name' => $name, 'milestone_id' => $oldMilestone['id']]);
    }
    $old = $planning->show('goal', $me, (string) $old['id']);
    $planning->archive('goal', $me, (string) $old['id'], ['base_version' => $v($old), 'include_contents' => true]);
    $pdo->prepare('UPDATE goals SET archived_at = archived_at - INTERVAL 3 DAY WHERE id = ?')->execute([$old['id']]);
    $pdo->prepare('UPDATE milestones SET archived_at = archived_at - INTERVAL 3 DAY WHERE goal_id = ?')->execute([$old['id']]);
    $pdo->prepare('UPDATE tasks SET archived_at = archived_at - INTERVAL 3 DAY WHERE milestone_id = ?')->execute([$oldMilestone['id']]);

    echo "Created {$c['email']} and {$c['friend_email']} in $database.\n";
}

$lines = ["Planner user-guide demo accounts ($database)", ''];
foreach ($passwords as $email => $password) {
    $lines[] = "$email  $password";
}
$lines[] = '';
$lines[] = 'Locked demo note password: demo-1234';
file_put_contents($passwordFile, implode("\n", $lines)."\n");
chmod($passwordFile, 0600);
echo "Passwords written to $passwordFile\n";
