<?php

namespace App\Http\Requests;

use App\Rules\BcryptPassword;
use App\Support\TextNormalizer;
use Illuminate\Validation\Rule;

class RegisterRequest extends ApiFormRequest
{
    protected array $allowedKeys = [
        '_token', 'email', 'display_name', 'password', 'password_confirmation',
    ];

    protected function prepareForValidation(): void
    {
        $this->merge([
            'email' => TextNormalizer::email((string) $this->input('email', '')),
            'display_name' => TextNormalizer::displayName((string) $this->input('display_name', '')),
        ]);
    }

    public function rules(): array
    {
        return [
            'email' => [
                'required', 'string', 'max:254', 'email:rfc',
                'regex:/^[\x00-\x7F]+$/D',
                Rule::unique('users', 'email'),
            ],
            'display_name' => [
                'required', 'string', 'max:80',
                function (string $attribute, mixed $value, \Closure $fail): void {
                    if (TextNormalizer::codePoints((string) $value) < 1) {
                        $fail('Tên hiển thị không được để trống.');
                    } elseif (TextNormalizer::hasForbiddenIdentityControl((string) $value)) {
                        $fail('Tên hiển thị không được chứa xuống dòng hoặc ký tự điều khiển.');
                    }
                },
            ],
            'password' => ['required', 'string', new BcryptPassword],
            'password_confirmation' => ['required', 'same:password'],
        ];
    }

    public function messages(): array
    {
        return [
            'email.email' => 'Email không hợp lệ.',
            'email.regex' => 'Email chỉ dùng ký tự ASCII.',
            'email.unique' => 'Email này đã được đăng ký.',
            'password_confirmation.same' => 'Mật khẩu nhập lại không khớp.',
        ];
    }
}
