<?php

declare(strict_types=1);

namespace Planner\Http\Controller;

use Planner\Application\Account\AuthService;
use Planner\Application\Reviews\ReviewService;
use Planner\Http\Request;
use Planner\Http\Response;

final readonly class ReviewController
{
    public function __construct(private AuthService $auth, private ReviewService $reviews) {}
    public function index(Request $request, array $parameters = []): Response { return Response::json(['data' => $this->reviews->list($this->userId())]); }
    public function store(Request $request, array $parameters = []): Response { return Response::json(['data' => $this->reviews->create($this->userId(), $request->input())], 201); }
    public function show(Request $request, array $parameters): Response { return Response::json(['data' => $this->reviews->show($this->userId(), $parameters['id'])]); }
    public function update(Request $request, array $parameters): Response { return Response::json(['data' => $this->reviews->update($this->userId(), $parameters['id'], $request->input())]); }
    public function transition(Request $request, array $parameters): Response { return Response::json(['data' => $this->reviews->transition($this->userId(), $parameters['id'], $parameters['action'], $request->input())]); }
    private function userId(): int { return $this->auth->requireUser()->id; }
}
