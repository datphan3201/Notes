<?php

declare(strict_types=1);

namespace Planner\Application\Notes;

use Planner\Application\Planning\PlanningService;
use Planner\Http\HttpException;
use Planner\Http\Validation\InputValidator;
use Planner\Infrastructure\Database\TransactionManager;
use Planner\Infrastructure\Persistence\Pdo\Notes\PdoNoteLinkRepository;
use Planner\Support\Clock;
use Planner\Support\Timestamp;
use Ramsey\Uuid\Uuid;

/**
 * Links a Note to one Goal or one Task of the same owner. The link lives outside the Note's
 * autosave snapshot (like its background), so linking never conflicts with text edits.
 */
final readonly class NoteLinkService
{
    public function __construct(
        private NoteService $notes,
        private PlanningService $planning,
        private PdoNoteLinkRepository $links,
        private TransactionManager $transactions,
        private Clock $clock,
        private InputValidator $input,
    ) {
    }

    /**
     * Sets ({goal_id} or {task_id}) or clears ({}) the Note's link.
     *
     * @param array<string, mixed> $input
     * @return array{type:string,id:string,name:string}|null
     */
    public function link(int $userId, string $noteId, array $input): ?array
    {
        $this->input->rejectUnknown($input, ['goal_id', 'task_id']);
        $goalId = $input['goal_id'] ?? null;
        $taskId = $input['task_id'] ?? null;
        $errors = [];
        if ($goalId !== null && $taskId !== null) {
            $errors['link'][] = 'Link the note to one Goal or one Task, not both.';
        }
        foreach (['goal_id' => $goalId, 'task_id' => $taskId] as $field => $value) {
            if ($value !== null && (!is_string($value) || !Uuid::isValid($value))) {
                $errors[$field][] = 'The identifier is invalid.';
            }
        }
        $this->input->throwIfErrors($errors);

        return $this->transactions->run(function () use ($userId, $noteId, $goalId, $taskId): ?array {
            $this->notes->show($userId, $noteId);
            if ($goalId === null && $taskId === null) {
                $this->links->delete($userId, $noteId);

                return null;
            }
            $this->activeTarget($userId, $goalId !== null ? 'goal' : 'task', (string) ($goalId ?? $taskId));
            $this->links->save($userId, $noteId, $goalId, $taskId, Timestamp::database($this->clock->now()));

            return $this->links->forNotes($userId, [$noteId])[$noteId] ?? null;
        });
    }

    /**
     * @param list<string> $noteIds
     * @return array<string, array{type:string,id:string,name:string}>
     */
    public function forNotes(int $userId, array $noteIds): array
    {
        return $this->links->forNotes($userId, $noteIds);
    }

    /** @return list<array{id:string,title:string,content_preview:string,is_locked:bool,color:string,updated_at:string}> */
    public function notesFor(int $userId, string $type, string $targetId): array
    {
        $this->planning->show($type, $userId, $targetId);

        return array_map(static fn (array $row): array => [
            'id' => (string) $row['id'],
            'title' => (string) $row['title'],
            'content_preview' => $row['lock_hash'] === null ? mb_substr((string) $row['content'], 0, 240, 'UTF-8') : '',
            'is_locked' => $row['lock_hash'] !== null,
            'color' => (string) $row['color'],
            'updated_at' => (string) Timestamp::api((string) $row['updated_at']),
        ], $this->links->notesFor($userId, $type, $targetId));
    }

    /** Only active work the owner can see can be linked; anything else is reported as missing. */
    private function activeTarget(int $userId, string $type, string $id): void
    {
        $target = $this->planning->show($type, $userId, $id);
        if (($target['archived_at'] ?? null) !== null) {
            throw new HttpException(404, 'NOT_FOUND', 'The requested resource was not found.');
        }
    }
}
