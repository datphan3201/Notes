<?php

declare(strict_types=1);

namespace Planner\Http\Controller;

use Planner\Application\Account\AuthService;
use Planner\Application\AI\AIActionService;
use Planner\Http\Request;
use Planner\Http\Response;

final readonly class AIActionController
{
    public function __construct(private AuthService $auth, private AIActionService $ai) {}
    public function store(Request $request, array $parameters = []): Response { return Response::json(['data'=>$this->ai->generate($this->userId(),$request->input())],201); }
    public function show(Request $request, array $parameters): Response { return Response::json(['data'=>$this->ai->show($this->userId(),$parameters['id'])]); }
    public function apply(Request $request, array $parameters): Response { return Response::json(['data'=>$this->ai->apply($this->userId(),$parameters['id'],$request->input())]); }
    public function reject(Request $request, array $parameters): Response { return Response::json(['data'=>$this->ai->reject($this->userId(),$parameters['id'],$request->input())]); }
    private function userId(): int { return $this->auth->requireUser()->id; }
}
