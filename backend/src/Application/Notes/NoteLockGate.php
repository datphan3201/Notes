<?php

declare(strict_types=1);

namespace Planner\Application\Notes;

use Planner\Domain\Notes\NoteRecord;
use Planner\Http\HttpException;
use Planner\Infrastructure\Session\SessionManager;
use Planner\Support\Clock;

/**
 * Session-scoped proof that this browser entered a locked Note's password.
 *
 * A grant stores a fingerprint of the Note's current password hash, so changing
 * or removing the password invalidates every earlier grant. Grants expire after
 * a short idle period and are refreshed while the Note is being used.
 */
final readonly class NoteLockGate
{
    private const SESSION_KEY = 'note_unlocks';

    public const IDLE_SECONDS = 900;

    public function __construct(private ?SessionManager $session, private Clock $clock)
    {
    }

    public function isUnlocked(NoteRecord $note): bool
    {
        if (! $note->isLocked()) {
            return true;
        }

        $grant = $this->grants()[$note->id] ?? null;
        $now = $this->clock->now()->getTimestamp();

        if (! is_array($grant)
            || ! hash_equals((string) ($grant['fingerprint'] ?? ''), $this->fingerprint($note))
            || (int) ($grant['expires_at'] ?? 0) < $now) {
            return false;
        }

        $this->store($note, $now);

        return true;
    }

    /** Throws 423 NOTE_LOCKED unless this session unlocked the Note. */
    public function assertUnlocked(NoteRecord $note): void
    {
        if (! $this->isUnlocked($note)) {
            throw new HttpException(423, 'NOTE_LOCKED', 'Enter this note\'s password to continue.', payload: ['note_id' => $note->id]);
        }
    }

    public function grant(NoteRecord $note): void
    {
        if ($note->isLocked()) {
            $this->store($note, $this->clock->now()->getTimestamp());
        }
    }

    public function revoke(string $noteId): void
    {
        $grants = $this->grants();
        unset($grants[$noteId]);
        $this->session?->put(self::SESSION_KEY, $grants);
    }

    private function store(NoteRecord $note, int $now): void
    {
        $grants = array_filter(
            $this->grants(),
            static fn (mixed $grant): bool => is_array($grant) && (int) ($grant['expires_at'] ?? 0) >= $now,
        );
        $grants[$note->id] = ['fingerprint' => $this->fingerprint($note), 'expires_at' => $now + self::IDLE_SECONDS];
        $this->session?->put(self::SESSION_KEY, $grants);
    }

    /** @return array<string, mixed> */
    private function grants(): array
    {
        $grants = $this->session?->get(self::SESSION_KEY, []);

        return is_array($grants) ? $grants : [];
    }

    private function fingerprint(NoteRecord $note): string
    {
        return hash('sha256', (string) $note->lockHash);
    }
}
