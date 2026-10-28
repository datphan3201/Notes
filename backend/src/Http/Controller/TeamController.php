<?php

declare(strict_types=1);

namespace Planner\Http\Controller;

use Planner\Application\Account\AuthService;
use Planner\Application\Teamwork\TeamService;
use Planner\Http\Request;
use Planner\Http\Response;
use Planner\Http\Validation\InputValidator;
use Planner\Http\ValidationException;

final readonly class TeamController
{
    public function __construct(private AuthService $auth, private TeamService $teams, private InputValidator $input)
    {
    }

    public function index(Request $request): Response
    {
        return Response::json(['data' => $this->teams->overview($this->auth->requireUser()->id)]);
    }

    public function store(Request $request): Response
    {
        return Response::json(['data' => $this->teams->create($this->auth->requireUser()->id, $request->input())], 201);
    }

    /** @param array<string, string> $parameters */
    public function show(Request $request, array $parameters): Response
    {
        return Response::json(['data' => $this->teams->show($this->auth->requireUser()->id, $parameters['id'])]);
    }

    /** @param array<string, string> $parameters */
    public function update(Request $request, array $parameters): Response
    {
        return Response::json(['data' => $this->teams->update($this->auth->requireUser()->id, $parameters['id'], $request->input())]);
    }

    /** @param array<string, string> $parameters */
    public function archive(Request $request, array $parameters): Response
    {
        $this->teams->archive($this->auth->requireUser()->id, $parameters['id']);

        return new Response(204);
    }

    /** @param array<string, string> $parameters */
    public function invite(Request $request, array $parameters): Response
    {
        $input = $request->input();
        $this->input->rejectUnknown($input, ['email', 'role']);
        $email = is_string($input['email'] ?? null) ? trim($input['email']) : '';
        if (filter_var($email, FILTER_VALIDATE_EMAIL) === false) {
            throw new ValidationException(['email' => ['Enter a valid email address.']]);
        }

        return Response::json(['data' => $this->teams->invite($this->auth->requireUser()->id, $parameters['id'], $email, (string) ($input['role'] ?? 'viewer'))]);
    }

    /** @param array<string, string> $parameters */
    public function changeRole(Request $request, array $parameters): Response
    {
        $input = $request->input();
        $this->input->rejectUnknown($input, ['role']);

        return Response::json(['data' => $this->teams->changeRole($this->auth->requireUser()->id, $parameters['id'], $this->memberId($parameters), (string) ($input['role'] ?? ''))]);
    }

    /** @param array<string, string> $parameters */
    public function removeMember(Request $request, array $parameters): Response
    {
        $this->teams->removeMember($this->auth->requireUser()->id, $parameters['id'], $this->memberId($parameters));

        return new Response(204);
    }

    /** @param array<string, string> $parameters */
    public function respond(Request $request, array $parameters): Response
    {
        $this->input->rejectUnknown($request->input(), []);
        $this->teams->respond($this->auth->requireUser()->id, $parameters['id'], $parameters['action'] === 'accept');

        return Response::json(['data' => $this->teams->overview($this->auth->requireUser()->id)]);
    }

    /** @param array<string, string> $parameters */
    public function createTask(Request $request, array $parameters): Response
    {
        return Response::json(['data' => $this->teams->createTask($this->auth->requireUser()->id, $parameters['id'], $request->input())], 201);
    }

    /** @param array<string, string> $parameters */
    public function updateTask(Request $request, array $parameters): Response
    {
        return Response::json(['data' => $this->teams->updateTask($this->auth->requireUser()->id, $parameters['id'], $parameters['task'], $request->input())]);
    }

    /** @param array<string, string> $parameters */
    public function archiveTask(Request $request, array $parameters): Response
    {
        return Response::json(['data' => $this->teams->archiveTask($this->auth->requireUser()->id, $parameters['id'], $parameters['task'])]);
    }

    /** @param array<string, string> $parameters */
    public function messages(Request $request, array $parameters): Response
    {
        $after = $request->query['after'] ?? '0';
        if (! is_string($after) || ! ctype_digit($after)) {
            throw new ValidationException(['after' => ['The message cursor is invalid.']]);
        }

        return Response::json(['data' => $this->teams->messages($this->auth->requireUser()->id, $parameters['id'], (int) $after)]);
    }

    /** @param array<string, string> $parameters */
    public function postMessage(Request $request, array $parameters): Response
    {
        $input = $request->input();
        $this->input->rejectUnknown($input, ['body']);

        return Response::json(['data' => $this->teams->postMessage($this->auth->requireUser()->id, $parameters['id'], $input['body'] ?? null)], 201);
    }

    public function contacts(Request $request): Response
    {
        return Response::json(['data' => $this->teams->contacts($this->auth->requireUser()->id)]);
    }

    /** @param array<string, string> $parameters */
    private function memberId(array $parameters): int
    {
        if (! ctype_digit($parameters['member'])) {
            throw new ValidationException(['member' => ['The member is invalid.']]);
        }

        return (int) $parameters['member'];
    }
}
