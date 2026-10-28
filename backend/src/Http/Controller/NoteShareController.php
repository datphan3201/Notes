<?php

declare(strict_types=1);

namespace Planner\Http\Controller;

use Planner\Application\Account\AuthService;
use Planner\Application\Admin\ReportService;
use Planner\Application\Notes\NoteShareService;
use Planner\Application\Notes\NoteValidator;
use Planner\Http\Request;
use Planner\Http\Response;
use Planner\Http\Validation\InputValidator;
use Planner\Http\ValidationException;

final readonly class NoteShareController
{
    public function __construct(
        private AuthService $auth,
        private NoteShareService $shares,
        private ReportService $reports,
        private NoteValidator $notes,
        private InputValidator $input,
    ) {
    }

    /** @param array<string, string> $parameters */
    public function index(Request $request, array $parameters): Response
    {
        return Response::json(['data' => $this->shares->sharesFor($this->auth->requireUser()->id, $parameters['note'])]);
    }

    /** @param array<string, string> $parameters */
    public function store(Request $request, array $parameters): Response
    {
        $input = $request->input();
        $this->input->rejectUnknown($input, ['email', 'permission']);
        $email = is_string($input['email'] ?? null) ? strtolower(trim($input['email'])) : '';
        $errors = [];
        if ($email === '' || filter_var($email, FILTER_VALIDATE_EMAIL) === false) {
            $errors['email'][] = 'Enter a valid email address.';
        }
        $permission = $this->permission($input, $errors);
        $this->input->throwIfErrors($errors);

        return Response::json(['data' => $this->shares->share($this->auth->requireUser()->id, $parameters['note'], $email, $permission)], 201);
    }

    /** @param array<string, string> $parameters */
    public function update(Request $request, array $parameters): Response
    {
        $input = $request->input();
        $this->input->rejectUnknown($input, ['permission']);
        $errors = [];
        $permission = $this->permission($input, $errors);
        $this->input->throwIfErrors($errors);

        return Response::json(['data' => $this->shares->changePermission($this->auth->requireUser()->id, $parameters['note'], $parameters['share'], $permission)]);
    }

    /** @param array<string, string> $parameters */
    public function destroy(Request $request, array $parameters): Response
    {
        return Response::json(['data' => $this->shares->remove($this->auth->requireUser()->id, $parameters['note'], $parameters['share'])]);
    }

    public function received(Request $request): Response
    {
        return Response::json(['data' => $this->shares->received($this->auth->requireUser()->id)]);
    }

    /** @param array<string, string> $parameters */
    public function respond(Request $request, array $parameters): Response
    {
        $this->input->rejectUnknown($request->input(), []);
        $this->shares->respond($this->auth->requireUser()->id, $parameters['share'], $parameters['action'] === 'accept');

        return Response::json(['data' => $this->shares->received($this->auth->requireUser()->id)]);
    }

    /** @param array<string, string> $parameters */
    public function leave(Request $request, array $parameters): Response
    {
        $this->shares->leave($this->auth->requireUser()->id, $parameters['share']);

        return new Response(204);
    }

    /** @param array<string, string> $parameters */
    public function show(Request $request, array $parameters): Response
    {
        return Response::json(['data' => $this->shares->showShared($this->auth->requireUser()->id, $parameters['note'])]);
    }

    /** @param array<string, string> $parameters */
    public function edit(Request $request, array $parameters): Response
    {
        $input = $this->notes->sharedEdit($request->input());

        return Response::json(['data' => $this->shares->updateShared($this->auth->requireUser()->id, $parameters['note'], $input)]);
    }

    /** @param array<string, string> $parameters */
    public function report(Request $request, array $parameters): Response
    {
        $input = $request->input();
        $this->input->rejectUnknown($input, ['reason']);
        $reason = is_string($input['reason'] ?? null) ? trim($input['reason']) : '';
        if ($reason === '' || mb_strlen($reason, 'UTF-8') > 1000) {
            throw new ValidationException(['reason' => ['Describe the problem in 1 to 1000 characters.']]);
        }
        $this->reports->report($this->auth->requireUser()->id, $parameters['note'], $reason);

        return Response::json(['data' => ['reported' => true]], 201);
    }

    public function contacts(Request $request): Response
    {
        return Response::json(['data' => $this->shares->contacts($this->auth->requireUser()->id)]);
    }

    /** @param array<string, mixed> $input @param array<string, list<string>> $errors */
    private function permission(array $input, array &$errors): string
    {
        $permission = $input['permission'] ?? 'view';
        if (! in_array($permission, ['view', 'edit'], true)) {
            $errors['permission'][] = 'Choose view or edit.';

            return 'view';
        }

        return $permission;
    }
}
