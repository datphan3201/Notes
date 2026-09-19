<?php

declare(strict_types=1);

namespace Planner\Http\Controller;

use Planner\Application\Account\AccountSerializer;
use Planner\Application\Account\AuthService;
use Planner\Application\Files\FileService;
use Planner\Application\Files\UploadValidator;
use Planner\Http\Request;
use Planner\Http\Response;

final readonly class ProfileFileController
{
    public function __construct(
        private AuthService $auth,
        private FileService $files,
        private UploadValidator $validator,
        private AccountSerializer $serializer,
    ) {}

    /** @param array<string, string> $parameters */
    public function replaceAvatar(Request $request, array $parameters = []): Response
    {
        $user = $this->auth->requireUser();
        $file = $this->validator->avatar($request->input(), $request->files);
        $updated = $this->files->replaceAvatar($user->id, $file);

        return Response::json(['data' => $this->serializer->user($updated)]);
    }

    /** @param array<string, string> $parameters */
    public function removeAvatar(Request $request, array $parameters = []): Response
    {
        $user = $this->auth->requireUser();
        $this->validator->empty($request->input(), $request->files);
        $this->files->removeAvatar($user->id);

        return new Response(204);
    }
}
