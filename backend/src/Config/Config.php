<?php

declare(strict_types=1);

namespace Planner\Config;

use InvalidArgumentException;

final readonly class Config
{
    /** @param array<string, mixed> $values */
    public function __construct(private array $values) {}

    public function string(string $key): string
    {
        $value = $this->value($key);

        if (! is_string($value)) {
            throw new InvalidArgumentException("Configuration [$key] must be a string.");
        }

        return $value;
    }

    public function int(string $key): int
    {
        $value = $this->value($key);

        if (! is_int($value)) {
            throw new InvalidArgumentException("Configuration [$key] must be an integer.");
        }

        return $value;
    }

    public function bool(string $key): bool
    {
        $value = $this->value($key);

        if (! is_bool($value)) {
            throw new InvalidArgumentException("Configuration [$key] must be a boolean.");
        }

        return $value;
    }

    /** @return list<string> */
    public function stringList(string $key): array
    {
        $value = $this->value($key);

        if (! is_array($value) || array_filter($value, static fn (mixed $item): bool => ! is_string($item)) !== []) {
            throw new InvalidArgumentException("Configuration [$key] must be a list of strings.");
        }

        return array_values($value);
    }

    public function nullableString(string $key): ?string
    {
        $value = $this->value($key);

        if ($value !== null && ! is_string($value)) {
            throw new InvalidArgumentException("Configuration [$key] must be a string or null.");
        }

        return $value;
    }

    private function value(string $key): mixed
    {
        $segments = explode('.', $key);
        $value = $this->values;

        foreach ($segments as $segment) {
            if (! is_array($value) || ! array_key_exists($segment, $value)) {
                throw new InvalidArgumentException("Missing configuration [$key].");
            }

            $value = $value[$segment];
        }

        return $value;
    }
}
