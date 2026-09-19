<?php

declare(strict_types=1);

namespace Planner\Application\Tags;

use Planner\Http\Validation\InputValidator;
use Planner\Http\ValidationException;
use Planner\Support\TextNormalizer;

final readonly class TagValidator
{
    public function __construct(private InputValidator $input) {}

    /** @param array<string, mixed> $input */
    public function create(array $input): string
    {
        $this->input->rejectUnknown($input, ['name']);

        return $this->name($input['name'] ?? null);
    }

    /** @param array<string, mixed> $input @return array{name:string,base_version:int} */
    public function update(array $input): array
    {
        $this->input->rejectUnknown($input, ['name', 'base_version']);

        return [
            'name' => $this->name($input['name'] ?? null),
            'base_version' => $this->version($input['base_version'] ?? null),
        ];
    }

    /** @param array<string, mixed> $input */
    public function delete(array $input): int
    {
        $this->input->rejectUnknown($input, ['base_version']);

        return $this->version($input['base_version'] ?? null);
    }

    /** @param array<string, mixed> $input @return array{name:string,parent_id:?int,color:string,position:int} */
    public function tagCreate(array $input): array
    {
        $this->input->rejectUnknown($input, ['name', 'parent_id', 'color', 'position']);

        return [
            'name' => $this->name($input['name'] ?? null),
            'parent_id' => $this->nullableId($input['parent_id'] ?? null),
            'color' => $this->color($input['color'] ?? 'neutral'),
            'position' => $this->position($input['position'] ?? 0),
        ];
    }

    /** @param array<string, mixed> $input @return array<string, mixed> */
    public function tagUpdate(array $input): array
    {
        $this->input->rejectUnknown($input, ['name', 'parent_id', 'color', 'position', 'base_version']);
        $result = ['base_version' => $this->version($input['base_version'] ?? null)];

        if (array_key_exists('name', $input)) {
            $result['name'] = $this->name($input['name']);
        }

        if (array_key_exists('parent_id', $input)) {
            $result['parent_id'] = $this->nullableId($input['parent_id']);
        }

        if (array_key_exists('color', $input)) {
            $result['color'] = $this->color($input['color']);
        }

        if (array_key_exists('position', $input)) {
            $result['position'] = $this->position($input['position']);
        }

        return $result;
    }

    /** @param array<string, mixed> $input @return array{parent_id:?int,position:int,base_version:int} */
    public function move(array $input): array
    {
        $this->input->rejectUnknown($input, ['parent_id', 'position', 'base_version']);

        return [
            'parent_id' => $this->nullableId($input['parent_id'] ?? null),
            'position' => $this->position($input['position'] ?? 0),
            'base_version' => $this->version($input['base_version'] ?? null),
        ];
    }

    private function name(mixed $value): string
    {
        $name = TextNormalizer::label(is_string($value) ? $value : '');

        if ($name === '' || TextNormalizer::codePoints($name) > 40
            || TextNormalizer::hasForbiddenIdentityControl($name)) {
            throw new ValidationException(['name' => ['The Tag name must contain 1 to 40 characters and no control characters.']]);
        }

        return $name;
    }

    private function version(mixed $value): int
    {
        if (is_int($value) && $value >= 1) {
            return $value;
        }

        if (is_string($value) && preg_match('/^[1-9][0-9]*$/D', $value) === 1) {
            $integer = filter_var($value, FILTER_VALIDATE_INT);

            if (is_int($integer)) {
                return $integer;
            }
        }

        throw new ValidationException(['base_version' => ['The base version is invalid.']]);
    }

    private function nullableId(mixed $value): ?int
    {
        if ($value === null) {
            return null;
        }

        if (is_string($value) && preg_match('/^[1-9][0-9]*$/D', $value) === 1) {
            $value = filter_var($value, FILTER_VALIDATE_INT);
        }

        if (!is_int($value) || $value < 1) {
            throw new ValidationException(['parent_id' => ['The parent Tag is invalid.']]);
        }

        return $value;
    }

    private function color(mixed $value): string
    {
        if (!is_string($value) || !in_array($value, ['neutral', 'lemon', 'mint', 'sky', 'rose'], true)) {
            throw new ValidationException(['color' => ['The Tag color is invalid.']]);
        }

        return $value;
    }

    private function position(mixed $value): int
    {
        if (!is_int($value) || $value < 0) {
            throw new ValidationException(['position' => ['The position is invalid.']]);
        }

        return $value;
    }
}
