<?php

declare(strict_types=1);

namespace Planner\Application\Notes;

use Planner\Domain\Notes\NoteSnapshot;
use Planner\Http\Validation\InputValidator;
use Planner\Http\ValidationException;
use Planner\Support\TextNormalizer;
use Ramsey\Uuid\Uuid;

final readonly class NoteValidator
{
    public function __construct(private InputValidator $input) {}

    /** @param array<string, mixed> $input @return array{id:string,title:string,content:string,color?:string} */
    public function create(array $input): array
    {
        $this->input->rejectUnknown($input, ['id', 'title', 'content', 'color']);
        $id = is_string($input['id'] ?? null) ? strtolower($input['id']) : '';
        $title = TextNormalizer::title(is_string($input['title'] ?? null) ? $input['title'] : '');
        $content = TextNormalizer::body(is_string($input['content'] ?? null) ? $input['content'] : '');
        $errors = [];

        if (! Uuid::isValid($id)) {
            $errors['id'][] = 'The note UUID is invalid.';
        }

        $this->validateTitle($title, $errors);
        $this->validateBody($content, $errors);
        $result = ['id' => $id, 'title' => $title, 'content' => $content];

        if (array_key_exists('color', $input)) {
            if (! is_string($input['color']) || ! in_array($input['color'], NoteSnapshot::COLORS, true)) {
                $errors['color'][] = 'The note color is invalid.';
            } else {
                $result['color'] = $input['color'];
            }
        }

        $this->input->throwIfErrors($errors);

        return $result;
    }

    /**
     * @param  array<string, mixed>  $input
     * @return array{base_version:int,title:string,content:string,color:string,is_pinned:bool,label_ids:list<int>}
     */
    public function update(array $input): array
    {
        $this->input->rejectUnknown($input, [
            'base_version', 'title', 'content', 'color', 'is_pinned', 'label_ids',
        ]);
        $title = TextNormalizer::title(is_string($input['title'] ?? null) ? $input['title'] : '');
        $content = TextNormalizer::body(is_string($input['content'] ?? null) ? $input['content'] : '');
        $baseVersion = $this->positiveInteger($input['base_version'] ?? null);
        $color = is_string($input['color'] ?? null) ? $input['color'] : '';
        $pinned = $this->boolean($input['is_pinned'] ?? null);
        $labelIds = $this->labelIds($input['label_ids'] ?? null);
        $errors = [];
        $this->validateTitle($title, $errors);
        $this->validateBody($content, $errors);

        if ($baseVersion === null) {
            $errors['base_version'][] = 'The base version is invalid.';
        }

        if (! in_array($color, NoteSnapshot::COLORS, true)) {
            $errors['color'][] = 'The note color is invalid.';
        }

        if ($pinned === null) {
            $errors['is_pinned'][] = 'The pinned state is invalid.';
        }

        if (! is_array($input['label_ids'] ?? null) || $labelIds === null || count($labelIds) > 20) {
            $errors['label_ids'][] = 'The tag list is invalid.';
        }

        $this->input->throwIfErrors($errors);

        return [
            'base_version' => $baseVersion,
            'title' => $title,
            'content' => $content,
            'color' => $color,
            'is_pinned' => $pinned,
            'label_ids' => $labelIds,
        ];
    }

    /** @param array<string, mixed> $input */
    public function delete(array $input): int
    {
        $this->input->rejectUnknown($input, ['base_version']);
        $baseVersion = $this->positiveInteger($input['base_version'] ?? null);

        if ($baseVersion === null) {
            throw new ValidationException(['base_version' => ['The base version is invalid.']]);
        }

        return $baseVersion;
    }

    /**
     * @param  array<string, string|list<string>>  $query
     * @return array{q:string,label_ids:list<int>,page:int}
     */
    public function listing(array $query): array
    {
        /** @var array<string, mixed> $values */
        $values = $query;
        $this->input->rejectUnknown($values, ['q', 'label_ids', 'page']);
        $qValue = $query['q'] ?? '';
        $q = TextNormalizer::nfc(trim(is_string($qValue) ? $qValue : ''));
        $pageValue = $query['page'] ?? '1';
        $page = $this->positiveInteger($pageValue);
        $rawLabels = $query['label_ids'] ?? [];
        $labelIds = $this->labelIds($rawLabels);
        $errors = [];

        if (! is_string($qValue) || TextNormalizer::codePoints($q) > 200) {
            $errors['q'][] = 'The search query is invalid.';
        }

        if ($page === null) {
            $errors['page'][] = 'The page number is invalid.';
        }

        if (! is_array($rawLabels) || $labelIds === null || count($labelIds) > 20) {
            $errors['label_ids'][] = 'The tag list is invalid.';
        }

        $this->input->throwIfErrors($errors);

        return ['q' => $q, 'label_ids' => $labelIds, 'page' => $page];
    }

    /** @param array<string, list<string>> $errors */
    private function validateTitle(string $title, array &$errors): void
    {
        if ($title === '' || TextNormalizer::codePoints($title) > 200) {
            $errors['title'][] = 'The title must contain between 1 and 200 characters.';
        } elseif (TextNormalizer::hasForbiddenIdentityControl($title)) {
            $errors['title'][] = 'The title cannot contain line breaks or control characters.';
        }
    }

    /** @param array<string, list<string>> $errors */
    private function validateBody(string $content, array &$errors): void
    {
        if (! TextNormalizer::hasNonWhitespace($content)) {
            $errors['content'][] = 'Content cannot be empty.';
        } elseif (TextNormalizer::codePoints($content) > 50_000) {
            $errors['content'][] = 'Content cannot exceed 50,000 characters.';
        } elseif (TextNormalizer::hasForbiddenBodyControl($content)) {
            $errors['content'][] = 'Content contains an invalid control character.';
        }
    }

    private function positiveInteger(mixed $value): ?int
    {
        if (is_int($value)) {
            return $value >= 1 ? $value : null;
        }

        if (is_string($value) && preg_match('/^[1-9][0-9]*$/D', $value) === 1) {
            $integer = filter_var($value, FILTER_VALIDATE_INT);

            return is_int($integer) ? $integer : null;
        }

        return null;
    }

    private function boolean(mixed $value): ?bool
    {
        return match ($value) {
            true, 1, '1' => true,
            false, 0, '0' => false,
            default => null,
        };
    }

    /** @return ?list<int> */
    private function labelIds(mixed $value): ?array
    {
        if (! is_array($value) || ! array_is_list($value)) {
            return null;
        }

        $ids = [];

        foreach ($value as $raw) {
            $id = $this->positiveInteger($raw);

            if ($id === null || in_array($id, $ids, true)) {
                return null;
            }

            $ids[] = $id;
        }

        sort($ids, SORT_NUMERIC);

        return $ids;
    }
}
