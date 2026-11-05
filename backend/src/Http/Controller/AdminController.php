<?php

declare(strict_types=1);

namespace Planner\Http\Controller;

use Planner\Application\Account\AuthService;
use Planner\Application\Admin\AdminActionLog;
use Planner\Application\Admin\ReportOutcome;
use Planner\Application\Admin\ReportService;
use Planner\Infrastructure\Persistence\Pdo\Admin\PdoSystemSettingRepository;
use Planner\Http\Request;
use Planner\Http\Response;
use Planner\Http\Validation\InputValidator;

/** Every action calls requireAdmin(), which answers 404 to non-admins. */
final readonly class AdminController
{
    public function __construct(
        private AuthService $auth,
        private ReportService $reports,
        private InputValidator $input,
        private AccountController $pages,
        private AdminActionLog $log,
    ) {
    }

    public function page(Request $request): Response
    {
        $this->auth->requireAdmin();

        return $this->pages->applicationPage('admin/index', 'Administration', 'admin.index');
    }

    public function reports(Request $request): Response
    {
        $this->auth->requireAdmin();
        $status = $request->query['status'] ?? 'open';
        if (! in_array($status, ['open', 'resolved', 'dismissed', 'all'], true)) {
            $this->input->throwIfErrors(['status' => ['The status filter is invalid.']]);
        }

        return Response::json(['data' => $this->reports->list((string) $status)]);
    }

    /** @param array<string, string> $parameters */
    public function resolve(Request $request, array $parameters): Response
    {
        $admin = $this->auth->requireAdmin();
        $input = $request->input();
        $this->input->rejectUnknown($input, ['status', 'response', 'actions']);
        $actions = ReportOutcome::parseActions($input['actions'] ?? null, ['revoke_shares', 'warn_owner', 'lock_owner']);
        $errors = [];
        $status = $input['status'] ?? null;
        if (! in_array($status, ['resolved', 'dismissed'], true)) {
            $errors['status'][] = 'Choose resolved or dismissed.';
        }
        $response = $input['response'] ?? null;
        if ($response !== null && (! is_string($response) || mb_strlen($response, 'UTF-8') > 1000)) {
            $errors['response'][] = 'The response may contain at most 1000 characters.';
        }
        $this->input->throwIfErrors($errors);
        $response = is_string($response) && trim($response) !== '' ? trim($response) : null;
        $this->reports->resolve($admin->id, $parameters['id'], (string) $status, $response, $actions);

        return Response::json(['data' => ['status' => $status]]);
    }

    public function users(Request $request): Response
    {
        $this->auth->requireAdmin();
        $query = $request->query['q'] ?? '';

        return Response::json(['data' => $this->reports->users(is_string($query) ? mb_substr(trim($query), 0, 100, 'UTF-8') : '')]);
    }

    /** @param array<string, string> $parameters */
    public function lock(Request $request, array $parameters): Response
    {
        $admin = $this->auth->requireAdmin();
        $input = $request->input();
        $locked = $parameters['action'] === 'lock';
        $this->input->rejectUnknown($input, $locked ? ['reason'] : []);
        $reason = is_string($input['reason'] ?? null) ? mb_substr(trim($input['reason']), 0, 500, 'UTF-8') : null;
        if (! ctype_digit($parameters['id'])) {
            $this->input->throwIfErrors(['user' => ['The account is invalid.']]);
        }
        $this->reports->setLocked($admin->id, (int) $parameters['id'], $locked, $reason === '' ? null : $reason);

        return Response::json(['data' => ['locked' => $locked]]);
    }

    public function settings(Request $request): Response
    {
        $this->auth->requireAdmin();

        return Response::json(['data' => $this->reports->settings()]);
    }

    public function updateSettings(Request $request): Response
    {
        $admin = $this->auth->requireAdmin();
        $input = $request->input();
        $this->input->rejectUnknown($input, ['history_limit', 'registration_mode']);
        $changes = [];
        $errors = [];
        if (array_key_exists('history_limit', $input)) {
            $limit = $input['history_limit'];
            if (! is_int($limit) || $limit < 100 || $limit > 10000) {
                $errors['history_limit'][] = 'Choose a limit from 100 to 10000 tasks.';
            } else {
                $changes['history_limit'] = $limit;
            }
        }
        if (array_key_exists('registration_mode', $input)) {
            $mode = $input['registration_mode'];
            if (! in_array($mode, PdoSystemSettingRepository::REGISTRATION_MODES, true)) {
                $errors['registration_mode'][] = 'Choose open, invite or closed.';
            } else {
                $changes['registration_mode'] = $mode;
            }
        }
        $this->input->throwIfErrors($errors);

        return Response::json(['data' => $this->reports->updateSettings($admin->id, $changes)]);
    }

    public function actions(Request $request): Response
    {
        $this->auth->requireAdmin();

        return Response::json(['data' => $this->log->recent()]);
    }

    public function invites(Request $request): Response
    {
        $this->auth->requireAdmin();

        return Response::json(['data' => $this->reports->invites()]);
    }

    public function invite(Request $request): Response
    {
        $admin = $this->auth->requireAdmin();

        return Response::json(['data' => $this->reports->invite($admin->id, $this->email($request))], 201);
    }

    public function removeInvite(Request $request): Response
    {
        $admin = $this->auth->requireAdmin();

        return Response::json(['data' => $this->reports->removeInvite($admin->id, $this->email($request))]);
    }

    private function email(Request $request): string
    {
        $input = $request->input();
        $this->input->rejectUnknown($input, ['email']);
        $email = is_string($input['email'] ?? null) ? strtolower(trim($input['email'])) : '';
        if (mb_strlen($email, 'UTF-8') > 254 || filter_var($email, FILTER_VALIDATE_EMAIL) === false) {
            $this->input->throwIfErrors(['email' => ['Enter a valid email address.']]);
        }

        return $email;
    }
}
