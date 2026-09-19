<?php

declare(strict_types=1);

use Planner\Http\Request;

$runtime = require dirname(__DIR__).'/bootstrap/http.php';
$request = Request::fromGlobals();
$response = $runtime['application']->handle($request);
$response->emit($request->method === 'HEAD');
