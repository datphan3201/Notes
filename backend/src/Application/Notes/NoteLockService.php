<?php

declare(strict_types=1);

namespace Planner\Application\Notes;

use Planner\Domain\Notes\NoteRecord;
use Planner\Http\HttpException;
use Planner\Http\Security\RateLimiter;
use Planner\Http\ValidationException;
use Planner\Infrastructure\Database\TransactionManager;
use Planner\Infrastructure\Persistence\Pdo\Account\PdoAccountRepository;
use Planner\Infrastructure\Persistence\Pdo\Notes\PdoNoteRepository;
use Planner\Infrastructure\Persistence\Pdo\Notes\PdoNoteShareRepository;
use Planner\Support\Clock;
use Planner\Support\Timestamp;

/**
 * Per-Note passwords. Only the owner enables, changes or removes a password;
 * changing or removing requires the current password, and every new password
 * is typed twice. Anyone with access (owner or accepted recipient) unlocks a
 * Note for this session by entering its password.
 */
final readonly class NoteLockService
{
    public const MIN_LENGTH = 4;

    /** bcrypt only reads the first 72 bytes. */
    public const MAX_BYTES = 72;

    private const UNLOCK_ATTEMPTS = 8;

    private const UNLOCK_WINDOW_SECONDS = 300;

    public function __construct(
        private PdoNoteRepository $notes,
        private PdoNoteShareRepository $shares,
        private PdoAccountRepository $accounts,
        private TransactionManager $transactions,
        private NoteLockGate $gate,
        private RateLimiter $rateLimiter,
        private Clock $clock,
    ) {
    }

    /** @param array<string, mixed> $input */
    public function enable(int $userId, string $noteId, array $input): NoteRecord
    {
        $this->rejectUnknown($input, ['password', 'password_confirmation']);
        $password = $this->newPassword($input);

        $note = $this->transactions->run(function () use ($userId, $noteId, $password): NoteRecord {
            $note = $this->lockOwned($userId, $noteId);
            if ($note->isLocked()) {
                throw new HttpException(409, 'NOTE_ALREADY_LOCKED', 'This note already has a password. Change it instead.');
            }

            return $this->write($userId, $note, password_hash($password, PASSWORD_BCRYPT));
        });
        // The owner just proved knowledge of the password; keep the open note usable.
        $this->gate->grant($note);

        return $note;
    }

    /** @param array<string, mixed> $input */
    public function change(int $userId, string $noteId, array $input): NoteRecord
    {
        $this->rejectUnknown($input, ['current_password', 'password', 'password_confirmation']);
        $password = $this->newPassword($input);

        $note = $this->transactions->run(function () use ($userId, $noteId, $input, $password): NoteRecord {
            $note = $this->lockOwned($userId, $noteId);
            $this->assertCurrent($userId, $note, $input['current_password'] ?? null);
            if (password_verify($password, (string) $note->lockHash)) {
                throw new ValidationException(['password' => ['Choose a password different from the current one.']]);
            }

            return $this->write($userId, $note, password_hash($password, PASSWORD_BCRYPT));
        });
        $this->gate->grant($note);

        return $note;
    }

    /** @param array<string, mixed> $input */
    public function disable(int $userId, string $noteId, array $input): NoteRecord
    {
        $this->rejectUnknown($input, ['current_password']);

        $note = $this->transactions->run(function () use ($userId, $noteId, $input): NoteRecord {
            $note = $this->lockOwned($userId, $noteId);
            $this->assertCurrent($userId, $note, $input['current_password'] ?? null);

            return $this->write($userId, $note, null);
        });
        $this->gate->revoke($noteId);

        return $note;
    }

    /** @param array<string, mixed> $input */
    public function unlock(int $userId, string $noteId, array $input): NoteRecord
    {
        $this->rejectUnknown($input, ['password']);
        $note = $this->accessible($userId, $noteId);
        if (! $note->isLocked()) {
            return $note;
        }
        $this->verifyOrFail($userId, $note, $input['password'] ?? null, 'password');
        $this->gate->grant($note);

        return $note;
    }

    public function relock(int $userId, string $noteId): void
    {
        $this->accessible($userId, $noteId);
        $this->gate->revoke($noteId);
    }

    private function accessible(int $userId, string $noteId): NoteRecord
    {
        $owned = $this->notes->findOwned($userId, $noteId);
        if ($owned !== null) {
            return $owned;
        }

        $share = $this->shares->findForNoteRecipient($noteId, $userId);
        if ($share === null || $share['status'] !== 'accepted') {
            throw new HttpException(404, 'NOT_FOUND', 'The requested resource was not found.');
        }

        return $this->notes->findOwned((int) $share['owner_id'], $noteId)
            ?? throw new HttpException(404, 'NOT_FOUND', 'The requested resource was not found.');
    }

    private function lockOwned(int $userId, string $noteId): NoteRecord
    {
        $this->accounts->findById($userId, true) ?? throw new \RuntimeException('Authenticated user disappeared.');

        return $this->notes->findOwned($userId, $noteId, false, true)
            ?? throw new HttpException(404, 'NOT_FOUND', 'The requested resource was not found.');
    }

    private function write(int $userId, NoteRecord $note, ?string $hash): NoteRecord
    {
        $this->notes->setLock($userId, $note->id, $hash, $note->version + 1, Timestamp::database($this->clock->now()));

        return $this->notes->findOwned($userId, $note->id) ?? throw new \RuntimeException('Note disappeared.');
    }

    private function assertCurrent(int $userId, NoteRecord $note, mixed $current): void
    {
        if (! $note->isLocked()) {
            throw new HttpException(409, 'NOTE_NOT_LOCKED', 'This note does not have a password.');
        }
        $this->verifyOrFail($userId, $note, $current, 'current_password');
    }

    /** Wrong guesses are throttled per account and note to stop brute force. */
    private function verifyOrFail(int $userId, NoteRecord $note, mixed $password, string $field): void
    {
        $identity = $userId.':'.$note->id;
        $this->rateLimiter->assertAvailable('note-unlock', $identity, self::UNLOCK_ATTEMPTS);
        if (! is_string($password) || $password === '' || ! password_verify($password, (string) $note->lockHash)) {
            $this->rateLimiter->hit('note-unlock', $identity, self::UNLOCK_WINDOW_SECONDS);
            throw new ValidationException([$field => ['The note password is incorrect.']]);
        }
        $this->rateLimiter->clear('note-unlock', $identity);
    }

    /** @param array<string, mixed> $input */
    private function newPassword(array $input): string
    {
        $password = $input['password'] ?? null;
        $confirmation = $input['password_confirmation'] ?? null;
        $errors = [];
        if (! is_string($password) || mb_strlen($password, 'UTF-8') < self::MIN_LENGTH) {
            $errors['password'] = ['Use at least '.self::MIN_LENGTH.' characters.'];
        } elseif (strlen($password) > self::MAX_BYTES) {
            $errors['password'] = ['Use at most '.self::MAX_BYTES.' bytes.'];
        } elseif (! is_string($confirmation) || ! hash_equals($password, $confirmation)) {
            $errors['password_confirmation'] = ['The two passwords do not match.'];
        }
        if ($errors !== []) {
            throw new ValidationException($errors);
        }

        return $password;
    }

    /** @param array<string, mixed> $input @param list<string> $allowed */
    private function rejectUnknown(array $input, array $allowed): void
    {
        $unknown = array_diff(array_keys($input), $allowed);
        if ($unknown !== []) {
            throw new ValidationException(array_fill_keys(array_values(array_map('strval', $unknown)), ['This field is not allowed.']));
        }
    }
}
