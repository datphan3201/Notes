<?php

declare(strict_types=1);

namespace Planner\Infrastructure\Database;

use PDO;
use Planner\Config\Config;

final readonly class ConnectionFactory
{
    public function __construct(private Config $config) {}

    public function create(): PDO
    {
        $dsn = sprintf(
            'mysql:host=%s;port=%d;dbname=%s;charset=%s',
            $this->config->string('database.host'),
            $this->config->int('database.port'),
            $this->config->string('database.name'),
            $this->config->string('database.charset'),
        );

        $pdo = new PDO(
            $dsn,
            $this->config->string('database.user'),
            $this->config->string('database.password'),
            [
                PDO::ATTR_ERRMODE => PDO::ERRMODE_EXCEPTION,
                PDO::ATTR_DEFAULT_FETCH_MODE => PDO::FETCH_ASSOC,
                PDO::ATTR_EMULATE_PREPARES => false,
                PDO::ATTR_STRINGIFY_FETCHES => false,
            ],
        );

        $pdo->exec("SET time_zone = '+00:00'");
        $pdo->exec("SET SESSION sql_mode = 'STRICT_TRANS_TABLES,ERROR_FOR_DIVISION_BY_ZERO,NO_ENGINE_SUBSTITUTION'");

        return $pdo;
    }
}
