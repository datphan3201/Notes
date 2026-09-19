<?php

declare(strict_types=1);

namespace Planner\Domain\Planning;

enum GoalStatus: string
{
    case Active = 'Active';
    case Completed = 'Completed';
}
