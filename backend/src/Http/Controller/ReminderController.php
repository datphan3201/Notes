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
}
