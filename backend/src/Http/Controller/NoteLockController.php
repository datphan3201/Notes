<?php

declare(strict_types=1);

namespace Planner\Http\Controller;

use Planner\Application\Account\AuthService;
use Planner\Application\Notes\NoteLockService;
use Planner\Domain\Notes\NoteRecord;
use Planner\Http\Request;
use Planner\Http\Response;

/** Per-Note password endpoints. Responses never include the password hash. */
final readonly class NoteLockController
{
    public function __construct(
        private AuthService $auth,
        private NoteLockService $locks,
    ) {
    }

    /** PUT /api/v1/notes/{note}/lock {password, password_confirmation} @param array<string, string> $parameters */
    public function enable(Request $request, array $parameters): Response
    {
        $user = $this->auth->requireUser();

        return $this->note($this->locks->enable($user->id, $parameters['note'], $request->input()));
    }

    /** PATCH /api/v1/notes/{note}/lock {current_password, password, password_confirmation} @param array<string, string> $parameters */
    public function change(Request $request, array $parameters): Response
    {
        $user = $this->auth->requireUser();

        return $this->note($this->locks->change($user->id, $parameters['note'], $request->input()));
    }

    /** DELETE /api/v1/notes/{note}/lock {current_password} @param array<string, string> $parameters */
    public function disable(Request $request, array $parameters): Response
    {
        $user = $this->auth->requireUser();

        return $this->note($this->locks->disable($user->id, $parameters['note'], $request->input()));
    }

    /** POST /api/v1/notes/{note}/unlock {password} @param array<string, string> $parameters */
    public function unlock(Request $request, array $parameters): Response
    {
        $user = $this->auth->requireUser();
        $note = $this->locks->unlock($user->id, $parameters['note'], $request->input());

        return Response::json(['data' => ['id' => $note->id, 'is_locked' => $note->isLocked(), 'unlocked' => true]]);
    }

    /** POST /api/v1/notes/{note}/relock — forget this session's unlock. @param array<string, string> $parameters */
    public function relock(Request $request, array $parameters): Response
    {
        $user = $this->auth->requireUser();
        $this->locks->relock($user->id, $parameters['note']);

        return new Response(204);
    }

    private function note(NoteRecord $note): Response
    {
        return Response::json(['data' => [
            'id' => $note->id,
            'version' => $note->version,
            'is_locked' => $note->isLocked(),
            'locked_at' => \Planner\Support\Timestamp::api($note->lockedAt),
            'updated_at' => \Planner\Support\Timestamp::api($note->updatedAt),
        ]]);
    }
}
