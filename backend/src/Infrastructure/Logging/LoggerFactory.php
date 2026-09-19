<?php

declare(strict_types=1);

namespace Planner\Infrastructure\Logging;

use Monolog\Handler\StreamHandler;
use Monolog\Level;
use Monolog\Logger;
use Planner\Config\Config;

final readonly class LoggerFactory
{
    public function __construct(private Config $config) {}

    public function create(): Logger
    {
        $path = $this->config->string('logging.path');
        $directory = dirname($path);

        if (! is_dir($directory) && ! mkdir($directory, 0770, true) && ! is_dir($directory)) {
            throw new \RuntimeException('Unable to create log directory.');
        }

        $level = Level::fromName($this->config->string('logging.level'));

        return new Logger('planner', [new StreamHandler($path, $level)]);
    }
}
