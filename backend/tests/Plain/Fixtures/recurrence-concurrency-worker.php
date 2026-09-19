#!/usr/bin/env php
<?php

declare(strict_types=1);

$runtime = require dirname(__DIR__, 3).'/bootstrap/http.php';
$barrier = $argv[1] ?? '';
$deadline = microtime(true) + 10;

while (! file_exists($barrier) && microtime(true) < $deadline) {
    usleep(1_000);
}

if (! file_exists($barrier)) {
    fwrite(STDERR, "Concurrency barrier timed out.\n");
    exit(1);
}

$result = $runtime['task_series_service']->materialize();
fwrite(STDOUT, json_encode($result, JSON_THROW_ON_ERROR));
