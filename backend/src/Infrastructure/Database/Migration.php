<?php

declare(strict_types=1);

namespace Planner\Infrastructure\Database;

use PDO;

interface Migration
{
    public function name(): string;

    public function up(PDO $pdo): void;
}
