<?php

namespace App\Http\Requests;

use App\Rules\ValidNoteBody;
use App\Rules\ValidNoteTitle;
use App\Support\NoteSnapshot;
use App\Support\TextNormalizer;
use Illuminate\Validation\Rule;

class NoteUpdateRequest extends ApiFormRequest
{
    protected array $allowedKeys = [
        'base_version', 'title', 'content', 'color', 'is_pinned', 'label_ids',
    ];

    protected function prepareForValidation(): void
    {
        $this->merge([
            'title' => TextNormalizer::title((string) $this->input('title', '')),
            'content' => TextNormalizer::body((string) $this->input('content', '')),
        ]);
    }

    public function rules(): array
    {
        return [
            'base_version' => ['required', 'integer', 'min:1'],
            'title' => ['required', 'string', new ValidNoteTitle],
            'content' => ['required', 'string', new ValidNoteBody],
            'color' => ['required', 'string', Rule::in(NoteSnapshot::COLORS)],
            'is_pinned' => ['required', 'boolean'],
            // Empty is the valid remove-all-labels snapshot, so present is
            // intentional here instead of Laravel's required rule.
            'label_ids' => ['present', 'array', 'max:20', 'distinct:strict'],
            'label_ids.*' => ['required', 'regex:/^\d+$/'],
        ];
    }
}
