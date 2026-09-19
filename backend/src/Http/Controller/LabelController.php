<?php

declare(strict_types=1);

namespace Planner\Http\Controller;

use Planner\Application\Account\AuthService;
use Planner\Application\Tags\LabelSerializer;
use Planner\Application\Tags\TagService;
use Planner\Application\Tags\TagValidator;
use Planner\Http\HttpException;
use Planner\Http\Request;
use Planner\Http\Response;

final readonly class LabelController
{
    public function __construct(
        private AuthService $auth,
        private TagService $tags,
        private TagValidator $validator,
        private LabelSerializer $serializer,
    ) {}

    /** @param array<string, string> $parameters */
    public function index(Request $request, array $parameters = []): Response
    {
        $user = $this->auth->requireUser();

        return Response::json([
            'data' => array_map($this->serializer->one(...), $this->tags->list($user->id)),
        ]);
    }

    /** @param array<string, string> $parameters */
    public function store(Request $request, array $parameters = []): Response
    {
        $user = $this->auth->requireUser();
        $label = $this->tags->create($user->id, $this->validator->create($request->input()));

        return Response::json(['data' => $this->serializer->one($label)], 201);
    }

    /** @param array<string, string> $parameters */
    public function update(Request $request, array $parameters): Response
    {
        $user = $this->auth->requireUser();
        $labelId = $this->labelId($parameters['label']);
        $input = $this->validator->update($request->input());
        $label = $this->tags->rename($user->id, $labelId, $input['name'], $input['base_version']);

        return Response::json(['data' => $this->serializer->one($label)]);
    }

    /** @param array<string, string> $parameters */
    public function destroy(Request $request, array $parameters): Response
    {
        $user = $this->auth->requireUser();
        $this->tags->delete(
            $user->id,
            $this->labelId($parameters['label']),
            $this->validator->delete($request->input()),
        );

        return new Response(204);
    }

    /** @param array<string, string> $parameters */
    public function tagStore(Request $request, array $parameters = []): Response
    {
        $tag = $this->tags->createTag(
            $this->auth->requireUser()->id,
            $this->validator->tagCreate($request->input()),
        );

        return Response::json(['data' => $this->serializer->one($tag)], 201);
    }

    /** @param array<string, string> $parameters */
    public function tagShow(Request $request, array $parameters): Response
    {
        $tag = $this->tags->find(
            $this->auth->requireUser()->id,
            $this->labelId($parameters['tag']),
        );

        return Response::json(['data' => $this->serializer->one($tag)]);
    }

    /** @param array<string, string> $parameters */
    public function tagUpdate(Request $request, array $parameters): Response
    {
        $tag = $this->tags->updateTag(
            $this->auth->requireUser()->id,
            $this->labelId($parameters['tag']),
            $this->validator->tagUpdate($request->input()),
        );

        return Response::json(['data' => $this->serializer->one($tag)]);
    }

    /** @param array<string, string> $parameters */
    public function tagMove(Request $request, array $parameters): Response
    {
        $tag = $this->tags->updateTag(
            $this->auth->requireUser()->id,
            $this->labelId($parameters['tag']),
            $this->validator->move($request->input()),
        );

        return Response::json(['data' => $this->serializer->one($tag)]);
    }

    /** @param array<string, string> $parameters */
    public function tagDestroy(Request $request, array $parameters): Response
    {
        $this->tags->archiveTag(
            $this->auth->requireUser()->id,
            $this->labelId($parameters['tag']),
            $this->validator->delete($request->input()),
        );

        return new Response(204);
    }

    private function labelId(string $raw): int
    {
        if (preg_match('/^[1-9][0-9]*$/D', $raw) !== 1) {
            throw new HttpException(404, 'NOT_FOUND', 'The requested resource was not found.');
        }

        $value = filter_var($raw, FILTER_VALIDATE_INT);

        if (! is_int($value)) {
            throw new HttpException(404, 'NOT_FOUND', 'The requested resource was not found.');
        }

        return $value;
    }
}
