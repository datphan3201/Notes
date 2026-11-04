<?php

declare(strict_types=1);

namespace Planner\Application\Notes;

use Planner\Domain\Notes\NoteRecord;
use Planner\Infrastructure\Persistence\Pdo\Notes\PdoNoteRepository;
use Planner\Infrastructure\Persistence\Pdo\Notes\PdoNoteShareRepository;

/**
 * What the realtime server may do with the database: load a Note's text,
 * re-check a participant's access, and save the merged text through the
 * ordinary NoteService write path (validation, versioning, notifications).
 */
final readonly class NoteCollaborationService
{
    public function __construct(
        private PdoNoteRepository $notes,
        private PdoNoteShareRepository $shares,
        private NoteService $service,
        private NoteValidator $validator,
    ) {
    }

    public function load(int $ownerId, string $noteId): ?NoteRecord
    {
        return $this->notes->findOwned($ownerId, $noteId);
    }

    /** 'owner', 'edit' or 'view' while the user still has access to the live Note; null otherwise. */
    public function permission(int $userId, int $ownerId, string $noteId): ?string
    {
        if ($this->notes->findOwned($ownerId, $noteId) === null) {
            return null;
        }
        if ($userId === $ownerId) {
            return 'owner';
        }
        $share = $this->shares->findForNoteRecipient($noteId, $userId);

        return $share !== null && $share['status'] === 'accepted' && (int) $share['owner_id'] === $ownerId
            ? (string) $share['permission']
            : null;
    }

    /** Validates (422) and saves; 403 when the actor lost edit access, 404/410 when the Note is gone. */
    public function save(int $ownerId, string $noteId, int $actorId, string $title, string $content): NoteRecord
    {
        $text = $this->validator->text($title, $content);

        return $this->service->writeCollaborativeText($ownerId, $noteId, $actorId, $text['title'], $text['content']);
    }
}
