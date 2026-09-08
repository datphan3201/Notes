<?php

namespace App\Http\Requests;

use App\Support\TextNormalizer;

class ProfileUpdateRequest extends ApiFormRequest
{
    protected array $allowedKeys = ['display_name'];

    protected function prepareForValidation(): void
    {
        $this->merge([
            'display_name' => TextNormalizer::displayName((string) $this->input('display_name', '')),
        ]);
    }

    public function rules(): array
    {
        return [
            'display_name' => [
                'required', 'string', 'max:80',
                function (string $attribute, mixed $value, \Closure $fail): void {
                    if (TextNormalizer::codePoints((string) $value) < 1 || TextNormalizer::hasForbiddenIdentityControl((string) $value)) {
                        $fail('Tên hiển thị không hợp lệ.');
                    }
                },
            ],
        ];
    }
}
