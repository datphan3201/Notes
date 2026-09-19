<?php

declare(strict_types=1);

namespace Planner\Domain\Planning;

enum MilestoneStatus: string
{
    case NotStarted = 'NotStarted';
    case InProgress = 'InProgress';
    case Completed = 'Completed';
}
