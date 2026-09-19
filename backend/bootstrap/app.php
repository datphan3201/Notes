<?php

declare(strict_types=1);

use Planner\Config\ConfigLoader;
use Planner\Infrastructure\Database\ConnectionFactory;
use Planner\Infrastructure\Database\MigrationRunner;
use Planner\Infrastructure\Database\TransactionManager;
use Planner\Support\SystemClock;
use Planner\Support\UuidGenerator;

$basePath = dirname(__DIR__);
require $basePath.'/vendor/autoload.php';

$config = (new ConfigLoader)->load($basePath);
$pdo = (new ConnectionFactory($config))->create();

return [
    'config' => $config,
    'pdo' => $pdo,
    'transactions' => new TransactionManager($pdo),
    'migrations' => new MigrationRunner($pdo, $basePath.'/database/plain-migrations', $config->string('database.name')),
    'clock' => new SystemClock,
    'uuid' => new UuidGenerator,
];
