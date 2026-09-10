<?php

namespace App\Http\Requests;

use Illuminate\Foundation\Http\FormRequest;
use Illuminate\Validation\Validator;

abstract class ApiFormRequest extends FormRequest
{
    /** @var array<int, string> */
    protected array $allowedKeys = [];

    protected function withValidator(Validator $validator): void
    {
        $unknown = array_values(array_diff(array_keys($this->all()), $this->allowedKeys));

        if ($unknown !== []) {
            $validator->errors()->add('_unknown', 'Dữ liệu chứa trường không được phép.');
        }
    }
}
