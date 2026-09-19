<?php

declare(strict_types=1);

namespace Planner\Infrastructure\Storage;

use Planner\Support\UuidGenerator;
use RuntimeException;

final readonly class LocalPrivateStorage
{
    private string $root;

    public function __construct(string $configuredRoot, string $publicRoot, private UuidGenerator $uuids)
    {
        if (is_link($configuredRoot)) {
            throw new RuntimeException('Private storage root cannot be a symbolic link.');
        }

        if (! is_dir($configuredRoot) && ! mkdir($configuredRoot, 0700, true) && ! is_dir($configuredRoot)) {
            throw new RuntimeException('Private storage root could not be created.');
        }

        $root = realpath($configuredRoot);
        $public = realpath($publicRoot);

        if ($root === false || $public === false) {
            throw new RuntimeException('Storage paths could not be canonicalized.');
        }

        $root = rtrim($root, DIRECTORY_SEPARATOR);
        $public = rtrim($public, DIRECTORY_SEPARATOR);

        if ($root === $public || str_starts_with($root.DIRECTORY_SEPARATOR, $public.DIRECTORY_SEPARATOR)) {
            throw new RuntimeException('Private storage must be outside the public document root.');
        }

        foreach (['attachments', 'avatars'] as $directory) {
            $path = $root.DIRECTORY_SEPARATOR.$directory;

            if (is_link($path)) {
                throw new RuntimeException('Managed private directories cannot be symbolic links.');
            }

            if (! is_dir($path) && ! mkdir($path, 0700) && ! is_dir($path)) {
                throw new RuntimeException('Managed private directory could not be created.');
            }
        }

        $this->root = $root;
    }

    public function putUploaded(string $directory, string $temporaryPath, string $extension): string
    {
        if (! is_file($temporaryPath) || is_link($temporaryPath)) {
            throw new RuntimeException('Uploaded temporary file is unavailable.');
        }

        $relative = $this->generatedPath($directory, $extension);
        $this->writeFromStream($relative, $temporaryPath);

        return $relative;
    }

    public function putBytes(string $directory, string $bytes, string $extension): string
    {
        $relative = $this->generatedPath($directory, $extension);
        $absolute = $this->targetPath($relative);
        $temporary = $absolute.'.'.$this->uuids->generate().'.tmp';
        $handle = @fopen($temporary, 'xb');

        if ($handle === false) {
            throw new RuntimeException('Private file could not be created.');
        }

        try {
            try {
                $remaining = $bytes;

                while ($remaining !== '') {
                    $written = fwrite($handle, $remaining);

                    if ($written === false || $written === 0) {
                        throw new RuntimeException('Private file write failed.');
                    }

                    $remaining = substr($remaining, $written);
                }

                if (! fflush($handle)) {
                    throw new RuntimeException('Private file flush failed.');
                }
            } finally {
                fclose($handle);
            }
        } catch (\Throwable $exception) {
            @unlink($temporary);
            throw $exception;
        }

        if (! @rename($temporary, $absolute)) {
            @unlink($temporary);
            throw new RuntimeException('Private file could not be finalized.');
        }

        @chmod($absolute, 0600);

        return $relative;
    }

    public function resolve(string $relative): string
    {
        $target = $this->targetPath($relative);
        $this->assertNoSymlinkComponents($target);
        $canonical = realpath($target);

        if ($canonical === false || ! is_file($canonical) || ! $this->contains($canonical)) {
            throw new RuntimeException('Private file is unavailable.');
        }

        return $canonical;
    }

    public function delete(string $relative): void
    {
        $target = $this->targetPath($relative);
        $this->assertNoSymlinkComponents($target);

        if (! file_exists($target)) {
            return;
        }

        $canonical = realpath($target);

        if ($canonical === false || ! $this->contains($canonical) || ! is_file($canonical) || ! @unlink($canonical)) {
            throw new RuntimeException('Private file could not be deleted.');
        }
    }

    /** @return list<array{path:string,modified_at:int}> */
    public function managedFiles(): array
    {
        $files = [];

        foreach (['attachments', 'avatars'] as $directory) {
            $absoluteDirectory = $this->root.DIRECTORY_SEPARATOR.$directory;
            $iterator = new \FilesystemIterator($absoluteDirectory, \FilesystemIterator::SKIP_DOTS);

            foreach ($iterator as $item) {
                if ($item->isLink() || ! $item->isFile()) {
                    continue;
                }

                $files[] = [
                    'path' => $directory.'/'.$item->getFilename(),
                    'modified_at' => $item->getMTime(),
                ];
            }
        }

        usort($files, static fn (array $left, array $right): int => $left['path'] <=> $right['path']);

        return $files;
    }

    public function root(): string
    {
        return $this->root;
    }

    private function generatedPath(string $directory, string $extension): string
    {
        if (! in_array($directory, ['attachments', 'avatars'], true)
            || preg_match('/^[a-z0-9]+$/D', $extension) !== 1) {
            throw new RuntimeException('Invalid managed storage target.');
        }

        return $directory.'/'.$this->uuids->generate().'.'.$extension;
    }

    private function writeFromStream(string $relative, string $sourcePath): void
    {
        $absolute = $this->targetPath($relative);
        $temporary = $absolute.'.'.$this->uuids->generate().'.tmp';
        $source = @fopen($sourcePath, 'rb');
        $target = @fopen($temporary, 'xb');

        if ($source === false || $target === false) {
            if (is_resource($source)) {
                fclose($source);
            }

            if (is_resource($target)) {
                fclose($target);
            }

            @unlink($temporary);
            throw new RuntimeException('Private upload could not be opened.');
        }

        try {
            try {
                if (stream_copy_to_stream($source, $target) === false || ! fflush($target)) {
                    throw new RuntimeException('Private upload write failed.');
                }
            } finally {
                fclose($source);
                fclose($target);
            }
        } catch (\Throwable $exception) {
            @unlink($temporary);
            throw $exception;
        }

        if (! @rename($temporary, $absolute)) {
            @unlink($temporary);
            throw new RuntimeException('Private upload could not be finalized.');
        }

        @chmod($absolute, 0600);
    }

    private function targetPath(string $relative): string
    {
        $this->assertSafeRelative($relative);

        return $this->root.DIRECTORY_SEPARATOR.str_replace('/', DIRECTORY_SEPARATOR, $relative);
    }

    private function assertSafeRelative(string $relative): void
    {
        if ($relative === '' || str_starts_with($relative, '/') || str_contains($relative, '\\')
            || str_contains($relative, "\0")) {
            throw new RuntimeException('Unsafe private storage path.');
        }

        $segments = explode('/', $relative);

        if (count($segments) !== 2 || ! in_array($segments[0], ['attachments', 'avatars'], true)
            || $segments[1] === '' || in_array('.', $segments, true) || in_array('..', $segments, true)) {
            throw new RuntimeException('Unsafe private storage path.');
        }
    }

    private function assertNoSymlinkComponents(string $target): void
    {
        $relative = substr($target, strlen($this->root) + 1);
        $cursor = $this->root;

        foreach (explode(DIRECTORY_SEPARATOR, $relative) as $segment) {
            $cursor .= DIRECTORY_SEPARATOR.$segment;

            if (is_link($cursor)) {
                throw new RuntimeException('Symbolic links are forbidden in private storage.');
            }
        }
    }

    private function contains(string $canonical): bool
    {
        return str_starts_with($canonical, $this->root.DIRECTORY_SEPARATOR);
    }
}
