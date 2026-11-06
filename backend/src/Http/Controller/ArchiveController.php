<?php

declare(strict_types=1);

namespace Planner\Http\Controller;

use Planner\Application\Account\AuthService;
use Planner\Application\Archive\ArchiveService;
use Planner\Http\Request;
use Planner\Http\Response;

/** Settings › Archive: the owner's archived planning items and restoring them. */
final readonly class ArchiveController
{
    public function __construct(
        private AuthService $auth,
        private ArchiveService $archive,
    ) {
    }

    public function index(Request $request): Response
    {
        return Response::json(['data' => $this->archive->list($this->auth->requireUser()->id)]);
    }

    /** @param array<string, string> $parameters */
    public function destroy(Request $request, array $parameters): Response
    {
        return Response::json(['data' => $this->archive->destroy(
            $parameters['type'] ?? '',
            $this->auth->requireUser()->id,
            $parameters['id'] ?? '',
            $request->input(),
        )]);
    }

    public function empty(Request $request): Response
    {
        return Response::json(['data' => $this->archive->empty($this->auth->requireUser()->id, $request->input())]);
    }

    /** @param array<string, string> $parameters */
    public function restore(Request $request, array $parameters): Response
    {
        return Response::json(['data' => $this->archive->restore(
            $parameters['type'] ?? '',
            $this->auth->requireUser()->id,
            $parameters['id'] ?? '',
            $request->input(),
        )]);
    }
}
