<?php

declare(strict_types=1);

namespace Planner\Http\View;

final readonly class ViewContext
{
    public function __construct(private AssetManifest $assets) {}

    public function e(mixed $value): string
    {
        return htmlspecialchars((string) $value, ENT_QUOTES | ENT_SUBSTITUTE, 'UTF-8');
    }

    /** @param array<string, mixed> $value */
    public function jsonAttribute(array $value): string
    {
        $json = json_encode(
            $value,
            JSON_THROW_ON_ERROR | JSON_HEX_TAG | JSON_HEX_AMP | JSON_HEX_APOS | JSON_HEX_QUOT | JSON_UNESCAPED_UNICODE,
        );

        return $this->e($json);
    }

    /** @param array<string, list<string>> $errors */
    public function error(array $errors, string $field): ?string
    {
        $message = $errors[$field][0] ?? null;

        return is_string($message) ? $message : null;
    }

    /** @param array<string, string> $old */
    public function old(array $old, string $field): string
    {
        return $old[$field] ?? '';
    }

    public function initial(string $displayName): string
    {
        return mb_strtoupper(mb_substr($displayName, 0, 1, 'UTF-8'), 'UTF-8');
    }

    public function assets(): string
    {
        return $this->assets->tags(['src/css/app.css', 'src/js/app.js']);
    }
}
