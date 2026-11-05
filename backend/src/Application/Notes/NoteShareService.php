<?php

declare(strict_types=1);

namespace Planner\Application\Notes;

use Planner\Application\Notifications\NotificationService;
use Planner\Domain\Notes\NoteRecord;
use Planner\Http\HttpException;
use Planner\Http\ValidationException;
use Planner\Infrastructure\Database\TransactionManager;
use Planner\Infrastructure\Persistence\Pdo\Account\PdoAccountRepository;
use Planner\Infrastructure\Persistence\Pdo\Notes\PdoNoteRepository;
use Planner\Infrastructure\Persistence\Pdo\Notes\PdoNoteShareRepository;
use Planner\Support\Clock;
use Planner\Support\Timestamp;
use Planner\Support\UuidGenerator;

/**
 * Owner-controlled Note sharing. Recipients never gain tags, pinning, color,
 * attachments or deletion; edit recipients change only title and content.
 */
final readonly class NoteShareService
{
    public function __construct(
        private PdoNoteRepository $notes,
        private PdoNoteShareRepository $shares,
        private PdoAccountRepository $accounts,
        private NotificationService $notifications,
        private TransactionManager $transactions,
        private UuidGenerator $uuid,
        private Clock $clock,
        private ?NoteLockGate $lockGate = null,
    ) {
    }

    /**
     * Shares one owned Note with one or more registered accounts. Every address
     * is validated before anything is written: an address without an account,
     * or the owner's own address, rejects the whole request (422) and names the
     * offending addresses, so the owner can correct a typo. Existing recipients
     * get the new permission. Each new recipient receives an in-app invitation
     * and, when they allow it, an email.
     *
     * @param list<string> $emails normalized (lowercase, trimmed) and unique
     * @return list<array<string, mixed>>
     */
    public function shareMany(int $ownerId, string $noteId, array $emails, string $permission): array
    {
        return $this->transactions->run(function () use ($ownerId, $noteId, $emails, $permission): array {
            $owner = $this->lockUser($ownerId);
            $note = $this->ownedNote($ownerId, $noteId, true);
            $recipients = [];
            $unknown = [];
            foreach ($emails as $email) {
                $recipient = $this->accounts->publicByEmail($email);
                if ($recipient === null) {
                    $unknown[] = $email;
                    continue;
                }
                if ((int) $recipient['id'] === $ownerId) {
                    throw new ValidationException(['emails' => ['You already own this note.']]);
                }
                $recipients[(int) $recipient['id']] = $recipient;
            }
            if ($unknown !== []) {
                throw new ValidationException(['emails' => ['No Planner account uses: '.implode(', ', $unknown).'.']]);
            }
            ksort($recipients, SORT_NUMERIC);
            foreach (array_keys($recipients) as $recipientId) {
                $existing = $this->shares->findForNoteRecipient($noteId, $recipientId, true);
                if ($existing !== null) {
                    $this->shares->update((string) $existing['id'], ['permission' => $permission], $this->now());
                    continue;
                }
                $shareId = $this->uuid->generate();
                $this->shares->insert($shareId, $ownerId, $noteId, $recipientId, $permission, $this->now());
                $this->notifications->notify($recipientId, 'share_invite', $shareId, [
                    'title' => $owner->displayName.' shared a note with you',
                    'body' => $note->title.' ('.($permission === 'edit' ? 'can edit' : 'view only').')',
                    'url' => '/?shared=1',
                    'share_id' => $shareId,
                    'permission' => $permission,
                    // Facts the bell words in the reader's language; title/body stay for email and older clients.
                    'params' => ['actor' => $owner->displayName, 'note' => $note->title, 'permission' => $permission],
                ]);
            }

            return $this->serializeShares($ownerId, $noteId);
        });
    }

    /** @return list<array<string, mixed>> */
    public function share(int $ownerId, string $noteId, string $email, string $permission): array
    {
        return $this->shareMany($ownerId, $noteId, [$email], $permission);
    }

    /** 'view' or 'edit' for an accepted recipient of a live Note; null otherwise. */
    public function permissionFor(int $recipientId, string $noteId): ?string
    {
        $share = $this->shares->findForNoteRecipient($noteId, $recipientId);

        return $share !== null && $share['status'] === 'accepted' ? (string) $share['permission'] : null;
    }

    /** @return list<array<string, mixed>> */
    public function sharesFor(int $ownerId, string $noteId): array
    {
        $this->ownedNote($ownerId, $noteId);

        return $this->serializeShares($ownerId, $noteId);
    }

    public function changePermission(int $ownerId, string $noteId, string $shareId, string $permission): array
    {
        return $this->transactions->run(function () use ($ownerId, $noteId, $shareId, $permission): array {
            $this->lockUser($ownerId);
            $this->ownedNote($ownerId, $noteId, true);
            $share = $this->shares->findOwned($ownerId, $noteId, $shareId, true) ?? $this->notFound();
            $this->shares->update((string) $share['id'], ['permission' => $permission], $this->now());

            return $this->serializeShares($ownerId, $noteId);
        });
    }

    /** The owner removes ("kicks") a recipient, including a pending invitation. */
    public function remove(int $ownerId, string $noteId, string $shareId): array
    {
        return $this->transactions->run(function () use ($ownerId, $noteId, $shareId): array {
            $this->lockUser($ownerId);
            $this->ownedNote($ownerId, $noteId, true);
            $share = $this->shares->findOwned($ownerId, $noteId, $shareId, true) ?? $this->notFound();
            $this->shares->delete((string) $share['id']);
            $this->notifications->resolveSubject((int) $share['recipient_id'], 'share_invite', (string) $share['id']);

            return $this->serializeShares($ownerId, $noteId);
        });
    }

    /** @return array{invitations:list<array<string,mixed>>,notes:list<array<string,mixed>>} */
    public function received(int $recipientId): array
    {
        return [
            'invitations' => array_map(fn (array $row): array => $this->serializeReceived($row), $this->shares->received($recipientId, 'pending')),
            'notes' => array_map(fn (array $row): array => $this->serializeReceived($row), $this->shares->received($recipientId, 'accepted')),
        ];
    }

    public function respond(int $recipientId, string $shareId, bool $accept): void
    {
        $this->transactions->run(function () use ($recipientId, $shareId, $accept): void {
            $recipient = $this->lockUser($recipientId);
            $share = $this->shares->findReceived($recipientId, $shareId, true) ?? $this->notFound();
            $this->notifications->resolveSubject($recipientId, 'share_invite', $shareId);
            if (! $accept) {
                $this->shares->delete($shareId);

                return;
            }
            if ($share['status'] === 'accepted') {
                return;
            }
            $this->shares->update($shareId, ['status' => 'accepted'], $this->now());
            $note = $this->notes->findOwned((int) $share['owner_id'], (string) $share['note_id']);
            $this->notifications->notify((int) $share['owner_id'], 'share_joined', (string) $share['note_id'], [
                'title' => $recipient->displayName.' joined your shared note',
                'body' => $note?->title ?? '',
                'url' => '/',
                'params' => ['actor' => $recipient->displayName, 'note' => $note?->title ?? ''],
            ]);
        });
    }

    public function leave(int $recipientId, string $shareId): void
    {
        $this->transactions->run(function () use ($recipientId, $shareId): void {
            $this->lockUser($recipientId);
            $this->shares->findReceived($recipientId, $shareId, true) ?? $this->notFound();
            $this->shares->delete($shareId);
        });
    }

    /** @return array<string, mixed> */
    public function showShared(int $recipientId, string $noteId): array
    {
        [$note, $share] = $this->accessible($recipientId, $noteId);
        $this->lockGate?->assertUnlocked($note);

        return $this->serializeSharedNote($note, $share);
    }

    /** @param array{base_version:int,title:string,content:string} $input */
    public function updateShared(int $recipientId, string $noteId, array $input): array
    {
        return $this->transactions->run(function () use ($recipientId, $noteId, $input): array {
            // Lock order: owner row, then the Note, then share rows. The
            // unlocked probe only discovers which owner row to lock first.
            $probe = $this->shares->findForNoteRecipient($noteId, $recipientId) ?? $this->notFound();
            $ownerId = (int) $probe['owner_id'];
            $this->lockUser($ownerId);
            $actor = $this->accounts->findById($recipientId) ?? $this->notFound();
            [$note, $share] = $this->accessible($recipientId, $noteId, true);
            $this->lockGate?->assertUnlocked($note);
            if ($share['permission'] !== 'edit') {
                throw new HttpException(403, 'FORBIDDEN', 'You can view this note but not edit it.');
            }
            if ($note->title === $input['title'] && $note->content === $input['content']) {
                return $this->serializeSharedNote($note, $share);
            }
            if ($input['base_version'] !== $note->version) {
                throw new HttpException(409, 'NOTE_CONFLICT', 'The note changed in another window.', payload: ['current' => $this->serializeSharedNote($note, $share)]);
            }
            $labelIds = array_map(static fn ($label): int => $label->id, $note->labels);
            sort($labelIds, SORT_NUMERIC);
            $updated = $this->notes->updateSnapshot($ownerId, $noteId, $input['title'], $input['content'], $note->color, $note->pinnedAt, $note->version + 1, $this->now(), $labelIds);
            $this->notifyCollaborators($updated, $recipientId, $actor->displayName);

            return $this->serializeSharedNote($updated, $share);
        });
    }

    /** Called by the owner's own save path so recipients learn about changes too. */
    public function noteChangedByOwner(NoteRecord $note, string $ownerName): void
    {
        $this->notifyCollaborators($note, $note->userId, $ownerName);
    }

    /** Called by collaborative writes, where the actor is the owner or an edit recipient. */
    public function noteChangedBy(NoteRecord $note, int $actorId, string $actorName): void
    {
        $this->notifyCollaborators($note, $actorId, $actorName);
    }

    /**
     * Moderation: withdraws a Note from every recipient, including pending invitations.
     *
     * @return list<int> recipients who lost access
     */
    public function revokeAll(int $ownerId, string $noteId): array
    {
        return $this->transactions->run(function () use ($ownerId, $noteId): array {
            $removed = $this->shares->deleteForNote($ownerId, $noteId);
            foreach ($removed as $share) {
                $this->notifications->resolveSubject($share['recipient_id'], 'share_invite', $share['id']);
            }

            return array_map(static fn (array $share): int => $share['recipient_id'], $removed);
        });
    }

    /** @return array{0:NoteRecord,1:array<string,mixed>} */
    public function accessible(int $recipientId, string $noteId, bool $forUpdate = false): array
    {
        $share = $this->shares->findForNoteRecipient($noteId, $recipientId, $forUpdate);
        if ($share === null || $share['status'] !== 'accepted') {
            $this->notFound();
        }
        $note = $this->notes->findOwned((int) $share['owner_id'], $noteId, false, $forUpdate) ?? $this->notFound();

        return [$note, $share];
    }

    /** @return list<array{id:string,display_name:string,email:string}> */
    public function contacts(int $userId): array
    {
        return $this->shares->contacts($userId);
    }

    private function notifyCollaborators(NoteRecord $note, int $actorId, string $actorName): void
    {
        $recipients = [$note->userId, ...$this->shares->acceptedRecipients($note->id)];
        foreach (array_unique($recipients) as $userId) {
            if ($userId === $actorId) {
                continue;
            }
            $this->notifications->notify($userId, 'shared_note_updated', $note->id, [
                'title' => $actorName.' updated a shared note',
                'body' => $note->title,
                'url' => $userId === $note->userId ? '/' : '/?shared=1',
                'params' => ['actor' => $actorName, 'note' => $note->title],
            ], coalesce: true);
        }
    }

    /** @return list<array<string, mixed>> */
    private function serializeShares(int $ownerId, string $noteId): array
    {
        return array_map(static fn (array $row): array => [
            'id' => (string) $row['id'],
            'recipient' => ['id' => (string) $row['recipient_id'], 'display_name' => (string) $row['display_name'], 'email' => (string) $row['email']],
            'permission' => (string) $row['permission'],
            'status' => (string) $row['status'],
            'created_at' => Timestamp::api((string) $row['created_at']),
        ], $this->shares->forNote($ownerId, $noteId));
    }

    /** @param array<string, mixed> $row @return array<string, mixed> */
    private function serializeReceived(array $row): array
    {
        return [
            'share_id' => (string) $row['share_id'],
            'note_id' => (string) $row['id'],
            'title' => (string) $row['title'],
            // A locked Note's text stays hidden until its password is entered.
            'excerpt' => $row['lock_hash'] === null ? (string) $row['excerpt'] : '',
            'is_locked' => $row['lock_hash'] !== null,
            'shared_at' => Timestamp::api((string) $row['shared_at']),
            'color' => (string) $row['color'],
            'permission' => (string) $row['permission'],
            'status' => (string) $row['status'],
            'owner' => ['id' => (string) $row['owner_id'], 'display_name' => (string) $row['owner_name'], 'email' => (string) $row['owner_email']],
            'updated_at' => Timestamp::api((string) $row['updated_at']),
        ];
    }

    /** @param array<string, mixed> $share @return array<string, mixed> */
    private function serializeSharedNote(NoteRecord $note, array $share): array
    {
        $owner = $this->accounts->publicProfiles([$note->userId])[$note->userId] ?? null;

        return [
            'id' => $note->id,
            'share_id' => (string) $share['id'],
            'title' => $note->title,
            'content' => $note->content,
            'color' => $note->color,
            'version' => $note->version,
            'permission' => (string) $share['permission'],
            'is_locked' => $note->isLocked(),
            'shared_at' => Timestamp::api((string) $share['created_at']),
            'owner' => $owner,
            'updated_at' => Timestamp::api($note->updatedAt),
        ];
    }

    private function ownedNote(int $ownerId, string $noteId, bool $forUpdate = false): NoteRecord
    {
        return $this->notes->findOwned($ownerId, $noteId, false, $forUpdate) ?? $this->notFound();
    }

    private function lockUser(int $userId): \Planner\Domain\Account\UserRecord
    {
        return $this->accounts->findById($userId, true) ?? throw new \RuntimeException('User disappeared.');
    }

    private function now(): string
    {
        return Timestamp::database($this->clock->now());
    }

    private function notFound(): never
    {
        throw new HttpException(404, 'NOT_FOUND', 'The requested resource was not found.');
    }
}
