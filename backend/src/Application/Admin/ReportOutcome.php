<?php

declare(strict_types=1);

namespace Planner\Application\Admin;

use Planner\Http\ValidationException;

/** Keeps a report's status, the actions taken and the reporter's message consistent. */
final class ReportOutcome
{
    /**
     * "Resolved" needs an action now, or a target that is already locked; "dismissed" takes none.
     *
     * @param list<string> $actions
     */
    public static function assertConsistent(string $status, array $actions, bool $targetAlreadyLocked): void
    {
        if ($status === 'dismissed' && $actions !== []) {
            throw new ValidationException(['actions' => ['Dismissing a report takes no action. Choose Resolve to act.']]);
        }
        if ($status === 'resolved' && $actions === [] && ! $targetAlreadyLocked) {
            throw new ValidationException(['actions' => ['Choose an action to resolve this report, or dismiss it.']]);
        }
    }

    /**
     * The requested actions, each at most once and from the allowed set.
     *
     * @param list<string> $allowed
     *
     * @return list<string>
     */
    public static function parseActions(mixed $value, array $allowed): array
    {
        if ($value === null) {
            return [];
        }
        if (! is_array($value) || ! array_is_list($value) || array_diff($value, $allowed) !== [] || count(array_unique($value)) !== count($value)) {
            throw new ValidationException(['actions' => ['Choose actions from: '.implode(', ', $allowed).'.']]);
        }

        return array_values($value);
    }

    /** @param list<string> $actions */
    public static function describe(array $actions): string
    {
        $labels = [
            'revoke_shares' => 'sharing stopped',
            'warn_owner' => 'owner warned',
            'lock_owner' => 'owner locked',
            'warn_account' => 'account warned',
            'lock_account' => 'account locked',
        ];

        return implode(', ', array_map(static fn (string $action): string => $labels[$action] ?? $action, $actions));
    }

    public static function title(string $status): string
    {
        return $status === 'resolved'
            ? 'Your report was reviewed and action was taken'
            : 'Your report was reviewed. No action was needed';
    }

    /** @return list<string> */
    public static function decode(mixed $value): array
    {
        if (! is_string($value) || $value === '') {
            return [];
        }
        $decoded = json_decode($value, true);

        return is_array($decoded) ? array_values(array_filter($decoded, 'is_string')) : [];
    }
}
