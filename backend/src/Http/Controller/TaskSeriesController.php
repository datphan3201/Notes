<?php

declare(strict_types=1);

namespace Planner\Http\Controller;

use Planner\Application\Account\AuthService;
use Planner\Application\Recurrence\TaskSeriesService;
use Planner\Http\Request;
use Planner\Http\Response;

final readonly class TaskSeriesController
{
    public function __construct(private AuthService $auth, private TaskSeriesService $series) {}

    public function index(Request $request, array $parameters = []): Response { return Response::json(['data' => $this->series->list($this->userId())]); }
    public function store(Request $request, array $parameters = []): Response { return Response::json(['data' => $this->series->create($this->userId(), $request->input())], 201); }
    public function show(Request $request, array $parameters): Response { return Response::json(['data' => $this->series->show($this->userId(), $parameters['id'])]); }
    public function update(Request $request, array $parameters): Response { return Response::json(['data' => $this->series->update($this->userId(), $parameters['id'], $request->input())]); }
    public function transition(Request $request, array $parameters): Response { return Response::json(['data' => $this->series->transition($this->userId(), $parameters['id'], $parameters['action'], $request->input())]); }
    public function preview(Request $request, array $parameters = []): Response { return Response::json(['data' => $this->series->preview($request->input())]); }
    private function userId(): int { return $this->auth->requireUser()->id; }
}
