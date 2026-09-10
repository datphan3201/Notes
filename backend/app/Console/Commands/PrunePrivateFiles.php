<?php

namespace App\Console\Commands;

use App\Actions\Files\ProcessFileDeletion;
use App\Models\Attachment;
use App\Models\User;
use Illuminate\Console\Command;
use Illuminate\Support\Facades\Storage;

class PrunePrivateFiles extends Command
{
    protected $signature = 'files:prune';

    protected $description = 'Dọn tệp riêng tư đã xóa và orphan cũ hơn một giờ';

    public function handle(ProcessFileDeletion $cleanup): int
    {
        $cleanup->handle();
        $disk = Storage::disk('private');
        $referenced = array_merge(
            Attachment::query()->whereNotNull('path')->pluck('path')->all(),
            User::query()->whereNotNull('avatar_path')->pluck('avatar_path')->all(),
        );
        $referenced = array_flip($referenced);
        $cutoff = now()->subHour()->timestamp;

        foreach (array_merge($disk->allFiles('attachments'), $disk->allFiles('avatars')) as $path) {
            if (isset($referenced[$path])) {
                continue;
            }
            try {
                if ($disk->lastModified($path) < $cutoff) {
                    $disk->delete($path);
                }
            } catch (\Throwable) {
                $this->warn('Không thể dọn tệp: '.basename($path));
            }
        }

        $this->info('Đã hoàn tất dọn tệp riêng tư.');

        return self::SUCCESS;
    }
}
