<?php

declare(strict_types=1);

use Planner\Http\Controller\AccountController;
use Planner\Http\Controller\AttachmentController;
use Planner\Http\Controller\FileContentController;
use Planner\Http\Controller\LabelController;
use Planner\Http\Controller\NoteController;
use Planner\Http\Controller\ProfileFileController;
use Planner\Http\Controller\PlanningController;
use Planner\Http\Controller\HabitController;
use Planner\Http\Controller\TaskSeriesController;
use Planner\Http\Controller\DashboardController;
use Planner\Http\Controller\ReviewController;
use Planner\Http\Controller\AIActionController;
use Planner\Http\Request;
use Planner\Http\Response;
use Planner\Http\Routing\Route;

$planningRoutes = static function (PlanningController $planning, Closure $handler): array {
    $routes = [];

    foreach (['areas' => 'area', 'goals' => 'goal', 'milestones' => 'milestone', 'tasks' => 'task'] as $path => $resource) {
        $routes[] = new Route(['GET'], "/api/v1/$path", "api.$path.index", static fn (Request $request, array $parameters): Response => $planning->index($request, [...$parameters, 'resource' => $resource]), auth: true);
        $routes[] = new Route(['POST'], "/api/v1/$path", "api.$path.store", static fn (Request $request, array $parameters): Response => $planning->store($request, [...$parameters, 'resource' => $resource]), auth: true, csrf: true, rateLimit: 'mutations');
        $routes[] = new Route(['GET'], "/api/v1/$path/{id}", "api.$path.show", static fn (Request $request, array $parameters): Response => $planning->show($request, [...$parameters, 'resource' => $resource]), auth: true);
        $routes[] = new Route(['PATCH'], "/api/v1/$path/{id}", "api.$path.update", static fn (Request $request, array $parameters): Response => $planning->update($request, [...$parameters, 'resource' => $resource]), auth: true, csrf: true, rateLimit: 'mutations');
        $routes[] = new Route(['DELETE'], "/api/v1/$path/{id}", "api.$path.archive", static fn (Request $request, array $parameters): Response => $planning->archive($request, [...$parameters, 'resource' => $resource]), auth: true, csrf: true, rateLimit: 'mutations');
    }

    $routes[] = new Route(['POST'], '/api/v1/goals/{id}/move', 'api.goals.move', $handler([$planning, 'moveGoal']), auth: true, csrf: true, rateLimit: 'mutations');
    $routes[] = new Route(['GET'], '/api/v1/goals/{id}/children', 'api.goals.children', $handler([$planning, 'children']), auth: true);
    $routes[] = new Route(['GET'], '/api/v1/goals/{id}/roadmap', 'api.goals.roadmap', $handler([$planning, 'roadmap']), auth: true);
    $routes[] = new Route(['POST'], '/api/v1/areas/reorder', 'api.areas.reorder', static fn (Request $request, array $parameters): Response => $planning->reorder($request, [...$parameters, 'resource' => 'area']), auth: true, csrf: true, rateLimit: 'mutations');

    foreach (['goals' => 'goal', 'milestones' => 'milestone', 'tasks' => 'task'] as $path => $resource) {
        foreach (['complete', 'reopen'] as $action) {
            $routes[] = new Route(['POST'], "/api/v1/$path/{id}/$action", "api.$path.$action", static fn (Request $request, array $parameters): Response => $planning->transition($request, [...$parameters, 'resource' => $resource, 'action' => $action]), auth: true, csrf: true, rateLimit: 'mutations');
        }

        $routes[] = new Route(['POST'], "/api/v1/$path/{id}/contributions", "api.$path.contributions.store", static fn (Request $request, array $parameters): Response => $planning->addContribution($request, [...$parameters, 'resource' => $resource]), auth: true, csrf: true, rateLimit: 'mutations');
        $routes[] = new Route(['GET'], "/api/v1/$path/{id}/contributions", "api.$path.contributions.index", static fn (Request $request, array $parameters): Response => $planning->contributions($request, [...$parameters, 'resource' => $resource]), auth: true);
        $routes[] = new Route(['DELETE'], "/api/v1/$path/{id}/contributions/{target}", "api.$path.contributions.destroy", static fn (Request $request, array $parameters): Response => $planning->removeContribution($request, [...$parameters, 'resource' => $resource]), auth: true, csrf: true, rateLimit: 'mutations');
    }

    $routes[] = new Route(['POST'], '/api/v1/milestones/{id}/prerequisites', 'api.milestones.prerequisites.store', $handler([$planning, 'addDependency']), auth: true, csrf: true, rateLimit: 'mutations');
    $routes[] = new Route(['GET'], '/api/v1/milestones/{id}/prerequisites', 'api.milestones.prerequisites.index', $handler([$planning, 'prerequisites']), auth: true);
    $routes[] = new Route(['DELETE'], '/api/v1/milestones/{id}/prerequisites/{target}', 'api.milestones.prerequisites.destroy', $handler([$planning, 'removeDependency']), auth: true, csrf: true, rateLimit: 'mutations');
    $routes[] = new Route(['GET'], '/api/v1/tasks/{id}/checklist', 'api.tasks.checklist.index', $handler([$planning, 'checklist']), auth: true);
    $routes[] = new Route(['POST'], '/api/v1/tasks/{id}/checklist', 'api.tasks.checklist.store', $handler([$planning, 'createChecklist']), auth: true, csrf: true, rateLimit: 'mutations');
    $routes[] = new Route(['POST'], '/api/v1/tasks/{id}/checklist/reorder', 'api.tasks.checklist.reorder', static fn (Request $request, array $parameters): Response => $planning->reorder($request, [...$parameters, 'resource' => 'checklist', 'parent' => $parameters['id']]), auth: true, csrf: true, rateLimit: 'mutations');
    $routes[] = new Route(['PATCH'], '/api/v1/tasks/{id}/checklist/{item}', 'api.tasks.checklist.update', $handler([$planning, 'updateChecklist']), auth: true, csrf: true, rateLimit: 'mutations');
    $routes[] = new Route(['DELETE'], '/api/v1/tasks/{id}/checklist/{item}', 'api.tasks.checklist.archive', $handler([$planning, 'archiveChecklist']), auth: true, csrf: true, rateLimit: 'mutations');
    $routes[] = new Route(['GET'], '/api/v1/tasks/{id}/note', 'api.tasks.note.show', $handler([$planning, 'showTaskNote']), auth: true);
    $routes[] = new Route(['POST'], '/api/v1/tasks/{id}/note', 'api.tasks.note.store', $handler([$planning, 'taskNote']), auth: true, csrf: true, rateLimit: 'mutations');

    return $routes;
};

return static function (
    AccountController $account,
    NoteController $notes,
    LabelController $labels,
    AttachmentController $attachments,
    ProfileFileController $profileFiles,
    FileContentController $fileContent,
    PlanningController $planning,
    HabitController $habits,
    TaskSeriesController $series,
    DashboardController $dashboard,
    ReviewController $reviews,
    AIActionController $ai,
    \Planner\Http\Controller\PasswordResetController $passwordReset,
    \Planner\Http\Controller\ReminderController $reminders,
    \Planner\Http\Controller\NotificationController $notifications,
    \Planner\Http\Controller\NoteShareController $shares,
    \Planner\Http\Controller\AdminController $admin,
    \Planner\Http\Controller\TwoFactorController $twoFactor,
    \Planner\Http\Controller\TeamController $teams,
    \Planner\Http\Controller\AIChatController $chat,
    \Planner\Http\Controller\EmailController $email,
) use ($planningRoutes): array {
    $handler = static fn (callable $callable): Closure => Closure::fromCallable($callable);

    return [
        new Route(['GET'], '/verify-email', 'email.verify', $handler([$email, 'verify'])),
        new Route(['GET'], '/confirm-email', 'email.change.confirm', $handler([$email, 'confirmChange'])),
        new Route(['GET'], '/api/v1/email', 'api.email.show', $handler([$email, 'status']), auth: true),
        new Route(['POST'], '/api/v1/email/verification', 'api.email.verification', $handler([$email, 'resend']), auth: true, csrf: true, rateLimit: 'password-change'),
        new Route(['POST'], '/api/v1/email/change', 'api.email.change', $handler([$email, 'change']), auth: true, csrf: true, rateLimit: 'password-change'),
        new Route(['POST'], '/api/v1/reminders/{id}/read', 'api.reminders.read', $handler([$reminders, 'read']), auth: true, csrf: true, rateLimit: 'mutations'),
        new Route(['DELETE'], '/api/v1/reviews/{id}', 'api.reviews.destroy', $handler([$reviews, 'destroy']), auth: true, csrf: true, rateLimit: 'mutations'),
        new Route(['GET'], '/two-factor', 'two-factor', $handler([$twoFactor, 'page'])),
        new Route(['POST'], '/two-factor', 'two-factor.verify', $handler([$twoFactor, 'verify']), csrf: true, rateLimit: 'two-factor'),
        new Route(['POST'], '/two-factor/email', 'two-factor.email', $handler([$twoFactor, 'sendEmail']), csrf: true, rateLimit: 'two-factor'),
        new Route(['GET'], '/api/v1/two-factor', 'api.two-factor.show', $handler([$twoFactor, 'status']), auth: true),
        new Route(['POST'], '/api/v1/two-factor/totp', 'api.two-factor.totp.begin', $handler([$twoFactor, 'beginTotp']), auth: true, csrf: true, rateLimit: 'two-factor'),
        new Route(['POST'], '/api/v1/two-factor/totp/confirm', 'api.two-factor.totp.confirm', $handler([$twoFactor, 'confirmTotp']), auth: true, csrf: true, rateLimit: 'two-factor'),
        new Route(['POST'], '/api/v1/two-factor/email', 'api.two-factor.email.send', $handler([$twoFactor, 'sendSetupEmail']), auth: true, csrf: true, rateLimit: 'two-factor'),
        new Route(['POST'], '/api/v1/two-factor/email/confirm', 'api.two-factor.email.confirm', $handler([$twoFactor, 'confirmEmail']), auth: true, csrf: true, rateLimit: 'two-factor'),
        new Route(['POST'], '/api/v1/two-factor/disable', 'api.two-factor.disable', $handler([$twoFactor, 'disable']), auth: true, csrf: true, rateLimit: 'password-change'),
        new Route(['GET'], '/api/v1/notifications', 'api.notifications.index', $handler([$notifications, 'index']), auth: true),
        new Route(['POST'], '/api/v1/notifications/read', 'api.notifications.read-all', $handler([$notifications, 'readAll']), auth: true, csrf: true, rateLimit: 'mutations'),
        new Route(['POST'], '/api/v1/notifications/{id}/read', 'api.notifications.read', $handler([$notifications, 'read']), auth: true, csrf: true, rateLimit: 'mutations'),
        new Route(['PUT'], '/api/v1/notes/{note}/background', 'api.notes.background', $handler([$notes, 'background']), auth: true, csrf: true, rateLimit: 'mutations'),
        new Route(['GET'], '/api/v1/notes/{note}/shares', 'api.notes.shares.index', $handler([$shares, 'index']), auth: true),
        new Route(['POST'], '/api/v1/notes/{note}/shares', 'api.notes.shares.store', $handler([$shares, 'store']), auth: true, csrf: true, rateLimit: 'mutations'),
        new Route(['PATCH'], '/api/v1/notes/{note}/shares/{share}', 'api.notes.shares.update', $handler([$shares, 'update']), auth: true, csrf: true, rateLimit: 'mutations'),
        new Route(['DELETE'], '/api/v1/notes/{note}/shares/{share}', 'api.notes.shares.destroy', $handler([$shares, 'destroy']), auth: true, csrf: true, rateLimit: 'mutations'),
        new Route(['GET'], '/api/v1/shared-notes', 'api.shared-notes.index', $handler([$shares, 'received']), auth: true),
        new Route(['POST'], '/api/v1/shared-notes/invitations/{share}/{action}', 'api.shared-notes.respond', static function (Request $request, array $parameters) use ($shares): Response {
            if (! in_array($parameters['action'], ['accept', 'decline'], true)) {
                throw new \Planner\Http\HttpException(404, 'NOT_FOUND', 'The requested resource was not found.');
            }

            return $shares->respond($request, $parameters);
        }, auth: true, csrf: true, rateLimit: 'mutations'),
        new Route(['DELETE'], '/api/v1/shared-notes/memberships/{share}', 'api.shared-notes.leave', $handler([$shares, 'leave']), auth: true, csrf: true, rateLimit: 'mutations'),
        new Route(['GET'], '/api/v1/shared-notes/{note}', 'api.shared-notes.show', $handler([$shares, 'show']), auth: true),
        new Route(['PATCH'], '/api/v1/shared-notes/{note}', 'api.shared-notes.update', $handler([$shares, 'edit']), auth: true, csrf: true, rateLimit: 'mutations'),
        new Route(['POST'], '/api/v1/shared-notes/{note}/report', 'api.shared-notes.report', $handler([$shares, 'report']), auth: true, csrf: true, rateLimit: 'mutations'),
        new Route(['GET'], '/api/v1/contacts', 'api.contacts', $handler([$teams, 'contacts']), auth: true),
        new Route(['GET'], '/admin', 'admin.index', $handler([$admin, 'page']), auth: true),
        new Route(['GET'], '/api/v1/admin/reports', 'api.admin.reports', $handler([$admin, 'reports']), auth: true),
        new Route(['POST'], '/api/v1/admin/reports/{id}/resolve', 'api.admin.reports.resolve', $handler([$admin, 'resolve']), auth: true, csrf: true, rateLimit: 'mutations'),
        new Route(['GET'], '/api/v1/admin/users', 'api.admin.users', $handler([$admin, 'users']), auth: true),
        new Route(['POST'], '/api/v1/admin/users/{id}/{action}', 'api.admin.users.lock', static function (Request $request, array $parameters) use ($admin): Response {
            if (! in_array($parameters['action'], ['lock', 'unlock'], true)) {
                throw new \Planner\Http\HttpException(404, 'NOT_FOUND', 'The requested resource was not found.');
            }

            return $admin->lock($request, $parameters);
        }, auth: true, csrf: true, rateLimit: 'mutations'),
        new Route(['GET'], '/api/v1/admin/settings', 'api.admin.settings', $handler([$admin, 'settings']), auth: true),
        new Route(['PATCH'], '/api/v1/admin/settings', 'api.admin.settings.update', $handler([$admin, 'updateSettings']), auth: true, csrf: true, rateLimit: 'mutations'),
        new Route(['GET'], '/teamwork', 'planning.teamwork', $handler([$account, 'planningPage']), auth: true),
        new Route(['GET'], '/api/v1/team-goals', 'api.team-goals.index', $handler([$teams, 'index']), auth: true),
        new Route(['POST'], '/api/v1/team-goals', 'api.team-goals.store', $handler([$teams, 'store']), auth: true, csrf: true, rateLimit: 'mutations'),
        new Route(['GET'], '/api/v1/team-goals/{id}', 'api.team-goals.show', $handler([$teams, 'show']), auth: true),
        new Route(['PATCH'], '/api/v1/team-goals/{id}', 'api.team-goals.update', $handler([$teams, 'update']), auth: true, csrf: true, rateLimit: 'mutations'),
        new Route(['DELETE'], '/api/v1/team-goals/{id}', 'api.team-goals.archive', $handler([$teams, 'archive']), auth: true, csrf: true, rateLimit: 'mutations'),
        new Route(['POST'], '/api/v1/team-goals/{id}/members', 'api.team-goals.members.store', $handler([$teams, 'invite']), auth: true, csrf: true, rateLimit: 'mutations'),
        new Route(['PATCH'], '/api/v1/team-goals/{id}/members/{member}', 'api.team-goals.members.update', $handler([$teams, 'changeRole']), auth: true, csrf: true, rateLimit: 'mutations'),
        new Route(['DELETE'], '/api/v1/team-goals/{id}/members/{member}', 'api.team-goals.members.destroy', $handler([$teams, 'removeMember']), auth: true, csrf: true, rateLimit: 'mutations'),
        new Route(['POST'], '/api/v1/team-goals/{id}/invitation/{action}', 'api.team-goals.respond', static function (Request $request, array $parameters) use ($teams): Response {
            if (! in_array($parameters['action'], ['accept', 'decline'], true)) {
                throw new \Planner\Http\HttpException(404, 'NOT_FOUND', 'The requested resource was not found.');
            }

            return $teams->respond($request, $parameters);
        }, auth: true, csrf: true, rateLimit: 'mutations'),
        new Route(['POST'], '/api/v1/team-goals/{id}/tasks', 'api.team-goals.tasks.store', $handler([$teams, 'createTask']), auth: true, csrf: true, rateLimit: 'mutations'),
        new Route(['PATCH'], '/api/v1/team-goals/{id}/tasks/{task}', 'api.team-goals.tasks.update', $handler([$teams, 'updateTask']), auth: true, csrf: true, rateLimit: 'mutations'),
        new Route(['DELETE'], '/api/v1/team-goals/{id}/tasks/{task}', 'api.team-goals.tasks.archive', $handler([$teams, 'archiveTask']), auth: true, csrf: true, rateLimit: 'mutations'),
        new Route(['GET'], '/api/v1/team-goals/{id}/messages', 'api.team-goals.messages.index', $handler([$teams, 'messages']), auth: true),
        new Route(['POST'], '/api/v1/team-goals/{id}/messages', 'api.team-goals.messages.store', $handler([$teams, 'postMessage']), auth: true, csrf: true, rateLimit: 'mutations'),
        new Route(['GET'], '/api/v1/ai/chat', 'api.ai.chat.status', $handler([$chat, 'status']), auth: true),
        new Route(['POST'], '/api/v1/ai/chat', 'api.ai.chat', $handler([$chat, 'ask']), auth: true, csrf: true, rateLimit: 'ai-chat'),
        new Route(['GET'], '/api/v1/dashboard/activity', 'api.dashboard.activity', $handler([$dashboard, 'activity']), auth: true),
        new Route(['GET'], '/settings/history', 'settings.history', $handler([$account, 'settingsPage']), auth: true),
        new Route(['GET'], '/api/v1/reminders', 'api.reminders.index', $handler([$reminders, 'index']), auth: true),
        new Route(['GET'], '/up', 'up', static fn (Request $request, array $parameters): Response => Response::json(['data' => ['status' => 'ok']])),
        new Route(['GET'], '/forgot-password', 'password.forgot', $handler([$passwordReset, 'page'])),
        new Route(['POST'], '/forgot-password', 'password.forgot.store', $handler([$passwordReset, 'request']), csrf: true),
        new Route(['GET'], '/reset-password', 'password.reset', $handler([$passwordReset, 'page'])),
        new Route(['POST'], '/reset-password', 'password.reset.store', $handler([$passwordReset, 'reset']), csrf: true),
        new Route(['GET'], '/login', 'login', $handler([$account, 'loginPage'])),
        new Route(['POST'], '/login', 'login.store', $handler([$account, 'login']), csrf: true),
        new Route(['GET'], '/register', 'register', $handler([$account, 'registerPage'])),
        new Route(['POST'], '/register', 'register.store', $handler([$account, 'register']), csrf: true, rateLimit: 'registration'),
        new Route(['GET'], '/', 'notes.index', $handler([$account, 'notesShell']), auth: true),
        new Route(['POST'], '/logout', 'logout', $handler([$account, 'logout']), auth: true, csrf: true),
        new Route(['POST'], '/api/v1/preferences/background', 'api.background.store', $handler([$profileFiles, 'replaceBackground']), auth: true, csrf: true, rateLimit: 'mutations'),
        new Route(['DELETE'], '/api/v1/preferences/background', 'api.background.destroy', $handler([$profileFiles, 'removeBackground']), auth: true, csrf: true, rateLimit: 'mutations'),
        new Route(['GET'], '/files/background', 'background.show', $handler([$profileFiles, 'background']), auth: true),
        new Route(['GET'], '/api/v1/preferences/backgrounds', 'api.backgrounds.index', $handler([$profileFiles, 'backgrounds']), auth: true),
        new Route(['DELETE'], '/api/v1/preferences/backgrounds/{background}', 'api.backgrounds.destroy', $handler([$profileFiles, 'deleteBackground']), auth: true, csrf: true, rateLimit: 'mutations'),
        new Route(['GET'], '/files/backgrounds/{background}', 'backgrounds.show', $handler([$profileFiles, 'backgroundFile']), auth: true),
        new Route(['GET'], '/settings/notifications', 'settings.notifications', $handler([$account, 'settingsPage']), auth: true),
        new Route(['GET'], '/settings/profile', 'settings.profile', $handler([$account, 'settingsPage']), auth: true),
        new Route(['GET'], '/settings/preferences', 'settings.preferences', $handler([$account, 'settingsPage']), auth: true),
        new Route(['GET'], '/settings/password', 'settings.password', $handler([$account, 'settingsPage']), auth: true),
        new Route(['GET'], '/goals', 'planning.goals', $handler([$account, 'planningPage']), auth: true),
        new Route(['GET'], '/goals/{id}', 'planning.goal', $handler([$account, 'planningPage']), auth: true),
        new Route(['GET'], '/tasks', 'planning.tasks', $handler([$account, 'planningPage']), auth: true),
        new Route(['GET'], '/tasks/{id}', 'planning.task', $handler([$account, 'planningPage']), auth: true),
        new Route(['GET'], '/habits', 'planning.habits', $handler([$account, 'planningPage']), auth: true),
        new Route(['GET'], '/dashboard', 'planning.dashboard', $handler([$account, 'planningPage']), auth: true),
        new Route(['GET'], '/reviews', 'planning.reviews', $handler([$account, 'planningPage']), auth: true),
        new Route(['GET'], '/api/v1/session', 'api.session', $handler([$account, 'session']), auth: true),
        new Route(['POST'], '/api/v1/walkthrough/dismiss', 'api.walkthrough.dismiss', $handler([$account, 'dismissWalkthrough']), auth: true, csrf: true, rateLimit: 'mutations'),
        new Route(['GET'], '/api/v1/profile', 'api.profile.show', $handler([$account, 'profile']), auth: true),
        new Route(['PATCH'], '/api/v1/profile', 'api.profile.update', $handler([$account, 'updateProfile']), auth: true, csrf: true, rateLimit: 'mutations'),
        new Route(['GET'], '/api/v1/preferences', 'api.preferences.show', $handler([$account, 'preferences']), auth: true),
        new Route(['PATCH'], '/api/v1/preferences', 'api.preferences.update', $handler([$account, 'updatePreferences']), auth: true, csrf: true, rateLimit: 'mutations'),
        new Route(['POST'], '/api/v1/password', 'api.password.update', $handler([$account, 'changePassword']), auth: true, csrf: true, rateLimit: 'password-change'),
        new Route(['GET'], '/api/v1/notes', 'api.notes.index', $handler([$notes, 'index']), auth: true, rateLimit: 'note-reads'),
        new Route(['POST'], '/api/v1/notes', 'api.notes.store', $handler([$notes, 'store']), auth: true, csrf: true, rateLimit: 'mutations'),
        new Route(['GET'], '/api/v1/notes/{note}', 'api.notes.show', $handler([$notes, 'show']), auth: true, rateLimit: 'note-reads'),
        new Route(['PATCH'], '/api/v1/notes/{note}', 'api.notes.update', $handler([$notes, 'update']), auth: true, csrf: true, rateLimit: 'mutations'),
        new Route(['DELETE'], '/api/v1/notes/{note}', 'api.notes.destroy', $handler([$notes, 'destroy']), auth: true, csrf: true, rateLimit: 'mutations'),
        new Route(['GET'], '/api/v1/labels', 'api.labels.index', $handler([$labels, 'index']), auth: true, rateLimit: 'note-reads'),
        new Route(['POST'], '/api/v1/labels', 'api.labels.store', $handler([$labels, 'store']), auth: true, csrf: true, rateLimit: 'mutations'),
        new Route(['PATCH'], '/api/v1/labels/{label}', 'api.labels.update', $handler([$labels, 'update']), auth: true, csrf: true, rateLimit: 'mutations'),
        new Route(['DELETE'], '/api/v1/labels/{label}', 'api.labels.destroy', $handler([$labels, 'destroy']), auth: true, csrf: true, rateLimit: 'mutations'),
        new Route(['GET'], '/api/v1/tags', 'api.tags.index', $handler([$labels, 'index']), auth: true),
        new Route(['POST'], '/api/v1/tags', 'api.tags.store', $handler([$labels, 'tagStore']), auth: true, csrf: true, rateLimit: 'mutations'),
        new Route(['GET'], '/api/v1/tags/{tag}', 'api.tags.show', $handler([$labels, 'tagShow']), auth: true),
        new Route(['PATCH'], '/api/v1/tags/{tag}', 'api.tags.update', $handler([$labels, 'tagUpdate']), auth: true, csrf: true, rateLimit: 'mutations'),
        new Route(['DELETE'], '/api/v1/tags/{tag}', 'api.tags.archive', $handler([$labels, 'tagDestroy']), auth: true, csrf: true, rateLimit: 'mutations'),
        new Route(['POST'], '/api/v1/tags/{tag}/move', 'api.tags.move', $handler([$labels, 'tagMove']), auth: true, csrf: true, rateLimit: 'mutations'),
        new Route(['GET'], '/api/v1/notes/{note}/attachments', 'api.attachments.index', $handler([$attachments, 'index']), auth: true, rateLimit: 'note-reads'),
        new Route(['POST'], '/api/v1/notes/{note}/attachments', 'api.attachments.store', $handler([$attachments, 'store']), auth: true, csrf: true, rateLimit: 'uploads'),
        new Route(['DELETE'], '/api/v1/notes/{note}/attachments/{attachment}', 'api.attachments.destroy', $handler([$attachments, 'destroy']), auth: true, csrf: true, rateLimit: 'mutations'),
        new Route(['POST'], '/api/v1/profile/avatar', 'api.profile.avatar', $handler([$profileFiles, 'replaceAvatar']), auth: true, csrf: true, rateLimit: 'uploads'),
        new Route(['DELETE'], '/api/v1/profile/avatar', 'api.profile.avatar.remove', $handler([$profileFiles, 'removeAvatar']), auth: true, csrf: true, rateLimit: 'mutations'),
        new Route(['GET', 'HEAD'], '/files/attachments/{attachment}/preview', 'files.attachment.preview', $handler([$fileContent, 'preview']), auth: true),
        new Route(['GET', 'HEAD'], '/files/attachments/{attachment}/download', 'files.attachment.download', $handler([$fileContent, 'download']), auth: true),
        new Route(['GET', 'HEAD'], '/files/avatar', 'files.avatar', $handler([$fileContent, 'avatar']), auth: true),
        new Route(['GET'], '/api/v1/habits', 'api.habits.index', $handler([$habits, 'index']), auth: true),
        new Route(['POST'], '/api/v1/habits', 'api.habits.store', $handler([$habits, 'store']), auth: true, csrf: true, rateLimit: 'mutations'),
        new Route(['GET'], '/api/v1/habits/{id}', 'api.habits.show', $handler([$habits, 'show']), auth: true),
        new Route(['PATCH'], '/api/v1/habits/{id}', 'api.habits.update', $handler([$habits, 'update']), auth: true, csrf: true, rateLimit: 'mutations'),
        new Route(['DELETE'], '/api/v1/habits/{id}', 'api.habits.archive', $handler([$habits, 'archive']), auth: true, csrf: true, rateLimit: 'mutations'),
        new Route(['GET'], '/api/v1/habits/{id}/history', 'api.habits.history', $handler([$habits, 'history']), auth: true),
        new Route(['PUT'], '/api/v1/habits/{id}/check-ins/{date}', 'api.habits.check-ins.store', $handler([$habits, 'checkIn']), auth: true, csrf: true, rateLimit: 'mutations'),
        new Route(['DELETE'], '/api/v1/habits/{id}/check-ins/{date}', 'api.habits.check-ins.destroy', $handler([$habits, 'undoCheckIn']), auth: true, csrf: true, rateLimit: 'mutations'),
        new Route(['PUT'], '/api/v1/habits/{id}/rest-days/{date}', 'api.habits.rest-days.store', $handler([$habits, 'rest']), auth: true, csrf: true, rateLimit: 'mutations'),
        new Route(['DELETE'], '/api/v1/habits/{id}/rest-days/{date}', 'api.habits.rest-days.destroy', $handler([$habits, 'cancelRest']), auth: true, csrf: true, rateLimit: 'mutations'),
        new Route(['POST'], '/api/v1/habits/{id}/contributions','api.habits.contributions.store', $handler([$habits, 'addContribution']), auth: true, csrf: true, rateLimit: 'mutations'),
        new Route(['DELETE'], '/api/v1/habits/{id}/contributions/{target}', 'api.habits.contributions.destroy', $handler([$habits, 'removeContribution']), auth: true, csrf: true, rateLimit: 'mutations'),
        new Route(['GET'], '/api/v1/task-series', 'api.task-series.index', $handler([$series, 'index']), auth: true),
        new Route(['POST'], '/api/v1/task-series', 'api.task-series.store', $handler([$series, 'store']), auth: true, csrf: true, rateLimit: 'mutations'),
        new Route(['POST'], '/api/v1/task-series/preview', 'api.task-series.preview', $handler([$series, 'preview']), auth: true, csrf: true, rateLimit: 'mutations'),
        new Route(['GET'], '/api/v1/task-series/{id}', 'api.task-series.show', $handler([$series, 'show']), auth: true),
        new Route(['PATCH'], '/api/v1/task-series/{id}', 'api.task-series.update', $handler([$series, 'update']), auth: true, csrf: true, rateLimit: 'mutations'),
        new Route(['POST'], '/api/v1/task-series/{id}/{action}', 'api.task-series.transition', $handler([$series, 'transition']), auth: true, csrf: true, rateLimit: 'mutations'),
        new Route(['GET'], '/api/v1/dashboard', 'api.dashboard.show', $handler([$dashboard, 'show']), auth: true),
        new Route(['GET'], '/api/v1/weekly-selections/{type}', 'api.weekly-selections.index', $handler([$dashboard, 'selections']), auth: true),
        new Route(['POST'], '/api/v1/weekly-selections/{type}', 'api.weekly-selections.store', $handler([$dashboard, 'addSelection']), auth: true, csrf: true, rateLimit: 'mutations'),
        new Route(['DELETE'], '/api/v1/weekly-selections/{type}/{id}', 'api.weekly-selections.destroy', $handler([$dashboard, 'removeSelection']), auth: true, csrf: true, rateLimit: 'mutations'),
        new Route(['POST'], '/api/v1/weekly-selections/{type}/reorder', 'api.weekly-selections.reorder', $handler([$dashboard, 'reorder']), auth: true, csrf: true, rateLimit: 'mutations'),
        new Route(['GET'], '/api/v1/reviews', 'api.reviews.index', $handler([$reviews, 'index']), auth: true),
        new Route(['POST'], '/api/v1/reviews', 'api.reviews.store', $handler([$reviews, 'store']), auth: true, csrf: true, rateLimit: 'mutations'),
        new Route(['GET'], '/api/v1/reviews/{id}', 'api.reviews.show', $handler([$reviews, 'show']), auth: true),
        new Route(['PATCH'], '/api/v1/reviews/{id}', 'api.reviews.update', $handler([$reviews, 'update']), auth: true, csrf: true, rateLimit: 'mutations'),
        new Route(['POST'], '/api/v1/reviews/{id}/{action}', 'api.reviews.transition', $handler([$reviews, 'transition']), auth: true, csrf: true, rateLimit: 'mutations'),
        new Route(['POST'], '/api/v1/ai/actions', 'api.ai.actions.store', $handler([$ai, 'store']), auth: true, csrf: true, rateLimit: 'ai-generation'),
        new Route(['GET'], '/api/v1/ai/actions/{id}', 'api.ai.actions.show', $handler([$ai, 'show']), auth: true),
        new Route(['POST'], '/api/v1/ai/actions/{id}/apply', 'api.ai.actions.apply', $handler([$ai, 'apply']), auth: true, csrf: true, rateLimit: 'ai-apply'),
        new Route(['POST'], '/api/v1/ai/actions/{id}/reject', 'api.ai.actions.reject', $handler([$ai, 'reject']), auth: true, csrf: true, rateLimit: 'mutations'),
        ...$planningRoutes($planning, $handler),
    ];
};
