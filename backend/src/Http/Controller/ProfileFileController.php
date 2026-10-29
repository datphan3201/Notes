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
        private \Planner\Application\Files\BackgroundService $backgrounds,
    ) {
    }

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
    public function replaceBackground(Request $request): Response
    {
        $user = $this->auth->requireUser();
        if (array_keys($request->files) !== ['background']) {
            throw new \Planner\Http\ValidationException(['background' => ['Choose one background image.']]);
        }
        $file = $this->validator->avatar($request->input(), ['avatar' => $request->files['background']]);
        return Response::json(['data' => $this->backgrounds->add($user->id, $file)], 201);
    }

    public function removeBackground(Request $request): Response
    {
        $this->validator->empty($request->input(), $request->files);
        $this->backgrounds->remove($this->auth->requireUser()->id);
        return new Response(204);
    }

    public function background(Request $request): Response
    {
        return (new \Planner\Application\Files\FileStreamer)->avatar($this->backgrounds->authorized($this->auth->requireUser()->id));
    }

    public function backgrounds(Request $request): Response
    {
        return Response::json(['data' => $this->backgrounds->list($this->auth->requireUser()->id)]);
    }

    /** @param array<string, string> $parameters */
    public function deleteBackground(Request $request, array $parameters): Response
    {
        $user = $this->auth->requireUser();
        $this->validator->empty($request->input(), $request->files);
        $this->backgrounds->delete($user->id, $parameters['background']);
        return new Response(204);
    }

    /** @param array<string, string> $parameters */
    public function backgroundFile(Request $request, array $parameters): Response
    {
        return (new \Planner\Application\Files\FileStreamer)->avatar($this->backgrounds->authorized($this->auth->requireUser()->id, $parameters['background']));
    }
}
