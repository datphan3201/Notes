<?php

declare(strict_types=1);

namespace Planner\Application\Notes;

use Planner\Http\ValidationException;
use Planner\Infrastructure\Persistence\Pdo\Notes\PdoNoteRepository;

/**
 * Delta feed for the browser's offline copy (IndexedDB). The opaque cursor
 * encodes the last (updated_at, id) pair the client stored; deletions arrive
 * as ids so the local copy can drop them. Locked Notes sync title and status
 * only: their text never leaves the server without the password.
 */
final readonly class NoteSync
{
    public const PAGE_SIZE = 200;

    public function __construct(
        private PdoNoteRepository $notes,
        private NoteSerializer $serializer,
    ) {
    }

    /** @return array{notes:list<array<string,mixed>>,deleted:list<string>,cursor:?string,has_more:bool} */
    public function changes(int $userId, ?string $cursor): array
    {
        [$afterTime, $afterId] = $this->decode($cursor);
        $rows = $this->notes->changedSince($userId, $afterTime, $afterId, self::PAGE_SIZE + 1);
        $hasMore = count($rows) > self::PAGE_SIZE;
        $rows = array_slice($rows, 0, self::PAGE_SIZE);
        $notes = [];
        $deleted = [];

        foreach ($rows as $note) {
            if ($note->deletedAt !== null) {
                $deleted[] = $note->id;
                continue;
            }
            $full = $this->serializer->full($note);
            unset($full['attachments']);
            $full['attachment_count'] = $note->attachmentCount;
            if ($note->isLocked()) {
                $full['content'] = '';
                $full['background_url'] = null;
            }
            $notes[] = $full;
        }

        $last = $rows === [] ? null : $rows[array_key_last($rows)];

        return [
            'notes' => $notes,
            'deleted' => $deleted,
            'cursor' => $last === null ? $cursor : $this->encode($last->updatedAt, $last->id),
            'has_more' => $hasMore,
        ];
    }

    private function encode(string $time, string $id): string
    {
        return rtrim(strtr(base64_encode($time.'|'.$id), '+/', '-_'), '=');
    }

    /** @return array{0:?string,1:?string} */
    private function decode(?string $cursor): array
    {
        if ($cursor === null || $cursor === '') {
            return [null, null];
        }
        $decoded = base64_decode(strtr($cursor, '-_', '+/'), true);
        if (! is_string($decoded)
            || preg_match('/^(\d{4}-\d{2}-\d{2} \d{2}:\d{2}:\d{2}\.\d{6})\|([0-9a-f-]{36})$/D', $decoded, $match) !== 1) {
            throw new ValidationException(['cursor' => ['The sync cursor is invalid. Start a full sync.']]);
        }

        return [$match[1], $match[2]];
    }
}
