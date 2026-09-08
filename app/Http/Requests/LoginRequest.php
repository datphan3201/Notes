<?php

namespace App\Http\Requests;

use App\Support\TextNormalizer;

class LoginRequest extends ApiFormRequest
{
    protected array $allowedKeys = ['_token', 'email', 'password'];

    protected function prepareForValidation(): void
    {
        $this->merge(['email' => TextNormalizer::email((string) $this->input('email', ''))]);
    }

    public function rules(): array
    {
        return [
            'email' => ['required', 'string', 'max:254', 'email:rfc', 'regex:/^[\x00-\x7F]+$/D'],
            // Login deliberately does not apply the registration length rule;
            // it must return the same generic credential error for both fields.
            'password' => ['required', 'string'],
        ];
    }
}
