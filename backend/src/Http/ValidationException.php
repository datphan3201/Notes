<?php

declare(strict_types=1);

namespace Planner\Http;

final class ValidationException extends HttpException
{
    /** @param array<string, list<string>> $errors */
    public function __construct(public readonly array $errors)
    {
        parent::__construct(422, 'VALIDATION_FAILED', 'The submitted data is invalid.');
    }
}
