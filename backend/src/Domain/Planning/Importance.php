<?php

declare(strict_types=1);

namespace Planner\Domain\Planning;

use InvalidArgumentException;

final readonly class Importance
{
    public function __construct(public int $value)
    {
        if ($value < 1 || $value > 5) {
            throw new InvalidArgumentException('Importance must be between 1 and 5.');
        }
    }
}
