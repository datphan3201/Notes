<?php

declare(strict_types=1);

namespace Planner\Http\Controller;

use Planner\Application\Account\AuthService;
use Planner\Application\Files\FileService;
use Planner\Application\Files\FileStreamer;
use Planner\Http\Request;
use Planner\Http\Response;

final readonly class FileContentController
{
    public function __construct(
        private AuthService $auth,
        private FileService $files,
        private FileStreamer $streamer,
    ) {}

    /** @param array<string, string> $parameters */
    public function preview(Request $request, array $parameters): Response
    {
        return $this->attachment($request, $parameters['attachment'], true);
    }

    /** @param array<string, string> $parameters */
    public function download(Request $request, array $parameters): Response
    {
        return $this->attachment($request, $parameters['attachment'], false);
    }

    /** @param array<string, string> $parameters */
    public function avatar(Request $request, array $parameters = []): Response
    {
        $user = $this->auth->requireUser();

        return $this->streamer->avatar($this->files->authorizedAvatar($user->id));
    }

    private function attachment(Request $request, string $attachmentId, bool $preview): Response
    {
        $user = $this->auth->requireUser();
        $authorized = $this->files->authorizedAttachment($user->id, $attachmentId);

        return $this->streamer->attachment(
            $authorized['attachment'],
            $authorized['path'],
            $request,
            $preview,
        );
    }
}
