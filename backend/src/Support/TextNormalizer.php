<?php

declare(strict_types=1);

namespace Planner\Support;

use Normalizer;

final class TextNormalizer
{
    public static function nfc(string $value): string
    {
        return Normalizer::normalize($value, Normalizer::FORM_C) ?: $value;
    }

    public static function codePoints(string $value): int
    {
        return mb_strlen($value, 'UTF-8');
    }

    public static function email(string $value): string
    {
        return strtolower(trim($value));
    }

    public static function displayName(string $value): string
    {
        return self::nfc(trim($value));
    }

    public static function title(string $value): string
    {
        return self::nfc(trim($value));
    }

    public static function body(string $value): string
    {
        return str_replace(["\r\n", "\r"], "\n", $value);
    }

    public static function label(string $value): string
    {
        return self::nfc(trim($value));
    }

    public static function hasForbiddenIdentityControl(string $value): bool
    {
        return preg_match('/[\x00-\x1F\x7F]/u', $value) === 1;
    }

    public static function hasForbiddenBodyControl(string $value): bool
    {
        return preg_match('/[\x00-\x08\x0B\x0C\x0E-\x1F\x7F]/u', $value) === 1;
    }

    public static function hasNonWhitespace(string $value): bool
    {
        return preg_match('/\S/u', $value) === 1;
    }
}
