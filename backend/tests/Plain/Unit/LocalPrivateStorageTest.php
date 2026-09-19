<?php

declare(strict_types=1);

namespace Tests\Plain\Unit;

use PHPUnit\Framework\TestCase;
use Planner\Infrastructure\Storage\LocalPrivateStorage;
use Planner\Support\UuidGenerator;
use RuntimeException;

final class LocalPrivateStorageTest extends TestCase
{
    private string $sandbox;

    protected function setUp(): void
    {
        $this->sandbox = '/tmp/planner-storage-unit-'.bin2hex(random_bytes(8));
        mkdir($this->sandbox.'/public', 0700, true);
    }

    protected function tearDown(): void
    {
        $this->deleteTree($this->sandbox);
    }

    public function test_private_bytes_round_trip_and_unsafe_paths_are_rejected(): void
    {
        $storage = new LocalPrivateStorage(
            $this->sandbox.'/private',
            $this->sandbox.'/public',
            new UuidGenerator,
        );
        $path = $storage->putBytes('attachments', 'private bytes', 'bin');

        self::assertStringStartsWith('attachments/', $path);
        self::assertSame('private bytes', file_get_contents($storage->resolve($path)));

        foreach (['', '../escape', '/absolute', 'attachments/../escape', 'attachments\\escape.bin'] as $unsafe) {
            try {
                $storage->resolve($unsafe);
                self::fail('Unsafe path was accepted: '.$unsafe);
            } catch (RuntimeException $exception) {
                self::assertStringContainsString('storage', strtolower($exception->getMessage()));
            }
        }

        $storage->delete($path);
        self::assertFileDoesNotExist($storage->root().'/'.$path);
        $storage->delete($path);
    }

    public function test_symlink_components_and_web_accessible_roots_are_rejected(): void
    {
        $storage = new LocalPrivateStorage(
            $this->sandbox.'/private',
            $this->sandbox.'/public',
            new UuidGenerator,
        );
        file_put_contents($this->sandbox.'/outside.bin', 'secret');
        $link = $storage->root().'/attachments/link.bin';
        symlink($this->sandbox.'/outside.bin', $link);

        $this->expectException(RuntimeException::class);
        $storage->resolve('attachments/link.bin');
    }

    public function test_canonical_root_cannot_resolve_under_public_directory(): void
    {
        mkdir($this->sandbox.'/public/private', 0700);

        $this->expectException(RuntimeException::class);
        new LocalPrivateStorage(
            $this->sandbox.'/public/private',
            $this->sandbox.'/public',
            new UuidGenerator,
        );
    }

    private function deleteTree(string $path): void
    {
        if (! is_dir($path) || is_link($path)) {
            if (file_exists($path) || is_link($path)) {
                unlink($path);
            }

            return;
        }

        foreach (new \FilesystemIterator($path, \FilesystemIterator::SKIP_DOTS) as $item) {
            $this->deleteTree($item->getPathname());
        }

        rmdir($path);
    }
}
