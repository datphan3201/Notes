<?php

namespace App\Actions\Files;

use App\Models\PendingFileDeletion;
use Illuminate\Support\Facades\Log;
use Illuminate\Support\Facades\Storage;

final class ProcessFileDeletion
{
    /** @param array<int, string> $paths */
    public function handle(array $paths = []): void
    {
        $disk = Storage::disk('private');
        $pending = PendingFileDeletion::query()
            ->when($paths !== [], static fn ($query) => $query->whereIn('path', $paths))
            ->get();

        foreach ($pending as $item) {
            $path = (string) $item->path;

            try {
                // Missing files are already clean. Never allow a database path
                // to escape the managed private disk.
                if (! $this->safePath($path)) {
                    Log::warning('Rejected unsafe private cleanup path', ['id' => $item->id]);

                    continue;
                }

                $disk->delete($path);
                $item->delete();
            } catch (\Throwable $exception) {
                $item->increment('attempts');
                Log::warning('Private file cleanup will be retried', [
                    'id' => $item->id,
                    'attempts' => $item->attempts,
                ]);
            }
        }
    }

    private function safePath(string $path): bool
    {
        return $path !== ''
            && ! str_contains($path, '..')
            && ! str_starts_with($path, '/')
            && ! str_contains($path, '\\');
    }
}
