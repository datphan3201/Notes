<?php

namespace App\Http\Requests;

use App\Rules\ValidLabelName;
use App\Support\TextNormalizer;

class LabelUpdateRequest extends ApiFormRequest
{
    protected array $allowedKeys = ['name', 'base_version'];

    protected function prepareForValidation(): void
    {
        $this->merge(['name' => TextNormalizer::label((string) $this->input('name', ''))]);
    }

    public function rules(): array
    {
        return [
            'name' => ['required', 'string', new ValidLabelName],
            'base_version' => ['required', 'integer', 'min:1'],
        ];
    }
}
