<?php

declare(strict_types=1);

namespace Planner\Http\Controller;

use Planner\Application\Account\AuthService;
use Planner\Application\Files\ProcessFileDeletion;
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
    ) {}

    /** @param array<string, string> $parameters */
    public function index(Request $request, array $parameters = []): Response
    {
        $user = $this->auth->requireUser();
        $input = $this->validator->listing($request->query);
        $page = $this->list->paginate($user->id, $input['q'], $input['label_ids'], $input['page']);

        return Response::json([
            'data' => array_map($this->serializer->summary(...), $page['items']),
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
            'data' => $this->serializer->full($result['note']),
            'meta' => ['replayed' => $result['replayed']],
        ], $result['replayed'] ? 200 : 201);
    }

    /** @param array<string, string> $parameters */
    public function show(Request $request, array $parameters): Response
    {
        $user = $this->auth->requireUser();

        return Response::json([
            'data' => $this->serializer->full($this->notes->show($user->id, $parameters['note'])),
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

        return Response::json(['data' => $this->serializer->full($note)]);
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
