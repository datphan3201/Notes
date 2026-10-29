<?php

declare(strict_types=1);

namespace Planner\Http\Controller;

use Planner\Application\Account\AuthService;
use Planner\Application\AI\AIChatService;
use Planner\Http\Request;
use Planner\Http\Response;
use Planner\Http\Validation\InputValidator;

final readonly class AIChatController
{
    public function __construct(private AuthService $auth, private AIChatService $chat, private InputValidator $input)
    {
    }

    public function status(Request $request): Response
    {
        $this->auth->requireUser();

        return Response::json(['data' => ['available' => $this->chat->available()]]);
    }

    public function ask(Request $request): Response
    {
        $input = $request->input();
        $this->input->rejectUnknown($input, ['question']);

        return Response::json(['data' => ['answer' => $this->chat->ask($this->auth->requireUser()->id, $input['question'] ?? null)]]);
    }
}
