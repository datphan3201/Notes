<?php

declare(strict_types=1);

namespace Planner\Http\View;

use RuntimeException;

final readonly class ViewRenderer
{
    private string $root;

    public function __construct(string $templateRoot, private ViewContext $context)
    {
        $root = realpath($templateRoot);

        if ($root === false || !is_dir($root)) {
            throw new RuntimeException('View template root is unavailable.');
        }

        $this->root = rtrim($root, '/');
    }

    /** @param array<string, mixed> $data */
    public function render(string $template, array $data = [], ?string $layout = null): string
    {
        if (array_key_exists('view', $data) || array_key_exists('content', $data)) {
            throw new RuntimeException('Reserved view data key supplied.');
        }

        $content = $this->capture($this->resolve($template), $data);

        if ($layout === null) {
            return $content;
        }

        return $this->capture($this->resolve($layout), [...$data, 'content' => $content]);
    }

    /** @param array<string, mixed> $data */
    private function capture(string $path, array $data): string
    {
        $view = $this->context;
        extract($data, EXTR_SKIP);
        ob_start();

        try {
            require $path;

            return (string) ob_get_contents();
        } finally {
            ob_end_clean();
        }
    }

    private function resolve(string $template): string
    {
        if (preg_match('#^[a-z0-9_/-]+$#D', $template) !== 1
            || str_starts_with($template, '/') || in_array('..', explode('/', $template), true)) {
            throw new RuntimeException('View template name is unsafe.');
        }

        $path = realpath($this->root.'/'.$template.'.php');

        if ($path === false || !str_starts_with($path, $this->root.'/') || !is_file($path)) {
            throw new RuntimeException("View template [$template] is missing.");
        }

        return $path;
    }
}
