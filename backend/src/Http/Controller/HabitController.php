<?php

declare(strict_types=1);

namespace Planner\Http\Controller;

use Planner\Application\Account\AuthService;
use Planner\Application\Habits\HabitService;
use Planner\Http\Request;
use Planner\Http\Response;

final readonly class HabitController
{
    public function __construct(private AuthService $auth, private HabitService $habits) {}

    public function index(Request $request, array $parameters = []): Response { return Response::json(['data' => $this->habits->list($this->userId())]); }
    public function store(Request $request, array $parameters = []): Response { return Response::json(['data' => $this->habits->create($this->userId(), $request->input())], 201); }
    public function show(Request $request, array $parameters): Response { return Response::json(['data' => $this->habits->show($this->userId(), $parameters['id'])]); }
    public function update(Request $request, array $parameters): Response { return Response::json(['data' => $this->habits->update($this->userId(), $parameters['id'], $request->input())]); }
    public function archive(Request $request, array $parameters): Response { return Response::json(['data' => $this->habits->archive($this->userId(), $parameters['id'], $request->input())]); }
    public function history(Request $request, array $parameters): Response { return Response::json(['data' => $this->habits->history($this->userId(), $parameters['id'])]); }
    public function checkIn(Request $request, array $parameters): Response { return Response::json(['data' => $this->habits->checkIn($this->userId(), $parameters['id'], $parameters['date'])]); }
    public function undoCheckIn(Request $request, array $parameters): Response { $this->habits->undoCheckIn($this->userId(), $parameters['id'], $parameters['date']); return new Response(204); }
    public function addContribution(Request $request, array $parameters): Response { return Response::json(['data' => $this->habits->addContribution($this->userId(), $parameters['id'], $request->input())]); }
    public function removeContribution(Request $request, array $parameters): Response { return Response::json(['data' => $this->habits->removeContribution($this->userId(), $parameters['id'], $parameters['target'], $request->input())]); }
    private function userId(): int { return $this->auth->requireUser()->id; }
}
