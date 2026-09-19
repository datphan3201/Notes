<?php

declare(strict_types=1);

namespace Planner\Support;

use DateTimeImmutable;
use DateTimeZone;

final class Timestamp
{
    public static function database(DateTimeImmutable $value): string
    {
        return $value->setTimezone(new DateTimeZone('UTC'))->format('Y-m-d H:i:s.u');
    }

    public static function api(?string $value): ?string
    {
        if ($value === null) {
            return null;
        }

        return (new DateTimeImmutable($value, new DateTimeZone('UTC')))
            ->setTimezone(new DateTimeZone('UTC'))
            ->format('Y-m-d\TH:i:s.u\Z');
    }
}
