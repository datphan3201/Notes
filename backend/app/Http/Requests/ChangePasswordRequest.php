<?php

namespace App\Http\Requests;

use App\Rules\BcryptPassword;

class ChangePasswordRequest extends ApiFormRequest
{
    protected array $allowedKeys = [
        '_token', 'current_password', 'password', 'password_confirmation',
    ];

    public function rules(): array
    {
        return [
            'current_password' => ['required', 'string'],
            'password' => ['required', 'string', new BcryptPassword],
            'password_confirmation' => ['required', 'same:password'],
        ];
    }

    public function messages(): array
    {
        return ['password_confirmation.same' => 'Mật khẩu nhập lại không khớp.'];
    }
}
