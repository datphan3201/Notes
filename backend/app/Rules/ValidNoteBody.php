<?php

namespace App\Rules;

use App\Support\TextNormalizer;
use Closure;
use Illuminate\Contracts\Validation\ValidationRule;

final class ValidNoteBody implements ValidationRule
{
    public function validate(string $attribute, mixed $value, Closure $fail): void
    {
        $body = TextNormalizer::body((string) $value);

        if (! TextNormalizer::hasNonWhitespace($body)) {
            $fail('Nội dung không được để trống.');

            return;
        }

        if (TextNormalizer::codePoints($body) > 50_000) {
            $fail('Nội dung không được vượt quá 50.000 ký tự.');

            return;
        }

        if (TextNormalizer::hasForbiddenBodyControl($body)) {
            $fail('Nội dung chứa ký tự điều khiển không hợp lệ.');
        }
    }
}
