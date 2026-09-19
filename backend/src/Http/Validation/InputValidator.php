<?php

declare(strict_types=1);

namespace Planner\Http\Validation;

use Planner\Http\ValidationException;

final class InputValidator
{
    /** @param array<string, mixed> $input @param list<string> $allowed */
    public function rejectUnknown(array $input, array $allowed): void
    {
        $unknown = array_values(array_diff(array_keys($input), $allowed));

        if ($unknown !== []) {
            throw new ValidationException(['_unknown' => ['The request contains an unsupported field.']]);
        }
    }

    /** @param array<string, list<string>> $errors */
    public function throwIfErrors(array $errors): void
    {
        if ($errors !== []) {
            throw new ValidationException($errors);
        }
    }
}
