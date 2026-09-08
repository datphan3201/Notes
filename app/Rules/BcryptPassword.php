<?php

namespace App\Rules;

use App\Support\TextNormalizer;
use Closure;
use Illuminate\Contracts\Validation\ValidationRule;

final class BcryptPassword implements ValidationRule
{
    public function validate(string $attribute, mixed $value, Closure $fail): void
    {
        $password = (string) $value;

        if (str_contains($password, "\0")) {
            $fail('Mật khẩu không được chứa ký tự NUL.');

            return;
        }

        $length = TextNormalizer::codePoints($password);
        $bytes = strlen($password);

        if ($length < 10) {
            $fail('Mật khẩu cần ít nhất 10 ký tự.');
        } elseif ($bytes > 72) {
            $fail('Mật khẩu không được vượt quá 72 byte.');
        }
    }
}
