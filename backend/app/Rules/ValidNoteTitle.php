<?php

namespace App\Rules;

use App\Support\TextNormalizer;
use Closure;
use Illuminate\Contracts\Validation\ValidationRule;

final class ValidNoteTitle implements ValidationRule
{
    public function validate(string $attribute, mixed $value, Closure $fail): void
    {
        $title = TextNormalizer::title((string) $value);

        if ($title === '' || TextNormalizer::codePoints($title) > 200) {
            $fail('Tiêu đề dài từ 1 đến 200 ký tự.');

            return;
        }

        if (TextNormalizer::hasForbiddenIdentityControl($title)) {
            $fail('Tiêu đề không được chứa xuống dòng hoặc ký tự điều khiển.');
        }
    }
}
