<?php

declare(strict_types=1);

namespace Planner\Http\Controller;

use Planner\Application\Account\AuthService;
use Planner\Application\Notes\NoteAIService;
use Planner\Http\Request;
use Planner\Http\Response;
use Planner\Http\Validation\InputValidator;

/** AI Summary of one Note and AI Question & Answer over the user's Notes. */
final readonly class NoteAIController
{
    public function __construct(
        private AuthService $auth,
        private NoteAIService $ai,
        private InputValidator $input,
    ) {
    }

    /** GET /api/v1/notes/{note}/summary — the stored summary, if any. @param array<string, string> $parameters */
    public function summary(Request $request, array $parameters): Response
    {
        return Response::json(['data' => $this->ai->summary($this->auth->requireUser()->id, $parameters['note'])]);
    }

    /** POST /api/v1/notes/{note}/summary — generate or regenerate. @param array<string, string> $parameters */
    public function summarize(Request $request, array $parameters): Response
    {
        $this->input->rejectUnknown($request->input(), []);

        return Response::json(['data' => $this->ai->summarize($this->auth->requireUser()->id, $parameters['note'])]);
    }

    /** POST /api/v1/notes/ask {question} @param array<string, string> $parameters */
    public function ask(Request $request, array $parameters = []): Response
    {
        $input = $request->input();
        $this->input->rejectUnknown($input, ['question']);

        return Response::json(['data' => $this->ai->ask($this->auth->requireUser()->id, $input['question'] ?? null)]);
    }
}
