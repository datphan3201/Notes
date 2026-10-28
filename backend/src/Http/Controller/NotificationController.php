<?php

declare(strict_types=1);

namespace Planner\Http\Controller;

use Planner\Application\Account\AuthService;
use Planner\Application\Notifications\NotificationService;
use Planner\Http\Request;
use Planner\Http\Response;
use Planner\Http\Validation\InputValidator;

final readonly class NotificationController
{
    public function __construct(private AuthService $auth, private NotificationService $notifications, private InputValidator $input)
    {
    }

    public function index(Request $request): Response
    {
        return Response::json(['data' => $this->notifications->inbox($this->auth->requireUser()->id)]);
    }

    /** @param array<string, string> $parameters */
    public function read(Request $request, array $parameters): Response
    {
        $this->input->rejectUnknown($request->input(), []);
        $this->notifications->markRead($this->auth->requireUser()->id, $parameters['id']);

        return Response::json(['data' => ['read' => true]]);
    }

    public function readAll(Request $request): Response
    {
        $this->input->rejectUnknown($request->input(), []);
        $this->notifications->markRead($this->auth->requireUser()->id, null);

        return Response::json(['data' => ['read' => true]]);
    }
}
