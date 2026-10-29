<?php

declare(strict_types=1);
namespace Planner\Http\Controller;
use Planner\Application\Account\AuthService;
use Planner\Application\Planning\TaskReminderService;
use Planner\Http\Request;
use Planner\Http\Response;
final readonly class ReminderController
{
    public function __construct(private AuthService $auth, private TaskReminderService $reminders)
    {
    }
    public function index(Request $request): Response
    {
        return Response::json(['data' => $this->reminders->due($this->auth->requireUser()->id)]);
    }
    /** @param array<string, string> $parameters */
    public function read(Request $request, array $parameters): Response
    {
        $user = $this->auth->requireUser();
        if (preg_match('/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/D', $parameters['id']) !== 1) {
            throw new \Planner\Http\HttpException(404, 'NOT_FOUND', 'The requested resource was not found.');
        }
        $this->reminders->markRead($user->id, $parameters['id']);
        return Response::json(['data' => ['read' => true]]);
    }
}
