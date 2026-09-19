<?php

declare(strict_types=1);

namespace Planner\Domain\Planning;

enum TaskStatus: string
{
    case NotStarted = 'NotStarted';
    case InProgress = 'InProgress';
    case Blocked = 'Blocked';
    case Done = 'Done';
}
