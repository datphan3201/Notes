<?php

declare(strict_types=1);

namespace Planner\Domain\Planning;

use Planner\Http\ValidationException;

/**
 * User-chosen icon and accent for Areas, Goals, Milestones and Habits. The names mirror the
 * frontend catalog (frontend/src/js/lib/entity-icons.js); null means the automatic default.
 */
final class EntityIcon
{
    public const ICONS = [
        'target', 'flag', 'star', 'heart', 'book', 'graduation', 'code', 'terminal', 'briefcase', 'chart',
        'money', 'wallet', 'cart', 'home', 'dumbbell', 'activity', 'bike', 'apple', 'droplet', 'moon',
        'sun', 'leaf', 'globe', 'plane', 'music', 'camera', 'palette', 'lightbulb', 'chat', 'users',
        'rocket', 'trophy', 'mountain', 'compass', 'clock', 'pen', 'flask', 'shield', 'language',
    ];

    /** Accent names; the frontend maps each to the hue the roadmap already uses. */
    public const COLORS = ['amber', 'violet', 'sky', 'coral', 'rose', 'teal', 'blue', 'purple'];

    public static function icon(mixed $value): ?string
    {
        if ($value === null) {
            return null;
        }

        return is_string($value) && in_array($value, self::ICONS, true)
            ? $value
            : throw new ValidationException(['icon' => ['Choose an icon from the list.']]);
    }

    public static function color(mixed $value): ?string
    {
        if ($value === null) {
            return null;
        }

        return is_string($value) && in_array($value, self::COLORS, true)
            ? $value
            : throw new ValidationException(['icon_color' => ['Choose a colour from the list.']]);
    }
}
