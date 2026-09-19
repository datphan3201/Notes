<?php

declare(strict_types=1);

namespace Planner\Http\Controller;

use Planner\Application\Account\AuthService;
use Planner\Application\Files\AttachmentSerializer;
use Planner\Application\Files\FileService;
use Planner\Application\Files\UploadValidator;
use Planner\Http\Request;
use Planner\Http\Response;

final readonly class AttachmentController
{
    public function __construct(
        private AuthService $auth,
        private FileService $files,
        private UploadValidator $validator,
        private AttachmentSerializer $serializer,
    ) {}

    /** @param array<string, string> $parameters */
    public function index(Request $request, array $parameters): Response
    {
        $user = $this->auth->requireUser();
        $attachments = $this->files->listAttachments($user->id, $parameters['note']);

        return Response::json(['data' => array_map($this->serializer->one(...), $attachments)]);
    }

    /** @param array<string, string> $parameters */
    public function store(Request $request, array $parameters): Response
    {
        $user = $this->auth->requireUser();
        $input = $this->validator->attachment($request->input(), $request->files);
        $result = $this->files->uploadAttachment(
            $user->id,
            $parameters['note'],
            $input['id'],
            $input['file'],
        );

        return Response::json([
            'data' => $this->serializer->one($result['attachment']),
            'meta' => ['replayed' => $result['replayed']],
        ], $result['replayed'] ? 200 : 201);
    }

    /** @param array<string, string> $parameters */
    public function destroy(Request $request, array $parameters): Response
    {
        $user = $this->auth->requireUser();
        $this->validator->empty($request->input(), $request->files);
        $this->files->deleteAttachment(
            $user->id,
            $parameters['note'],
            $parameters['attachment'],
        );

        return new Response(204);
    }
}
