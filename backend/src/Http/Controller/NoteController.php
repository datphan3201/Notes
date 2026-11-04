<?php

declare(strict_types=1);

namespace Planner\Http\Controller;

use Planner\Application\Account\AuthService;
use Planner\Application\Files\ProcessFileDeletion;
use Planner\Application\Notes\NoteLinkService;
use Planner\Application\Notes\NoteListQuery;
use Planner\Application\Notes\NoteSerializer;
use Planner\Application\Notes\NoteService;
use Planner\Application\Notes\NoteValidator;
use Planner\Http\Request;
use Planner\Http\Response;

final readonly class NoteController
{
    public function __construct(
        private AuthService $auth,
        private NoteService $notes,
        private NoteListQuery $list,
        private NoteValidator $validator,
        private NoteSerializer $serializer,
        private ProcessFileDeletion $cleanup,
        private NoteLinkService $links,
        private ?\Planner\Application\Notes\NoteSync $sync = null,
    ) {
    }

    /** A Note with its Goal/Task link (null when unlinked). @return array<string, mixed> */
    private function linked(int $userId, \Planner\Domain\Notes\NoteRecord $note): array
    {
        $shares = $this->notes->shareCounts($userId, [$note->id]);

        return [...$this->serializer->full($note, $shares[$note->id] ?? 0), 'link' => $this->links->forNotes($userId, [$note->id])[$note->id] ?? null];
    }

    /** @param array<string, string> $parameters */
    public function index(Request $request, array $parameters = []): Response
    {
        $user = $this->auth->requireUser();
        $input = $this->validator->listing($request->query);
        $page = $this->list->paginate($user->id, $input['q'], $input['label_ids'], $input['page'], $input['sort'], $input['direction']);

        $ids = array_map(static fn ($note): string => $note->id, $page['items']);
        $links = $this->links->forNotes($user->id, $ids);

        return Response::json([
            'data' => array_map(fn ($note): array => [...$this->serializer->summary($note), 'link' => $links[$note->id] ?? null], $page['items']),
            'meta' => [
                'current_page' => $page['current_page'],
                'per_page' => $page['per_page'],
                'last_page' => $page['last_page'],
                'total' => $page['total'],
            ],
        ]);
    }

    /** @param array<string, string> $parameters */
    public function store(Request $request, array $parameters = []): Response
    {
        $user = $this->auth->requireUser();
        $result = $this->notes->create($user->id, $this->validator->create($request->input()));

        return Response::json([
            'data' => $this->linked($user->id, $result['note']),
            'meta' => ['replayed' => $result['replayed']],
        ], $result['replayed'] ? 200 : 201);
    }

    /** @param array<string, string> $parameters */
    public function show(Request $request, array $parameters): Response
    {
        $user = $this->auth->requireUser();

        return Response::json([
            'data' => $this->linked($user->id, $this->notes->show($user->id, $parameters['note'])),
        ]);
    }

    /** @param array<string, string> $parameters */
    public function update(Request $request, array $parameters): Response
    {
        $user = $this->auth->requireUser();
        $note = $this->notes->update(
            $user->id,
            $parameters['note'],
            $this->validator->update($request->input()),
        );

        return Response::json(['data' => $this->linked($user->id, $note)]);
    }

    /** PUT /api/v1/notes/{note}/link {goal_id} | {task_id} | {} @param array<string, string> $parameters */
    public function link(Request $request, array $parameters): Response
    {
        $user = $this->auth->requireUser();

        return Response::json(['data' => $this->links->link($user->id, $parameters['note'], $request->input())]);
    }

    /** GET /api/v1/goals/{id}/notes @param array<string, string> $parameters */
    public function goalNotes(Request $request, array $parameters): Response
    {
        $user = $this->auth->requireUser();

        return Response::json(['data' => $this->links->notesFor($user->id, 'goal', $parameters['id'])]);
    }

    /** GET /api/v1/tasks/{id}/notes @param array<string, string> $parameters */
    public function taskNotes(Request $request, array $parameters): Response
    {
        $user = $this->auth->requireUser();

        return Response::json(['data' => $this->links->notesFor($user->id, 'task', $parameters['id'])]);
    }

    /** @param array<string, string> $parameters */
    public function background(Request $request, array $parameters): Response
    {
        $user = $this->auth->requireUser();
        $input = $request->input();
        $this->validator->rejectUnknown($input, ['attachment_id']);
        $attachmentId = $input['attachment_id'] ?? null;
        if ($attachmentId !== null && ! is_string($attachmentId)) {
            throw new \Planner\Http\ValidationException(['attachment_id' => ['Choose an image attached to this note.']]);
        }

        return Response::json(['data' => $this->serializer->full($this->notes->setBackground($user->id, $parameters['note'], $attachmentId))]);
    }

    /** PATCH /api/v1/notes/{note}/attributes {color?, is_pinned?, label_ids?} @param array<string, string> $parameters */
    public function attributes(Request $request, array $parameters): Response
    {
        $user = $this->auth->requireUser();
        $note = $this->notes->updateAttributes($user->id, $parameters['note'], $this->validator->attributes($request->input()));

        return Response::json(['data' => $this->linked($user->id, $note)]);
    }

    /** GET /api/v1/notes/sync?cursor= — offline delta feed. @param array<string, string> $parameters */
    public function sync(Request $request, array $parameters = []): Response
    {
        $user = $this->auth->requireUser();
        $cursor = $request->query['cursor'] ?? null;
        if ($cursor !== null && ! is_string($cursor)) {
            throw new \Planner\Http\ValidationException(['cursor' => ['The sync cursor is invalid. Start a full sync.']]);
        }

        return Response::json(['data' => $this->sync?->changes($user->id, $cursor) ?? throw new \LogicException('Sync is not wired.')]);
    }

    /** @param array<string, string> $parameters */
    public function destroy(Request $request, array $parameters): Response
    {
        $user = $this->auth->requireUser();
        $paths = $this->notes->delete(
            $user->id,
            $parameters['note'],
            $this->validator->delete($request->input()),
        );
        $this->cleanup->handle($paths);

        return new Response(204);
    }
}
