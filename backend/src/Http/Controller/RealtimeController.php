<?php

declare(strict_types=1);

namespace Planner\Http\Controller;

use Planner\Application\Account\AuthService;
use Planner\Application\Notes\NoteLockGate;
use Planner\Http\HttpException;
use Planner\Http\Request;
use Planner\Http\Response;
use Planner\Infrastructure\Persistence\Pdo\Notes\PdoNoteRepository;
use Planner\Infrastructure\Persistence\Pdo\Notes\PdoNoteShareRepository;
use Planner\Infrastructure\Realtime\RealtimeTicket;
use Planner\Support\Clock;

/**
 * Issues the admission ticket for live collaboration on one Note. Access is
 * decided here, with the browser session: the owner, or an accepted recipient
 * (view or edit), of a live Note that this session has unlocked.
 */
final readonly class RealtimeController
{
    public function __construct(
        private AuthService $auth,
        private PdoNoteRepository $notes,
        private PdoNoteShareRepository $shares,
        private NoteLockGate $gate,
        private ?RealtimeTicket $tickets,
        private ?string $publicUrl,
        private Clock $clock,
    ) {
    }

    /** POST /api/v1/notes/{note}/realtime @param array<string, string> $parameters */
    public function ticket(Request $request, array $parameters): Response
    {
        $user = $this->auth->requireUser();
        if ($this->tickets === null) {
            throw new HttpException(503, 'REALTIME_DISABLED', 'Live collaboration is not enabled.');
        }
        $noteId = $parameters['note'];
        $note = $this->notes->findOwned($user->id, $noteId);
        $permission = 'owner';
        if ($note === null) {
            $share = $this->shares->findForNoteRecipient($noteId, $user->id);
            if ($share === null || $share['status'] !== 'accepted') {
                throw new HttpException(404, 'NOT_FOUND', 'The requested resource was not found.');
            }
            $note = $this->notes->findOwned((int) $share['owner_id'], $noteId)
                ?? throw new HttpException(404, 'NOT_FOUND', 'The requested resource was not found.');
            $permission = (string) $share['permission'];
        }
        $this->gate->assertUnlocked($note);

        return Response::json(['data' => [
            'url' => $this->publicUrl,
            'path' => '/realtime',
            'ticket' => $this->tickets->issue([
                'user_id' => $user->id,
                'name' => $user->displayName,
                'owner_id' => $note->userId,
                'note_id' => $note->id,
                'permission' => $permission,
            ], $this->clock->now()->getTimestamp()),
            'permission' => $permission,
            'expires_in' => RealtimeTicket::TTL_SECONDS,
        ]]);
    }
}
