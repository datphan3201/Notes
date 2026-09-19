<?php

declare(strict_types=1);

namespace Planner\Support;

use Ramsey\Uuid\Uuid;

final class UuidGenerator
{
    public function generate(): string
    {
        return strtolower(Uuid::uuid4()->toString());
    }
}
