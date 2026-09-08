<?php

namespace App\Http\Requests;

use App\Rules\ValidLabelName;
use App\Support\TextNormalizer;

class LabelCreateRequest extends ApiFormRequest
{
    protected array $allowedKeys = ['name'];

    protected function prepareForValidation(): void
    {
        $this->merge(['name' => TextNormalizer::label((string) $this->input('name', ''))]);
    }

    public function rules(): array
    {
        return ['name' => ['required', 'string', new ValidLabelName]];
    }
}
