<?php

namespace App\Http\Requests;

use App\Support\TextNormalizer;

class NoteListRequest extends ApiFormRequest
{
    protected array $allowedKeys = ['q', 'label_ids', 'page'];

    protected function prepareForValidation(): void
    {
        $this->merge(['q' => TextNormalizer::nfc(trim((string) $this->input('q', '')))]);
    }

    public function rules(): array
    {
        return [
            'q' => ['nullable', 'string', 'max:200'],
            'label_ids' => ['sometimes', 'array', 'max:20', 'distinct:strict'],
            'label_ids.*' => ['required', 'regex:/^\d+$/'],
            'page' => ['sometimes', 'integer', 'min:1'],
        ];
    }
}
