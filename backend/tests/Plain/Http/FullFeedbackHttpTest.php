<?php

declare(strict_types=1);

namespace Tests\Plain\Http;

use PDO;
use PHPUnit\Framework\TestCase;
use Planner\Domain\Account\Totp;
use Planner\Http\Application;
use Planner\Http\Request;
use Planner\Http\Response;
use Planner\Infrastructure\Database\MigrationRunner;
use Planner\Infrastructure\Session\SessionManager;
use RuntimeException;

/** Sharing, reports/locking, two-factor login and notifications. */
final class FullFeedbackHttpTest extends TestCase
{
    /** @var array<string, mixed> */
    private array $runtime;

    private Application $application;

    private SessionManager $session;

    private PDO $pdo;

    protected function setUp(): void
    {
        if (session_status() === PHP_SESSION_ACTIVE) {
            session_write_close();
        }
        session_id('');
        $_SESSION = [];
        $_COOKIE = [];
        $this->runtime = require dirname(__DIR__, 3).'/bootstrap/http.php';
        $this->application = $this->runtime['application'];
        $this->session = $this->runtime['session'];
        $this->pdo = $this->runtime['pdo'];
        self::assertSame('goals_test', $this->pdo->query('SELECT DATABASE()')->fetchColumn());
        $this->wipeTargetDatabase();
        (new MigrationRunner($this->pdo, dirname(__DIR__, 3).'/database/plain-migrations', 'goals_test'))->migrate();
    }

    protected function tearDown(): void
    {
        $this->session->close();
        session_id('');
        $_SESSION = [];
        $_COOKIE = [];
    }

    public function test_owner_controls_note_sharing_permissions_and_notifications(): void
    {
        $owner = $this->registerAccount('owner@example.test', 'Owner');
        $friend = $this->registerAccount('friend@example.test', 'Friend');
        $stranger = $this->registerAccount('stranger@example.test', 'Stranger');
        $noteId = '0b9c4b5e-2f3a-4c1d-9e8f-1a2b3c4d5e6f';
        self::assertSame(201, $this->api('POST', '/api/v1/notes', ['id' => $noteId, 'title' => 'Plan', 'content' => 'First draft'], $owner)->status);

        // Sharing validates that every address belongs to a registered account (approved
        // rubric behavior: the owner learns about a typo instead of a silent no-op).
        $unknown = $this->api('POST', "/api/v1/notes/$noteId/shares", ['email' => 'nobody@example.test', 'permission' => 'view'], $owner);
        self::assertSame(422, $unknown->status);
        self::assertStringContainsString('nobody@example.test', json_decode($unknown->body, true)['errors']['emails'][0]);
        self::assertSame([], $this->data($this->api('GET', "/api/v1/notes/$noteId/shares", [], $owner)));
        self::assertSame(404, $this->api('POST', "/api/v1/notes/$noteId/shares", ['email' => 'owner@example.test'], $stranger)->status);

        $shares = $this->data($this->api('POST', "/api/v1/notes/$noteId/shares", ['email' => 'friend@example.test', 'permission' => 'view'], $owner));
        self::assertSame('pending', $shares[0]['status']);
        $shareId = $shares[0]['id'];
        $inbox = $this->data($this->api('GET', '/api/v1/notifications', [], $friend));
        self::assertSame('share_invite', $inbox['items'][0]['type']);
        self::assertSame(404, $this->api('GET', "/api/v1/shared-notes/$noteId", [], $friend)->status);

        self::assertSame(200, $this->api('POST', "/api/v1/shared-notes/invitations/$shareId/accept", [], $friend)->status);
        self::assertSame('share_joined', $this->data($this->api('GET', '/api/v1/notifications', [], $owner))['items'][0]['type']);
        $shared = $this->data($this->api('GET', "/api/v1/shared-notes/$noteId", [], $friend));
        self::assertSame('First draft', $shared['content']);
        self::assertSame('view', $shared['permission']);
        self::assertSame(403, $this->api('PATCH', "/api/v1/shared-notes/$noteId", ['base_version' => 1, 'title' => 'Plan', 'content' => 'Edited'], $friend)->status);
        self::assertSame(404, $this->api('GET', "/api/v1/shared-notes/$noteId", [], $stranger)->status);

        $this->api('PATCH', "/api/v1/notes/$noteId/shares/$shareId", ['permission' => 'edit'], $owner);
        $edited = $this->api('PATCH', "/api/v1/shared-notes/$noteId", ['base_version' => 1, 'title' => 'Plan', 'content' => 'Edited together'], $friend);
        self::assertSame(200, $edited->status);
        self::assertSame(2, $this->data($edited)['version']);
        self::assertSame(409, $this->api('PATCH', "/api/v1/shared-notes/$noteId", ['base_version' => 1, 'title' => 'Plan', 'content' => 'Stale'], $friend)->status);
        self::assertSame(422, $this->api('PATCH', "/api/v1/shared-notes/$noteId", ['base_version' => 2, 'title' => 'Plan', 'content' => 'x', 'color' => 'rose'], $friend)->status);
        $ownerView = $this->data($this->api('GET', "/api/v1/notes/$noteId", [], $owner));
        self::assertSame('Edited together', $ownerView['content']);
        $ownerInbox = $this->data($this->api('GET', '/api/v1/notifications', [], $owner));
        self::assertSame('shared_note_updated', $ownerInbox['items'][0]['type']);
        self::assertSame(0, (int) $this->pdo->query("SELECT COUNT(*) FROM notifications n JOIN users u ON u.id = n.user_id WHERE u.email = 'friend@example.test' AND n.type = 'shared_note_updated'")->fetchColumn());

        $this->api('DELETE', "/api/v1/notes/$noteId/shares/$shareId", [], $owner);
        self::assertSame(404, $this->api('GET', "/api/v1/shared-notes/$noteId", [], $friend)->status);
    }

    public function test_reports_reach_admins_and_locked_accounts_lose_access(): void
    {
        $owner = $this->registerAccount('author@example.test', 'Author');
        $reader = $this->registerAccount('reader@example.test', 'Reader');
        $admin = $this->registerAccount('admin@example.test', 'Admin');
        $this->pdo->exec("UPDATE users SET role = 'admin' WHERE email = 'admin@example.test'");
        $noteId = '1c9c4b5e-2f3a-4c1d-9e8f-1a2b3c4d5e6f';
        $this->api('POST', '/api/v1/notes', ['id' => $noteId, 'title' => 'Bad', 'content' => 'Abusive text'], $owner);
        $shareId = $this->data($this->api('POST', "/api/v1/notes/$noteId/shares", ['email' => 'reader@example.test'], $owner))[0]['id'];
        $this->api('POST', "/api/v1/shared-notes/invitations/$shareId/accept", [], $reader);

        self::assertSame(404, $this->api('GET', '/api/v1/admin/reports', [], $reader)->status);
        self::assertSame(201, $this->api('POST', "/api/v1/shared-notes/$noteId/report", ['reason' => 'Harassment'], $reader)->status);
        self::assertSame(422, $this->api('POST', "/api/v1/shared-notes/$noteId/report", ['reason' => 'Again'], $reader)->status);
        $reports = $this->data($this->api('GET', '/api/v1/admin/reports', [], $admin));
        self::assertCount(1, $reports);
        self::assertSame('Abusive text', $reports[0]['note']['excerpt']);
        self::assertSame('report_new', $this->data($this->api('GET', '/api/v1/notifications', [], $admin))['items'][0]['type']);

        self::assertSame(200, $this->api('POST', '/api/v1/admin/reports/'.$reports[0]['id'].'/resolve', ['status' => 'resolved', 'response' => 'Sharing stopped', 'actions' => ['revoke_shares']], $admin)->status);
        self::assertSame('report_resolved', $this->data($this->api('GET', '/api/v1/notifications', [], $reader))['items'][0]['type']);

        $ownerId = $reports[0]['owner']['id'];
        $adminId = (string) $this->pdo->query("SELECT id FROM users WHERE email = 'admin@example.test'")->fetchColumn();
        self::assertSame(422, $this->api('POST', "/api/v1/admin/users/$adminId/lock", [], $admin)->status);
        self::assertSame(200, $this->api('POST', "/api/v1/admin/users/$ownerId/lock", ['reason' => 'Abuse'], $admin)->status);
        self::assertSame(401, $this->api('GET', '/api/v1/session', [], $owner)->status);
        $login = $this->login('author@example.test');
        self::assertSame('/login', $login->headers['Location']);
        self::assertNull($this->session->userId());

        $this->api('POST', "/api/v1/admin/users/$ownerId/unlock", [], $admin);
        self::assertSame('/dashboard', $this->login('author@example.test')->headers['Location']);
        self::assertSame(100, $this->data($this->api('PATCH', '/api/v1/admin/settings', ['history_limit' => 100], $admin))['history_limit']);
    }

    public function test_totp_two_factor_login_requires_a_valid_code(): void
    {
        $user = $this->registerAccount('secure@example.test', 'Secure');
        $setup = $this->data($this->api('POST', '/api/v1/two-factor/totp', [], $user));
        self::assertStringStartsWith('otpauth://totp/', $setup['uri']);
        self::assertSame(422, $this->api('POST', '/api/v1/two-factor/totp/confirm', ['code' => '000000'], $user)->status);
        $code = Totp::code($setup['secret'], $this->runtime['clock']->now()->getTimestamp());
        self::assertSame('totp', $this->data($this->api('POST', '/api/v1/two-factor/totp/confirm', ['code' => $code], $user))['method']);
        self::assertNotSame($setup['secret'], $this->pdo->query("SELECT two_factor_secret FROM users WHERE email = 'secure@example.test'")->fetchColumn());

        $login = $this->login('secure@example.test');
        self::assertSame('/two-factor', $login->headers['Location']);
        $cookie = $this->session->id();
        self::assertNull($this->session->userId());
        self::assertSame(401, $this->request('GET', '/api/v1/session', cookie: $cookie)->status);
        $page = $this->request('GET', '/two-factor', cookie: $cookie);
        preg_match('/name="_token" value="([a-f0-9]{64})"/', $page->body, $token);
        $wrong = $this->request('POST', '/two-factor', ['_token' => $token[1], 'code' => '000000'], $cookie);
        self::assertSame('/two-factor', $wrong->headers['Location']);
        $right = $this->request('POST', '/two-factor', ['_token' => $token[1], 'code' => Totp::code($setup['secret'], $this->runtime['clock']->now()->getTimestamp())], $cookie);
        self::assertSame('/dashboard', $right->headers['Location']);
        self::assertSame(200, $this->request('GET', '/api/v1/session', cookie: $this->session->id())->status);
    }

    public function test_retired_teamwork_routes_return_404_for_guests_and_signed_in_accounts(): void
    {
        $owner = $this->registerAccount('personal@example.test', 'Personal');
        foreach (['/teamwork', '/api/v1/team-goals', '/api/v1/team-tasks/assigned', '/api/v1/team-goals/old', '/api/v1/team-goals/old/tasks', '/api/v1/team-goals/old/members', '/api/v1/team-goals/old/messages', '/api/v1/team-goals/old/invitation/accept'] as $path) {
            foreach (['GET', 'POST', 'PATCH', 'DELETE'] as $method) {
                self::assertSame(404, $this->api($method, $path, [], $owner)->status, "$method $path");
                self::assertSame(404, $this->request($method, $path)->status, "guest $method $path");
            }
        }
    }

    public function test_note_sharing_contacts_remain_scoped_without_teamwork(): void
    {
        $owner = $this->registerAccount('contact-owner@example.test', 'Owner');
        $friend = $this->registerAccount('contact-friend@example.test', 'Friend');
        $stranger = $this->registerAccount('contact-stranger@example.test', 'Stranger');
        $noteId = $this->runtime['uuid']->generate();
        $this->api('POST', '/api/v1/notes', ['id' => $noteId, 'title' => 'Shared note', 'content' => 'x'], $owner);
        $share = $this->data($this->api('POST', "/api/v1/notes/$noteId/shares", ['email' => 'contact-friend@example.test'], $owner))[0];
        self::assertSame([], $this->data($this->api('GET', '/api/v1/contacts', [], $owner)));
        $this->api('POST', '/api/v1/shared-notes/invitations/'.$share['id'].'/accept', [], $friend);
        self::assertSame(['contact-friend@example.test'], array_column($this->data($this->api('GET', '/api/v1/contacts', [], $owner)), 'email'));
        self::assertSame(['contact-owner@example.test'], array_column($this->data($this->api('GET', '/api/v1/contacts', [], $friend)), 'email'));
        self::assertSame([], $this->data($this->api('GET', '/api/v1/contacts', [], $stranger)));
        $this->api('DELETE', "/api/v1/notes/$noteId/shares/".$share['id'], [], $owner);
        self::assertSame([], $this->data($this->api('GET', '/api/v1/contacts', [], $owner)));
        self::assertSame([], $this->data($this->api('GET', '/api/v1/contacts', [], $friend)));
        self::assertSame(401, $this->request('GET', '/api/v1/contacts')->status);
    }

    public function test_retired_notifications_are_preserved_without_entering_the_bell_or_badge(): void
    {
        $owner = $this->registerAccount('old-notifications@example.test', 'Owner');
        $stranger = $this->registerAccount('other-notifications@example.test', 'Other');
        $id = (int) $this->pdo->query("SELECT id FROM users WHERE email = 'old-notifications@example.test'")->fetchColumn();
        $insert = $this->pdo->prepare('INSERT INTO notifications (id, user_id, type, payload, created_at) VALUES (?, ?, ?, ?, UTC_TIMESTAMP(6))');
        foreach (['team_invite', 'team_joined', 'team_task_assigned', 'share_invite'] as $type) {
            $insert->execute([$this->runtime['uuid']->generate(), $id, $type, json_encode(['title' => 'Saved notification', 'url' => '/'], JSON_THROW_ON_ERROR)]);
        }
        $inbox = $this->data($this->api('GET', '/api/v1/notifications', [], $owner));
        self::assertSame(['share_invite'], array_column($inbox['items'], 'type'));
        self::assertSame(1, $inbox['unread']);
        self::assertSame([], $this->data($this->api('GET', '/api/v1/notifications', [], $stranger))['items']);
        $this->api('POST', '/api/v1/notifications/read', [], $owner);
        self::assertSame(0, $this->data($this->api('GET', '/api/v1/notifications', [], $owner))['unread']);
        self::assertSame(3, (int) $this->pdo->query("SELECT COUNT(*) FROM notifications WHERE user_id = $id AND LEFT(type, 5) = 'team_' AND read_at IS NULL")->fetchColumn());
    }

    public function test_changed_pages_render_their_new_controls(): void
    {
        $user = $this->registerAccount('pages@example.test', 'Pages');
        $expectations = [
            '/tasks' => ['data-schedule-open="repeat"', 'data-task-view="repeating"', 'data-task-completed'],
            '/' => ['data-view-toggle', 'data-note-sort', 'data-filter-shared', 'data-editor-save', 'data-color-custom'],
            '/calendar' => ['data-calendar-page', 'data-calendar-grid', 'data-calendar-unscheduled', 'data-calendar-day-add'],
            '/habits' => ['habit-description'],
            '/dashboard' => ['data-activity-years'],
            '/settings/history' => ['data-history-rules'],
            '/settings/password' => ['data-two-factor-settings'],
            '/settings/preferences' => ['personal-background-dialog'],
            '/settings/archive' => ['data-archive-settings', 'data-archive-type'],
            '/help' => ['data-guide-page', 'guide-toc', 'data-walkthrough-full-guide'],
        ];
        foreach ($expectations as $path => $needles) {
            $page = $this->request('GET', $path, cookie: $user[0]);
            self::assertSame(200, $page->status, $path);
            self::assertStringContainsString('data-notifications-toggle', $page->body, $path);
            self::assertStringContainsString('data-assistant-open', $page->body, $path);
            self::assertStringNotContainsString('href="/teamwork"', $page->body, $path);
            self::assertStringNotContainsString('data-dashboard-team', $page->body, $path);
            self::assertStringNotContainsString('href="/ai" data-leave-guard>'."\n".'                        <svg', $page->body, $path);
            foreach ($needles as $needle) {
                self::assertStringContainsString($needle, $page->body, "$path lacks $needle");
            }
        }
        self::assertStringNotContainsString('Recurring tasks', $this->request('GET', '/habits', cookie: $user[0])->body);
        self::assertSame(404, $this->request('GET', '/admin', cookie: $user[0])->status);
        $this->pdo->exec("UPDATE users SET role = 'admin' WHERE email = 'pages@example.test'");
        $admin = $this->request('GET', '/admin', cookie: $user[0]);
        self::assertSame(200, $admin->status);
        self::assertStringContainsString('data-admin-page', $admin->body);
    }

    public function test_archive_lists_archived_items_and_restores_a_goal_with_what_was_archived_with_it(): void
    {
        $owner = $this->registerAccount('archive@example.test', 'Archive owner');
        $stranger = $this->registerAccount('archive-stranger@example.test', 'Stranger');
        $userId = (int) $this->pdo->query("SELECT id FROM users WHERE email = 'archive@example.test'")->fetchColumn();
        $planning = $this->runtime['planning_service'];
        $area = $planning->list('area', $userId)[0];
        $goal = $planning->create('goal', $userId, ['name' => 'Learn Rust', 'area_id' => $area['id']]);
        $milestone = $planning->create('milestone', $userId, ['name' => 'Basics', 'goal_id' => $goal['id']]);
        $inside = $planning->create('task', $userId, ['name' => 'Read the book', 'milestone_id' => $milestone['id']]);
        $direct = $planning->create('task', $userId, ['name' => 'Install rustup', 'goal_id' => $goal['id']]);
        $earlier = $planning->create('task', $userId, ['name' => 'Old idea', 'goal_id' => $goal['id']]);
        $inbox = $planning->create('task', $userId, ['name' => 'Inbox chore']);
        // Archived on its own an hour before the Goal: it must not come back with the Goal.
        $planning->archive('task', $userId, $earlier['id'], ['base_version' => (int) $earlier['version']]);
        $this->pdo->exec("UPDATE tasks SET archived_at = archived_at - INTERVAL 1 HOUR WHERE id = '{$earlier['id']}'");
        $planning->archive('task', $userId, $inbox['id'], ['base_version' => (int) $inbox['version']]);
        $goal = $planning->show('goal', $userId, $goal['id']);
        self::assertSame(200, $this->api('DELETE', '/api/v1/goals/'.$goal['id'], ['base_version' => (int) $goal['version'], 'include_contents' => true], $owner)->status);

        $page = $this->request('GET', '/settings/archive', cookie: $owner[0]);
        self::assertSame(200, $page->status);
        self::assertStringContainsString('data-archive-list', $page->body);
        self::assertStringContainsString('href="/settings/archive"', $page->body);

        $items = $this->data($this->api('GET', '/api/v1/archive', [], $owner));
        $byName = array_column($items, null, 'name');
        // The Milestone and its Tasks are folded into the Goal; separately archived Tasks are listed.
        self::assertSame(['Learn Rust', 'Inbox chore', 'Old idea'], array_column($items, 'name'));
        self::assertSame(3, $byName['Learn Rust']['contents']);
        self::assertSame(['type' => 'area', 'id' => $area['id'], 'name' => $area['name'], 'archived' => false], $byName['Learn Rust']['parent']);
        self::assertTrue($byName['Old idea']['parent']['archived']);
        self::assertSame([], $this->data($this->api('GET', '/api/v1/archive', [], $stranger)));

        // Inside an archived Goal, a stale version, a foreign owner: nothing is restored.
        $blocked = $this->api('POST', '/api/v1/archive/task/'.$earlier['id'].'/restore', ['base_version' => $byName['Old idea']['version']], $owner);
        self::assertSame(422, $blocked->status);
        self::assertStringContainsString('Learn Rust', $blocked->body);
        self::assertSame(409, $this->api('POST', '/api/v1/archive/goal/'.$goal['id'].'/restore', ['base_version' => 1], $owner)->status);
        self::assertSame(404, $this->api('POST', '/api/v1/archive/goal/'.$goal['id'].'/restore', ['base_version' => $byName['Learn Rust']['version']], $stranger)->status);
        self::assertSame(404, $this->api('POST', '/api/v1/archive/note/'.$goal['id'].'/restore', ['base_version' => 1], $owner)->status);
        self::assertSame(419, $this->request('POST', '/api/v1/archive/goal/'.$goal['id'].'/restore', ['base_version' => $byName['Learn Rust']['version']], $owner[0], null, true)->status);

        $restored = $this->api('POST', '/api/v1/archive/goal/'.$goal['id'].'/restore', ['base_version' => $byName['Learn Rust']['version']], $owner);
        self::assertSame(200, $restored->status);
        self::assertSame(4, $this->data($restored)['restored']);
        foreach ([['goal', $goal['id']], ['milestone', $milestone['id']], ['task', $inside['id']], ['task', $direct['id']]] as [$type, $id]) {
            self::assertNull($planning->show($type, $userId, $id)['archived_at'], "$type $id");
        }
        self::assertSame(['Inbox chore', 'Old idea'], array_column($this->data($this->api('GET', '/api/v1/archive', [], $owner)), 'name'));
        // Now its Goal is active, the earlier Task can come back on its own.
        self::assertSame(200, $this->api('POST', '/api/v1/archive/task/'.$earlier['id'].'/restore', ['base_version' => $byName['Old idea']['version']], $owner)->status);
        self::assertSame(422, $this->api('POST', '/api/v1/archive/task/'.$earlier['id'].'/restore', ['base_version' => $byName['Old idea']['version'] + 1], $owner)->status);
    }

    public function test_archive_restores_an_area_only_below_the_active_area_limit(): void
    {
        $owner = $this->registerAccount('areas@example.test', 'Areas');
        $userId = (int) $this->pdo->query("SELECT id FROM users WHERE email = 'areas@example.test'")->fetchColumn();
        $planning = $this->runtime['planning_service'];
        $areas = $planning->list('area', $userId);
        $planning->archive('area', $userId, $areas[0]['id'], ['base_version' => (int) $areas[0]['version']]);
        for ($count = count($areas) - 1; $count < 4; $count++) {
            $planning->create('area', $userId, ['name' => 'Extra '.$count]);
        }
        $item = $this->data($this->api('GET', '/api/v1/archive', [], $owner))[0];
        self::assertSame(['area', $areas[0]['id']], [$item['type'], $item['id']]);

        $full = $this->api('POST', '/api/v1/archive/area/'.$item['id'].'/restore', ['base_version' => $item['version']], $owner);
        self::assertSame(422, $full->status);
        self::assertStringContainsString('four active Areas', $full->body);

        $extra = array_values(array_filter($planning->list('area', $userId), static fn (array $area): bool => str_starts_with($area['name'], 'Extra')))[0];
        $planning->archive('area', $userId, $extra['id'], ['base_version' => (int) $extra['version']]);
        self::assertSame(200, $this->api('POST', '/api/v1/archive/area/'.$item['id'].'/restore', ['base_version' => $item['version']], $owner)->status);
    }

    public function test_user_guide_is_written_per_language_and_every_screenshot_exists(): void
    {
        self::assertSame(302, $this->request('GET', '/help')->status);
        $user = $this->registerAccount('guide-reader@example.test', 'Reader');
        $public = dirname(__DIR__, 3).'/public';
        foreach (['en' => 'What is Planner?', 'vi' => 'Planner là gì?'] as $language => $heading) {
            $this->pdo->exec("UPDATE user_preferences SET locale = '$language' WHERE user_id = (SELECT id FROM users WHERE email = 'guide-reader@example.test')");
            $page = $this->request('GET', '/help', cookie: $user[0]);
            self::assertSame(200, $page->status);
            self::assertStringContainsString('lang="'.$language.'"', $page->body);
            self::assertStringContainsString($heading, $page->body);
            self::assertStringContainsString('href="/help"', $page->body);
            preg_match_all('#src="(/guide/'.$language.'/[a-z-]+\.webp)"#', $page->body, $images);
            self::assertGreaterThan(20, count(array_unique($images[1])));
            foreach (array_unique($images[1]) as $image) {
                self::assertFileExists($public.$image);
            }
            // Every table-of-contents link points at a section on the page.
            preg_match_all('#<a href="\#([a-z-]+)">#', $page->body, $anchors);
            foreach ($anchors[1] as $anchor) {
                self::assertStringContainsString('id="'.$anchor.'"', $page->body);
            }
        }
    }

    public function test_archive_deletes_an_item_with_its_contents_for_good_and_can_empty_the_rest(): void
    {
        $owner = $this->registerAccount('purge@example.test', 'Purge');
        $stranger = $this->registerAccount('purge-stranger@example.test', 'Stranger');
        $userId = (int) $this->pdo->query("SELECT id FROM users WHERE email = 'purge@example.test'")->fetchColumn();
        $planning = $this->runtime['planning_service'];
        $area = $planning->list('area', $userId)[0];
        $goal = $planning->create('goal', $userId, ['name' => 'Old plan', 'area_id' => $area['id']]);
        $milestone = $planning->create('milestone', $userId, ['name' => 'Old stage', 'goal_id' => $goal['id']]);
        $task = $planning->create('task', $userId, ['name' => 'Old step', 'milestone_id' => $milestone['id']]);
        $planning->createChecklist($userId, (string) $task['id'], ['title' => 'Sub-step']);
        $habit = $this->runtime['habit_service']->create($userId, ['name' => 'Keep going', 'timezone' => 'UTC', 'primary_goal_id' => $goal['id']]);
        $this->runtime['dashboard_service']->updateRoadmap($userId, ['goal_id' => $goal['id']]);
        $kept = $planning->create('goal', $userId, ['name' => 'Current plan', 'area_id' => $area['id']]);
        $keptTask = $planning->create('task', $userId, ['name' => 'Current step', 'goal_id' => $kept['id']]);
        $loose = $planning->create('task', $userId, ['name' => 'Loose end']);
        $planning->archive('task', $userId, (string) $loose['id'], ['base_version' => (int) $loose['version']]);
        $goal = $planning->show('goal', $userId, (string) $goal['id']);
        self::assertSame(200, $this->api('DELETE', '/api/v1/goals/'.$goal['id'], ['base_version' => (int) $goal['version'], 'include_contents' => true], $owner)->status);
        $items = array_column($this->data($this->api('GET', '/api/v1/archive', [], $owner)), null, 'name');

        // Refused: an active item, a stale version, another account, a missing confirmation.
        self::assertSame(422, $this->api('DELETE', '/api/v1/archive/goal/'.$kept['id'], ['base_version' => (int) $kept['version']], $owner)->status);
        self::assertSame(409, $this->api('DELETE', '/api/v1/archive/goal/'.$goal['id'], ['base_version' => 1], $owner)->status);
        self::assertSame(404, $this->api('DELETE', '/api/v1/archive/goal/'.$goal['id'], ['base_version' => $items['Old plan']['version']], $stranger)->status);
        self::assertSame(422, $this->api('POST', '/api/v1/archive/empty', [], $owner)->status);

        $deleted = $this->api('DELETE', '/api/v1/archive/goal/'.$goal['id'], ['base_version' => $items['Old plan']['version']], $owner);
        self::assertSame(200, $deleted->status);
        self::assertSame(3, $this->data($deleted)['deleted']);
        foreach (['goals' => $goal['id'], 'milestones' => $milestone['id'], 'tasks' => $task['id']] as $table => $id) {
            self::assertSame(0, (int) $this->pdo->query("SELECT COUNT(*) FROM $table WHERE id = '$id'")->fetchColumn(), $table);
        }
        self::assertSame(0, (int) $this->pdo->query("SELECT COUNT(*) FROM checklist_items WHERE task_id = '{$task['id']}'")->fetchColumn());
        // What stays only loses its link: the Habit and the Dashboard roadmap choice.
        self::assertNull($this->pdo->query("SELECT primary_goal_id FROM habits WHERE id = '{$habit['id']}'")->fetchColumn() ?: null);
        self::assertNull($this->pdo->query("SELECT dashboard_roadmap_goal_id FROM user_preferences WHERE user_id = $userId")->fetchColumn() ?: null);
        self::assertSame(['Loose end'], array_column($this->data($this->api('GET', '/api/v1/archive', [], $owner)), 'name'));

        $emptied = $this->api('POST', '/api/v1/archive/empty', ['confirm' => true], $owner);
        self::assertSame(['deleted' => 1], $this->data($emptied));
        self::assertSame([], $this->data($this->api('GET', '/api/v1/archive', [], $owner)));
        self::assertSame('Current step', $planning->show('task', $userId, (string) $keptTask['id'])['name']);
    }

    public function test_an_administrator_deletes_an_ordinary_account_after_typing_its_email(): void
    {
        $admin = $this->registerAccount('chief@example.test', 'Chief');
        $member = $this->registerAccount('leaving@example.test', 'Leaving');
        $this->pdo->exec("UPDATE users SET role = 'admin' WHERE email = 'chief@example.test'");
        $adminId = (int) $this->pdo->query("SELECT id FROM users WHERE email = 'chief@example.test'")->fetchColumn();
        $memberId = (int) $this->pdo->query("SELECT id FROM users WHERE email = 'leaving@example.test'")->fetchColumn();
        // The leaving account shares a Note with the administrator and owns a personal Goal and Task.
        $noteId = $this->runtime['uuid']->generate();
        $this->runtime['note_service']->create($memberId, ['id' => $noteId, 'title' => 'Shared plan', 'content' => 'x']);
        $share = $this->runtime['note_share_service']->shareMany($memberId, $noteId, ['chief@example.test'], 'view');
        $this->runtime['note_share_service']->respond($adminId, $share[0]['id'], true);
        $planning = $this->runtime['planning_service'];
        $area = $planning->list('area', $memberId)[0];
        $goal = $planning->create('goal', $memberId, ['name' => 'Their goal', 'area_id' => $area['id']]);
        $task = $planning->create('task', $memberId, ['name' => 'Their task', 'goal_id' => $goal['id']]);

        self::assertSame(404, $this->api('DELETE', '/api/v1/admin/users/'.$adminId, ['confirm_email' => 'chief@example.test'], $member)->status);
        self::assertSame(422, $this->api('DELETE', '/api/v1/admin/users/'.$memberId, ['confirm_email' => 'someone@example.test'], $admin)->status);
        self::assertSame(422, $this->api('DELETE', '/api/v1/admin/users/'.$adminId, ['confirm_email' => 'chief@example.test'], $admin)->status);

        $deleted = $this->api('DELETE', '/api/v1/admin/users/'.$memberId, ['confirm_email' => ' LEAVING@example.test '], $admin);
        self::assertSame(200, $deleted->status);
        self::assertSame(['deleted' => 'leaving@example.test'], $this->data($deleted));
        self::assertSame(0, (int) $this->pdo->query("SELECT COUNT(*) FROM users WHERE id = $memberId")->fetchColumn());
        foreach (['notes' => "id = '$noteId'", 'note_shares' => "note_id = '$noteId'", 'goals' => "id = '{$goal['id']}'", 'tasks' => "id = '{$task['id']}'", 'sessions' => "user_id = $memberId"] as $table => $where) {
            self::assertSame(0, (int) $this->pdo->query("SELECT COUNT(*) FROM $table WHERE $where")->fetchColumn(), $table);
        }
        self::assertSame('leaving@example.test', $this->pdo->query("SELECT summary FROM admin_actions WHERE action = 'account.delete'")->fetchColumn());
        // The deleted account's session no longer works.
        self::assertSame(401, $this->api('GET', '/api/v1/notes', [], $member)->status);
    }

    public function test_people_delete_their_own_account_with_their_password(): void
    {
        $user = $this->registerAccount('goodbye@example.test', 'Goodbye');
        $userId = (int) $this->pdo->query("SELECT id FROM users WHERE email = 'goodbye@example.test'")->fetchColumn();
        $this->runtime['planning_service']->create('task', $userId, ['name' => 'Last task']);

        self::assertSame(422, $this->api('POST', '/api/v1/account/delete', ['password' => 'wrong password here'], $user)->status);
        self::assertSame(1, (int) $this->pdo->query("SELECT COUNT(*) FROM users WHERE id = $userId")->fetchColumn());
        $deleted = $this->api('POST', '/api/v1/account/delete', ['password' => 'correct horse battery staple'], $user);
        self::assertSame(200, $deleted->status);
        self::assertSame(0, (int) $this->pdo->query("SELECT COUNT(*) FROM users WHERE id = $userId")->fetchColumn());
        self::assertSame(0, (int) $this->pdo->query("SELECT COUNT(*) FROM tasks WHERE user_id = $userId")->fetchColumn());
        self::assertSame(401, $this->api('GET', '/api/v1/notes', [], $user)->status);
        // Signing in again fails: it returns to the sign-in page instead of the Dashboard.
        $login = $this->login('goodbye@example.test');
        self::assertStringNotContainsString('/dashboard', (string) ($login->headers['Location'] ?? $login->headers['location'] ?? ''));

        // An administrator cannot delete their own account this way.
        $admin = $this->registerAccount('lastadmin@example.test', 'Last admin');
        $this->pdo->exec("UPDATE users SET role = 'admin' WHERE email = 'lastadmin@example.test'");
        self::assertSame(422, $this->api('POST', '/api/v1/account/delete', ['password' => 'correct horse battery staple'], $admin)->status);
    }

    /** @return array{0:string,1:string} cookie and CSRF token */
    private function registerAccount(string $email, string $name): array
    {
        $page = $this->request('GET', '/register');
        preg_match('/name="_token" value="([a-f0-9]{64})"/', $page->body, $match);
        $this->request('POST', '/register', [
            '_token' => $match[1],
            'display_name' => $name,
            'email' => $email,
            'password' => 'correct horse battery staple',
            'password_confirmation' => 'correct horse battery staple',
        ], $this->session->id());
        $cookie = $this->session->id();
        $csrf = $this->data($this->request('GET', '/api/v1/session', cookie: $cookie))['csrf_token'];

        return [$cookie, $csrf];
    }

    private function login(string $email): Response
    {
        $page = $this->request('GET', '/login');
        preg_match('/name="_token" value="([a-f0-9]{64})"/', $page->body, $match);

        return $this->request('POST', '/login', ['_token' => $match[1], 'email' => $email, 'password' => 'correct horse battery staple'], $this->session->id());
    }

    /** @param array<string, mixed> $input @param array{0:string,1:string} $auth */
    private function api(string $method, string $path, array $input, array $auth): Response
    {
        return $this->request($method, $path, $input, $auth[0], $method === 'GET' ? null : $auth[1], $method !== 'GET');
    }

    private function data(Response $response): mixed
    {
        return json_decode($response->body, true, flags: JSON_THROW_ON_ERROR)['data'];
    }

    /** @param array<string, mixed> $input */
    private function request(string $method, string $path, array $input = [], ?string $cookie = null, ?string $csrf = null, bool $json = false): Response
    {
        [$path, $queryString] = array_pad(explode('?', $path, 2), 2, '');
        parse_str($queryString, $query);
        $headers = ['accept' => str_starts_with($path, '/api/') ? 'application/json' : 'text/html'];
        $form = $input;
        $body = '';
        if ($json) {
            $headers['content-type'] = 'application/json';
            $body = json_encode((object) $input, JSON_THROW_ON_ERROR);
            $form = [];
        }
        if ($csrf !== null) {
            $headers['x-csrf-token'] = $csrf;
        }

        return $this->application->handle(new Request(
            $method,
            $path,
            query: $query,
            headers: $headers,
            cookies: $cookie === null ? [] : ['planner_session' => $cookie],
            form: $form,
            server: ['REMOTE_ADDR' => '198.51.100.20'],
            rawBody: $body,
        ));
    }

    private function wipeTargetDatabase(): void
    {
        $tables = $this->pdo->query("SELECT table_name FROM information_schema.tables WHERE table_schema = 'goals_test' AND table_type = 'BASE TABLE'")->fetchAll(PDO::FETCH_COLUMN);
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
