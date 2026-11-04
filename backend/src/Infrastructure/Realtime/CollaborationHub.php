<?php

declare(strict_types=1);

namespace Planner\Infrastructure\Realtime;

use Planner\Application\Notes\NoteCollaborationService;
use Planner\Domain\Realtime\TextOperation;
use Planner\Http\HttpException;
use Planner\Http\ValidationException;
use Planner\Support\Timestamp;
use Psr\Log\LoggerInterface;

/**
 * Live collaboration rooms, one per open Note.
 *
 * The hub is the single sequencer for each Note's title and content: every
 * client operation names the revision it was made against, is transformed
 * over the operations accepted since, applied, acknowledged to its author and
 * broadcast to everyone else (the classic ot.js server). Merged text is saved
 * through NoteCollaborationService shortly after typing pauses, at most a few
 * seconds apart, and when the last participant leaves.
 *
 * Transport-agnostic: the WebSocket server feeds messages in and supplies the
 * $send/$close callbacks, which keeps the hub unit-testable.
 */
final class CollaborationHub
{
    public const FIELDS = ['title', 'content'];

    private const HISTORY = 500;

    private const SAVE_IDLE_MS = 700;

    private const SAVE_MAX_MS = 3000;

    private const RETRY_MS = 5000;

    private const ACCESS_CHECK_MS = 5000;

    private const LIMITS = ['title' => 400, 'content' => 60_000];

    private const COLORS = ['#e8590c', '#2f9e44', '#1971c2', '#9c36b5', '#c2255c', '#0c8599', '#f08c00', '#5f3dc4'];

    /** @var array<string, array<string, mixed>> noteId => room */
    private array $rooms = [];

    /** @var array<int, array<string, mixed>> clientId => client */
    private array $clients = [];

    /**
     * @param \Closure(int, array<string, mixed>): void $send
     * @param \Closure(int, int, string): void $close
     */
    public function __construct(
        private readonly NoteCollaborationService $notes,
        private readonly \Closure $send,
        private readonly \Closure $close,
        private readonly ?LoggerInterface $logger = null,
    ) {
    }

    /** @param array{user_id:int,name:string,owner_id:int,note_id:string,permission:string} $claims */
    public function join(int $clientId, array $claims, int $nowMs): void
    {
        $noteId = $claims['note_id'];
        if (! isset($this->rooms[$noteId])) {
            $note = $this->notes->load($claims['owner_id'], $noteId);
            if ($note === null) {
                ($this->send)($clientId, ['type' => 'gone']);
                ($this->close)($clientId, 4404, 'Note not found');

                return;
            }
            $this->rooms[$noteId] = [
                'owner_id' => $note->userId,
                'docs' => [
                    'title' => ['text' => $note->title, 'rev' => 0, 'offset' => 0, 'history' => []],
                    'content' => ['text' => $note->content, 'rev' => 0, 'offset' => 0, 'history' => []],
                ],
                'version' => $note->version,
                'clients' => [],
                'dirty_since' => null,
                'last_edit' => null,
                'save_after' => null,
                'editor' => null,
                'save_state' => 'saved',
            ];
        }
        $room = &$this->rooms[$noteId];
        $usedColors = array_map(fn (int $id): string => $this->clients[$id]['color'], $room['clients']);
        $color = array_values(array_diff(self::COLORS, $usedColors))[0] ?? self::COLORS[$clientId % count(self::COLORS)];
        $this->clients[$clientId] = [
            'note_id' => $noteId,
            'user_id' => $claims['user_id'],
            'name' => mb_substr($claims['name'], 0, 80, 'UTF-8'),
            'permission' => $claims['permission'],
            'color' => $color,
            'cursor' => null,
            'checked_at' => $nowMs,
        ];
        $room['clients'][] = $clientId;
        ($this->send)($clientId, [
            'type' => 'init',
            'client_id' => $clientId,
            'color' => $color,
            'permission' => $claims['permission'],
            'version' => $room['version'],
            'save_state' => $room['save_state'],
            'title' => $room['docs']['title']['text'],
            'content' => $room['docs']['content']['text'],
            'revisions' => ['title' => $room['docs']['title']['rev'], 'content' => $room['docs']['content']['rev']],
            'peers' => $this->peers($noteId),
        ]);
        unset($room);
        $this->broadcastPeers($noteId, $clientId);
    }

    /** @param array<string, mixed> $message */
    public function message(int $clientId, array $message, int $nowMs): void
    {
        $client = $this->clients[$clientId] ?? null;
        if ($client === null) {
            return;
        }
        match ($message['type'] ?? null) {
            'op' => $this->operation($clientId, $message, $nowMs),
            'cursor' => $this->cursor($clientId, $message),
            'ping' => ($this->send)($clientId, ['type' => 'pong']),
            default => ($this->send)($clientId, ['type' => 'error', 'code' => 'UNKNOWN_MESSAGE']),
        };
    }

    public function leave(int $clientId, int $nowMs): void
    {
        $client = $this->clients[$clientId] ?? null;
        if ($client === null) {
            return;
        }
        unset($this->clients[$clientId]);
        $noteId = $client['note_id'];
        if (! isset($this->rooms[$noteId])) {
            return;
        }
        $this->rooms[$noteId]['clients'] = array_values(array_filter($this->rooms[$noteId]['clients'], static fn (int $id): bool => $id !== $clientId));
        if ($this->rooms[$noteId]['clients'] === []) {
            // Last one out saves the merged text before the room is forgotten.
            if ($this->rooms[$noteId]['dirty_since'] !== null) {
                $this->save($noteId, $nowMs);
            }
            unset($this->rooms[$noteId]);

            return;
        }
        $this->broadcastPeers($noteId, null);
    }

    /** Called by the event loop: saves due rooms and re-checks participants' access. */
    public function tick(int $nowMs): void
    {
        foreach (array_keys($this->rooms) as $noteId) {
            $room = $this->rooms[$noteId] ?? null;
            if ($room === null) {
                continue;
            }
            if ($room['save_after'] !== null && $nowMs >= $room['save_after']) {
                $this->save($noteId, $nowMs);
            }
            foreach ($room['clients'] as $clientId) {
                $client = $this->clients[$clientId] ?? null;
                if ($client === null || $client['permission'] === 'owner' || $nowMs - $client['checked_at'] < self::ACCESS_CHECK_MS) {
                    continue;
                }
                $this->recheck($clientId, $nowMs);
            }
        }
    }

    public function roomCount(): int
    {
        return count($this->rooms);
    }

    /** @return array<string, mixed>|null */
    public function roomState(string $noteId): ?array
    {
        return $this->rooms[$noteId] ?? null;
    }

    /** @param array<string, mixed> $message */
    private function operation(int $clientId, array $message, int $nowMs): void
    {
        $client = $this->clients[$clientId];
        $noteId = $client['note_id'];
        $field = $message['field'] ?? null;
        if (! in_array($client['permission'], ['owner', 'edit'], true)) {
            ($this->send)($clientId, ['type' => 'error', 'code' => 'READ_ONLY', 'message' => 'You can view this note but not edit it.']);

            return;
        }
        if (! is_string($field) || ! in_array($field, self::FIELDS, true) || ! is_int($message['rev'] ?? null)) {
            ($this->send)($clientId, ['type' => 'error', 'code' => 'BAD_OPERATION']);

            return;
        }
        $doc = &$this->rooms[$noteId]['docs'][$field];
        $revision = $message['rev'];
        $operation = TextOperation::fromWire($message['op'] ?? null);
        if ($operation === null || $revision > $doc['rev'] || $revision < $doc['offset']) {
            unset($doc);
            $this->resync($clientId, $field);

            return;
        }
        foreach (array_slice($doc['history'], $revision - $doc['offset']) as $concurrent) {
            $pair = TextOperation::transform($operation, $concurrent);
            if ($pair === null) {
                unset($doc);
                $this->resync($clientId, $field);

                return;
            }
            $operation = $pair[0];
        }
        $next = $operation->apply($doc['text']);
        if ($next === null) {
            unset($doc);
            $this->resync($clientId, $field);

            return;
        }
        if (TextOperation::length($next) > self::LIMITS[$field]) {
            unset($doc);
            ($this->send)($clientId, ['type' => 'error', 'code' => 'TOO_LONG', 'message' => 'The note is too long.']);
            $this->resync($clientId, $field);

            return;
        }
        $doc['text'] = $next;
        $doc['history'][] = $operation;
        $doc['rev']++;
        if (count($doc['history']) > self::HISTORY) {
            array_shift($doc['history']);
            $doc['offset']++;
        }
        $newRevision = $doc['rev'];
        unset($doc);

        $room = &$this->rooms[$noteId];
        $room['dirty_since'] ??= $nowMs;
        $room['last_edit'] = $nowMs;
        $room['editor'] = $client['user_id'];
        $room['save_after'] = min($nowMs + self::SAVE_IDLE_MS, $room['dirty_since'] + self::SAVE_MAX_MS);
        $announce = $room['save_state'] !== 'pending';
        $room['save_state'] = 'pending';
        $clients = $room['clients'];
        unset($room);

        ($this->send)($clientId, ['type' => 'ack', 'field' => $field, 'rev' => $newRevision]);
        foreach ($clients as $other) {
            if ($other !== $clientId) {
                ($this->send)($other, ['type' => 'op', 'field' => $field, 'rev' => $newRevision, 'op' => $operation->components, 'client' => $clientId]);
                if ($announce) {
                    ($this->send)($other, ['type' => 'save_state', 'state' => 'pending']);
                }
            }
        }
    }

    /** @param array<string, mixed> $message */
    private function cursor(int $clientId, array $message): void
    {
        $field = $message['field'] ?? null;
        $selection = $message['sel'] ?? null;
        $valid = is_string($field) && in_array($field, self::FIELDS, true)
            && is_array($selection) && count($selection) === 2 && is_int($selection[0] ?? null) && is_int($selection[1] ?? null);
        $this->clients[$clientId]['cursor'] = $valid ? ['field' => $field, 'sel' => [max(0, $selection[0]), max(0, $selection[1])]] : null;
        $noteId = $this->clients[$clientId]['note_id'];
        foreach ($this->rooms[$noteId]['clients'] as $other) {
            if ($other !== $clientId) {
                ($this->send)($other, ['type' => 'cursor', 'client' => $clientId, 'cursor' => $this->clients[$clientId]['cursor']]);
            }
        }
    }

    private function save(string $noteId, int $nowMs): void
    {
        $room = $this->rooms[$noteId];
        $actor = $room['editor'] ?? $room['owner_id'];
        try {
            $note = $this->notes->save($room['owner_id'], $noteId, $actor, $room['docs']['title']['text'], $room['docs']['content']['text']);
        } catch (ValidationException $exception) {
            // Wait for the next edit; an empty title or content cannot be saved.
            $this->rooms[$noteId]['save_after'] = null;
            $this->rooms[$noteId]['save_state'] = 'invalid';
            $this->broadcast($noteId, ['type' => 'save_state', 'state' => 'invalid', 'message' => $this->firstError($exception)]);

            return;
        } catch (HttpException $exception) {
            if ($exception->status === 403 && $actor !== $room['owner_id']) {
                // The last editor lost edit access: stop their socket, keep the merged text.
                foreach ($room['clients'] as $clientId) {
                    if (($this->clients[$clientId]['user_id'] ?? null) === $actor) {
                        $this->revoke($clientId, 'Your access to this note changed.');
                    }
                }
                if (isset($this->rooms[$noteId])) {
                    $this->rooms[$noteId]['editor'] = $room['owner_id'];
                    $this->rooms[$noteId]['save_after'] = $nowMs;
                }

                return;
            }
            if (in_array($exception->status, [404, 410], true)) {
                $this->broadcast($noteId, ['type' => 'gone']);
                foreach ($room['clients'] as $clientId) {
                    unset($this->clients[$clientId]);
                    ($this->close)($clientId, 4404, 'Note deleted');
                }
                unset($this->rooms[$noteId]);

                return;
            }
            $this->retryLater($noteId, $nowMs, $exception);

            return;
        } catch (\Throwable $exception) {
            $this->retryLater($noteId, $nowMs, $exception);

            return;
        }
        $this->rooms[$noteId]['version'] = $note->version;
        $this->rooms[$noteId]['dirty_since'] = null;
        $this->rooms[$noteId]['save_after'] = null;
        $this->rooms[$noteId]['editor'] = null;
        $this->rooms[$noteId]['save_state'] = 'saved';
        $this->broadcast($noteId, ['type' => 'saved', 'version' => $note->version, 'updated_at' => Timestamp::api($note->updatedAt)]);
    }

    private function retryLater(string $noteId, int $nowMs, \Throwable $exception): void
    {
        $this->logger?->warning('Realtime save failed; will retry.', ['note' => $noteId, 'error' => $exception->getMessage()]);
        $this->rooms[$noteId]['save_after'] = $nowMs + self::RETRY_MS;
        $this->rooms[$noteId]['save_state'] = 'error';
        $this->broadcast($noteId, ['type' => 'save_state', 'state' => 'error', 'message' => 'Saving is delayed. Your edits are kept and will be saved automatically.']);
    }

    private function recheck(int $clientId, int $nowMs): void
    {
        $client = $this->clients[$clientId];
        $room = $this->rooms[$client['note_id']];
        try {
            $permission = $this->notes->permission($client['user_id'], $room['owner_id'], $client['note_id']);
        } catch (\Throwable) {
            return;
        }
        $this->clients[$clientId]['checked_at'] = $nowMs;
        if ($permission === null) {
            $this->revoke($clientId, 'This note is no longer shared with you.');
        } elseif ($permission !== $client['permission']) {
            $this->clients[$clientId]['permission'] = $permission;
            ($this->send)($clientId, ['type' => 'permission', 'permission' => $permission]);
            $this->broadcastPeers($client['note_id'], null);
        }
    }

    private function revoke(int $clientId, string $message): void
    {
        ($this->send)($clientId, ['type' => 'revoked', 'message' => $message]);
        $noteId = $this->clients[$clientId]['note_id'];
        unset($this->clients[$clientId]);
        if (isset($this->rooms[$noteId])) {
            $this->rooms[$noteId]['clients'] = array_values(array_filter($this->rooms[$noteId]['clients'], static fn (int $id): bool => $id !== $clientId));
        }
        ($this->close)($clientId, 4403, 'Access revoked');
        if (isset($this->rooms[$noteId])) {
            $this->broadcastPeers($noteId, null);
        }
    }

    private function resync(int $clientId, string $field): void
    {
        $noteId = $this->clients[$clientId]['note_id'];
        $doc = $this->rooms[$noteId]['docs'][$field];
        ($this->send)($clientId, ['type' => 'resync', 'field' => $field, 'rev' => $doc['rev'], 'text' => $doc['text']]);
    }

    /** @return list<array{client:int,user_id:int,name:string,color:string,permission:string,cursor:mixed}> */
    private function peers(string $noteId): array
    {
        return array_map(fn (int $id): array => [
            'client' => $id,
            'user_id' => $this->clients[$id]['user_id'],
            'name' => $this->clients[$id]['name'],
            'color' => $this->clients[$id]['color'],
            'permission' => $this->clients[$id]['permission'],
            'cursor' => $this->clients[$id]['cursor'],
        ], $this->rooms[$noteId]['clients']);
    }

    private function broadcastPeers(string $noteId, ?int $except): void
    {
        $this->broadcast($noteId, ['type' => 'peers', 'peers' => $this->peers($noteId)], $except);
    }

    /** @param array<string, mixed> $message */
    private function broadcast(string $noteId, array $message, ?int $except = null): void
    {
        foreach ($this->rooms[$noteId]['clients'] ?? [] as $clientId) {
            if ($clientId !== $except) {
                ($this->send)($clientId, $message);
            }
        }
    }

    private function firstError(ValidationException $exception): string
    {
        foreach ($exception->errors as $messages) {
            return (string) ($messages[0] ?? 'The note cannot be saved yet.');
        }

        return 'The note cannot be saved yet.';
    }
}
