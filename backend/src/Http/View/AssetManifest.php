<?php

declare(strict_types=1);

namespace Planner\Http\View;

use RuntimeException;

final readonly class AssetManifest
{
    public function __construct(
        private string $publicRoot,
        private ?string $developmentUrl,
        private string $environment,
    ) {}

    /** @param non-empty-list<string> $entries */
    public function tags(array $entries): string
    {
        if ($this->developmentUrl !== null && trim($this->developmentUrl) !== '') {
            return $this->developmentTags($entries);
        }

        return $this->productionTags($entries);
    }

    /** @param non-empty-list<string> $entries */
    private function developmentTags(array $entries): string
    {
        if ($this->environment !== 'local') {
            throw new RuntimeException('Vite development URL is allowed only in local mode.');
        }

        $url = rtrim($this->developmentUrl ?? '', '/');
        $parts = parse_url($url);
        $host = strtolower((string) ($parts['host'] ?? ''));

        if (!in_array($parts['scheme'] ?? null, ['http', 'https'], true)
            || !in_array($host, ['127.0.0.1', 'localhost', '::1'], true)) {
            throw new RuntimeException('Vite development URL must use an allowed loopback host.');
        }

        $tags = ['<script type="module" src="'.$this->escape($url.'/@vite/client').'"></script>'];

        foreach ($entries as $entry) {
            $this->assertEntry($entry);
            $tags[] = '<script type="module" src="'.$this->escape($url.'/'.$entry).'"></script>';
        }

        return implode("\n", $tags);
    }

    /** @param non-empty-list<string> $entries */
    private function productionTags(array $entries): string
    {
        $manifestPath = rtrim($this->publicRoot, '/').'/build/manifest.json';
        $contents = @file_get_contents($manifestPath);

        if (!is_string($contents)) {
            throw new RuntimeException('Built asset manifest is missing.');
        }

        try {
            $manifest = json_decode($contents, true, 64, JSON_THROW_ON_ERROR);
        } catch (\JsonException) {
            throw new RuntimeException('Built asset manifest is invalid.');
        }

        if (!is_array($manifest) || array_is_list($manifest)) {
            throw new RuntimeException('Built asset manifest must be an object.');
        }

        $styles = [];
        $preloads = [];
        $scripts = [];
        $visited = [];

        foreach ($entries as $entry) {
            $this->collect($manifest, $entry, $styles, $preloads, $scripts, $visited, true);
        }

        $tags = [];

        foreach (array_keys($styles) as $file) {
            $tags[] = '<link rel="stylesheet" href="'.$this->escape('/build/'.$file).'">';
        }

        foreach (array_keys($preloads) as $file) {
            $tags[] = '<link rel="modulepreload" href="'.$this->escape('/build/'.$file).'">';
        }

        foreach (array_keys($scripts) as $file) {
            $tags[] = '<script type="module" src="'.$this->escape('/build/'.$file).'"></script>';
        }

        return implode("\n", $tags);
    }

    /**
     * @param array<string, mixed> $manifest
     * @param array<string, true> $styles
     * @param array<string, true> $preloads
     * @param array<string, true> $scripts
     * @param array<string, true> $visited
     */
    private function collect(
        array $manifest,
        string $entry,
        array &$styles,
        array &$preloads,
        array &$scripts,
        array &$visited,
        bool $root,
    ): void {
        $this->assertEntry($entry);

        if (isset($visited[$entry])) {
            return;
        }

        $visited[$entry] = true;
        $record = $manifest[$entry] ?? null;

        if (!is_array($record) || !is_string($record['file'] ?? null)) {
            throw new RuntimeException("Built asset entry [$entry] is missing or invalid.");
        }

        $file = $this->assetFile($record['file']);

        foreach ($record['css'] ?? [] as $css) {
            if (!is_string($css)) {
                throw new RuntimeException('Built asset CSS entry is invalid.');
            }

            $styles[$this->assetFile($css)] = true;
        }

        foreach ($record['imports'] ?? [] as $import) {
            if (!is_string($import)) {
                throw new RuntimeException('Built asset import is invalid.');
            }

            $this->collect($manifest, $import, $styles, $preloads, $scripts, $visited, false);
        }

        if (str_ends_with($file, '.css')) {
            $styles[$file] = true;
        } elseif ($root) {
            $scripts[$file] = true;
        } else {
            $preloads[$file] = true;
        }
    }

    private function assetFile(string $file): string
    {
        if ($file === '' || str_starts_with($file, '/') || str_contains($file, '\\')
            || str_contains($file, "\0") || in_array('..', explode('/', $file), true)) {
            throw new RuntimeException('Built asset path is unsafe.');
        }

        $path = rtrim($this->publicRoot, '/').'/build/'.$file;
        $canonical = realpath($path);
        $buildRoot = realpath(rtrim($this->publicRoot, '/').'/build');

        if ($canonical === false || $buildRoot === false
            || !str_starts_with($canonical, rtrim($buildRoot, '/').'/') || !is_file($canonical)) {
            throw new RuntimeException('Built asset file is missing or unsafe.');
        }

        return $file;
    }

    private function assertEntry(string $entry): void
    {
        if (preg_match('#^[A-Za-z0-9_./-]+$#D', $entry) !== 1
            || str_starts_with($entry, '/') || in_array('..', explode('/', $entry), true)) {
            throw new RuntimeException('Asset entry name is unsafe.');
        }
    }

    private function escape(string $value): string
    {
        return htmlspecialchars($value, ENT_QUOTES | ENT_SUBSTITUTE, 'UTF-8');
    }
}
