<?php

declare(strict_types=1);

namespace Planner\Http\Controller;

use Planner\Application\Account\AuthService;
use Planner\Application\Admin\ReportService;
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
        $this->input->rejectUnknown($input, ['status', 'response']);
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
        $this->reports->resolve($admin->id, $parameters['id'], (string) $status, $response);

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
        $this->auth->requireAdmin();
        $input = $request->input();
        $this->input->rejectUnknown($input, ['history_limit']);
        $limit = $input['history_limit'] ?? null;
        if (! is_int($limit) || $limit < 100 || $limit > 10000) {
            $this->input->throwIfErrors(['history_limit' => ['Choose a limit from 100 to 10000 tasks.']]);
        }

        return Response::json(['data' => $this->reports->updateSettings((int) $limit)]);
    }
}
