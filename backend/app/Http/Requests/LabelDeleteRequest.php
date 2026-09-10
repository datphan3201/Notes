<?php

namespace App\Http\Requests;

class LabelDeleteRequest extends ApiFormRequest
{
    protected array $allowedKeys = ['base_version'];

    public function rules(): array
    {
        return ['base_version' => ['required', 'integer', 'min:1']];
    }
}
