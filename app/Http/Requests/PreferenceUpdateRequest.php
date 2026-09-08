<?php

namespace App\Http\Requests;

use App\Support\NoteSnapshot;
use Illuminate\Validation\Rule;
use Illuminate\Validation\Validator;

class PreferenceUpdateRequest extends ApiFormRequest
{
    protected array $allowedKeys = [
        'theme', 'note_font_size', 'default_note_color', 'notes_view',
    ];

    protected function withValidator(Validator $validator): void
    {
        parent::withValidator($validator);
        if ($this->all() === []) {
            $validator->errors()->add('_empty', 'Chọn ít nhất một tùy chọn.');
        }
    }

    public function rules(): array
    {
        return [
            'theme' => ['sometimes', 'string', Rule::in(['light', 'dark'])],
            'note_font_size' => ['sometimes', 'integer', Rule::in([14, 16, 18])],
            'default_note_color' => ['sometimes', 'string', Rule::in(NoteSnapshot::COLORS)],
            'notes_view' => ['sometimes', 'string', Rule::in(['grid', 'list'])],
        ];
    }
}
