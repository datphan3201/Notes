<?php

declare(strict_types=1);

namespace Planner\Support;

use DateTimeZone;
use IntlTimeZone;

final class TimeZoneNames
{
    /**
     * Browsers report ICU canonical names such as Asia/Saigon, while system tz
     * databases without legacy links only ship Asia/Ho_Chi_Minh. Map such an
     * alias to an equivalent identifier PHP accepts; null means unknown.
     */
    public static function canonical(string $value): ?string
    {
        $identifiers = DateTimeZone::listIdentifiers();

        if (in_array($value, $identifiers, true)) {
            return $value;
        }

        $count = IntlTimeZone::countEquivalentIDs($value);
        for ($index = 0; $index < $count; $index++) {
            $candidate = IntlTimeZone::getEquivalentID($value, $index);
            if (is_string($candidate) && in_array($candidate, $identifiers, true)) {
                return $candidate;
            }
        }

        return null;
    }
}
