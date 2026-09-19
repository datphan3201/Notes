<?php

declare(strict_types=1);

namespace Planner\Http\Controller;

use Planner\Application\Account\AuthService;
use Planner\Application\Planning\PlanningService;
use Planner\Http\Request;
use Planner\Http\Response;

final readonly class PlanningController
{
    public function __construct(private AuthService $auth, private PlanningService $planning) {}

    /** @param array<string, string> $parameters */
    public function index(Request $request, array $parameters): Response
    {
        return Response::json(['data' => $this->planning->list($parameters['resource'], $this->userId())]);
    }

    /** @param array<string, string> $parameters */
    public function store(Request $request, array $parameters): Response
    {
        return Response::json(['data' => $this->planning->create(
            $parameters['resource'],
            $this->userId(),
            $request->input(),
        )], 201);
    }

    /** @param array<string, string> $parameters */
    public function show(Request $request, array $parameters): Response
    {
        return Response::json(['data' => $this->planning->show(
            $parameters['resource'],
            $this->userId(),
            $parameters['id'],
        )]);
    }

    /** @param array<string, string> $parameters */
    public function update(Request $request, array $parameters): Response
    {
        return Response::json(['data' => $this->planning->update(
            $parameters['resource'],
            $this->userId(),
            $parameters['id'],
            $request->input(),
        )]);
    }

    /** @param array<string, string> $parameters */
    public function archive(Request $request, array $parameters): Response
    {
        return Response::json(['data' => $this->planning->archive(
            $parameters['resource'],
            $this->userId(),
            $parameters['id'],
            $request->input(),
        )]);
    }

    /** @param array<string, string> $parameters */
    public function moveGoal(Request $request, array $parameters): Response
    {
        return Response::json(['data' => $this->planning->moveGoal(
            $this->userId(),
            $parameters['id'],
            $request->input(),
        )]);
    }

    /** @param array<string, string> $parameters */
    public function transition(Request $request, array $parameters): Response
    {
        return Response::json(['data' => $this->planning->transition(
            $parameters['resource'],
            $this->userId(),
            $parameters['id'],
            $parameters['action'],
            $request->input(),
        )]);
    }

    /** @param array<string, string> $parameters */
    public function addDependency(Request $request, array $parameters): Response
    {
        return Response::json(['data' => $this->planning->addDependency(
            $this->userId(),
            $parameters['id'],
            $request->input(),
        )]);
    }

    /** @param array<string, string> $parameters */
    public function removeDependency(Request $request, array $parameters): Response
    {
        return Response::json(['data' => $this->planning->removeRelation(
            'dependency',
            'milestone',
            $this->userId(),
            $parameters['id'],
            $parameters['target'],
            $request->input(),
        )]);
    }

    /** @param array<string, string> $parameters */
    public function addContribution(Request $request, array $parameters): Response
    {
        return Response::json(['data' => $this->planning->addContribution(
            $parameters['resource'],
            $this->userId(),
            $parameters['id'],
            $request->input(),
        )]);
    }

    /** @param array<string, string> $parameters */
    public function removeContribution(Request $request, array $parameters): Response
    {
        return Response::json(['data' => $this->planning->removeRelation(
            'contribution',
            $parameters['resource'],
            $this->userId(),
            $parameters['id'],
            $parameters['target'],
            $request->input(),
        )]);
    }

    /** @param array<string, string> $parameters */
    public function checklist(Request $request, array $parameters): Response
    {
        return Response::json(['data' => $this->planning->checklist($this->userId(), $parameters['id'])]);
    }

    /** @param array<string, string> $parameters */
    public function createChecklist(Request $request, array $parameters): Response
    {
        return Response::json(['data' => $this->planning->createChecklist(
            $this->userId(),
            $parameters['id'],
            $request->input(),
        )], 201);
    }

    /** @param array<string, string> $parameters */
    public function updateChecklist(Request $request, array $parameters): Response
    {
        return Response::json(['data' => $this->planning->updateChecklist(
            $this->userId(),
            $parameters['id'],
            $parameters['item'],
            $request->input(),
        )]);
    }

    /** @param array<string, string> $parameters */
    public function archiveChecklist(Request $request, array $parameters): Response
    {
        return Response::json(['data' => $this->planning->archiveChecklist(
            $this->userId(),
            $parameters['id'],
            $parameters['item'],
            $request->input(),
        )]);
    }

    /** @param array<string, string> $parameters */
    public function taskNote(Request $request, array $parameters): Response
    {
        return Response::json(['data' => $this->planning->saveTaskNote(
            $this->userId(),
            $parameters['id'],
            $request->input(),
        )]);
    }

    /** @param array<string, string> $parameters */
    public function showTaskNote(Request $request, array $parameters): Response
    {
        return Response::json(['data' => $this->planning->taskNote(
            $this->userId(),
            $parameters['id'],
        )]);
    }

    /** @param array<string, string> $parameters */
    public function children(Request $request, array $parameters): Response
    {
        return Response::json(['data' => $this->planning->goalChildren($this->userId(), $parameters['id'])]);
    }

    /** @param array<string, string> $parameters */
    public function prerequisites(Request $request, array $parameters): Response
    {
        return Response::json(['data' => $this->planning->prerequisites($this->userId(), $parameters['id'])]);
    }

    /** @param array<string, string> $parameters */
    public function contributions(Request $request, array $parameters): Response
    {
        return Response::json(['data' => $this->planning->contributions(
            $parameters['resource'],
            $this->userId(),
            $parameters['id'],
        )]);
    }

    /** @param array<string, string> $parameters */
    public function reorder(Request $request, array $parameters): Response
    {
        return Response::json(['data' => $this->planning->reorder(
            $parameters['resource'],
            $this->userId(),
            $request->input(),
            $parameters['parent'] ?? null,
        )]);
    }

    private function userId(): int
    {
        return $this->auth->requireUser()->id;
    }
}
