<?php

declare(strict_types=1);

namespace Planner\Http\Controller;

use Planner\Application\Admin\ReportOutcome;
use Planner\Application\Account\AuthService;
use Planner\Application\Admin\UserReportService;
use Planner\Application\Files\FileStreamer;
use Planner\Application\Files\UploadValidator;
use Planner\Http\Request;
use Planner\Http\Response;
use Planner\Http\Validation\InputValidator;

/** Users file reports about other users; administrators review them (404 for everyone else). */
final readonly class UserReportController
{
    public function __construct(
        private AuthService $auth,
        private UserReportService $reports,
        private UploadValidator $uploads,
        private InputValidator $input,
    ) {
    }

    public function store(Request $request): Response
    {
        $user = $this->auth->requireUser();
        $form = $request->input();
        $evidence = $this->uploads->reportEvidence($form, $request->files);
        $this->reports->report($user->id, $form['email'] ?? null, $form['reason'] ?? null, $evidence);

        // The same answer whether or not the email belongs to an account.
        return Response::json(['data' => ['status' => 'received']], 202);
    }

    public function mine(Request $request): Response
    {
        return Response::json(['data' => $this->reports->mine($this->auth->requireUser()->id)]);
    }

    public function index(Request $request): Response
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
        $actions = ReportOutcome::parseActions($input['actions'] ?? null, ['warn_account', 'lock_account']);
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

    /** @param array<string, string> $parameters */
    public function evidence(Request $request, array $parameters): Response
    {
        $this->auth->requireAdmin();

        return (new FileStreamer)->avatar($this->reports->evidence($parameters['id'], $parameters['position']));
    }
}
