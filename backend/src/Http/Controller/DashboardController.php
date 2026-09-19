<?php

declare(strict_types=1);

namespace Planner\Http\Controller;

use Planner\Application\Account\AuthService;
use Planner\Application\Dashboard\DashboardService;
use Planner\Http\Request;
use Planner\Http\Response;

final readonly class DashboardController
{
    public function __construct(private AuthService $auth, private DashboardService $dashboard) {}
    public function show(Request $request, array $parameters = []): Response { return Response::json(['data' => $this->dashboard->dashboard($this->userId(), $request->query['month'] ?? null)]); }
    public function selections(Request $request, array $parameters): Response { return Response::json(['data' => $this->dashboard->selections($parameters['type'], $this->userId())]); }
    public function addSelection(Request $request, array $parameters): Response { return Response::json(['data' => $this->dashboard->addSelection($parameters['type'], $this->userId(), $request->input())]); }
    public function removeSelection(Request $request, array $parameters): Response { $this->dashboard->removeSelection($parameters['type'], $this->userId(), $parameters['id']); return new Response(204); }
    public function reorder(Request $request, array $parameters): Response { return Response::json(['data' => $this->dashboard->reorder($parameters['type'], $this->userId(), $request->input())]); }
    private function userId(): int { return $this->auth->requireUser()->id; }
}
