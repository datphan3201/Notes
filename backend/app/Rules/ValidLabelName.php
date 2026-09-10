<?php

namespace App\Rules;

use App\Support\TextNormalizer;
use Closure;
use Illuminate\Contracts\Validation\ValidationRule;

final class ValidLabelName implements ValidationRule
{
    public function validate(string $attribute, mixed $value, Closure $fail): void
    {
        $name = TextNormalizer::label((string) $value);

        if ($name === '' || TextNormalizer::codePoints($name) > 40) {
            $fail('Tên nhãn dài từ 1 đến 40 ký tự.');

            return;
        }

        if (TextNormalizer::hasForbiddenIdentityControl($name)) {
            $fail('Tên nhãn không được chứa xuống dòng hoặc ký tự điều khiển.');
        }
    }
}
