<?php

namespace App\Http\Requests;

use App\Rules\ValidNoteBody;
use App\Rules\ValidNoteTitle;
use App\Support\NoteSnapshot;
use App\Support\TextNormalizer;
use Illuminate\Validation\Rule;

class NoteCreateRequest extends ApiFormRequest
{
    protected array $allowedKeys = ['id', 'title', 'content', 'color'];

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
            'id' => ['required', 'uuid'],
            'title' => ['required', 'string', new ValidNoteTitle],
            'content' => ['required', 'string', new ValidNoteBody],
            'color' => ['sometimes', 'string', Rule::in(NoteSnapshot::COLORS)],
        ];
    }
}
