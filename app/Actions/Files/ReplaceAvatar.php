<?php

namespace App\Actions\Files;

use App\Models\PendingFileDeletion;
use App\Models\User;
use App\Rules\ValidAvatar;
use App\Support\OwnerMutation;
use Illuminate\Http\UploadedFile;
use Illuminate\Support\Facades\Storage;
use Illuminate\Support\Str;

final class ReplaceAvatar
{
    public function handle(User $user, UploadedFile $file): User
    {
        (new ValidAvatar)->inspect($file);
        $bytes = $this->makeJpeg($file);
        $path = 'avatars/'.Str::uuid()->toString().'.jpg';
        $disk = Storage::disk('private');
        $disk->put($path, $bytes);

        try {
            return OwnerMutation::run($user, function (User $locked) use ($path): User {
                if ($locked->avatar_path) {
                    PendingFileDeletion::firstOrCreate(['path' => $locked->avatar_path], [
                        'attempts' => 0,
                        'created_at' => now(),
                        'updated_at' => now(),
                    ]);
                }
                $locked->forceFill(['avatar_path' => $path, 'updated_at' => now()])->save();

                return $locked->fresh();
            });
        } catch (\Throwable $exception) {
            try {
                $disk->delete($path);
            } catch (\Throwable) { /* prune can recover */
            }
            throw $exception;
        }
    }

    private function makeJpeg(UploadedFile $file): string
    {
        $source = @imagecreatefromstring((string) file_get_contents($file->getRealPath()));
        if (! $source) {
            throw new \RuntimeException('Không thể đọc ảnh đại diện.');
        }
        $width = imagesx($source);
        $height = imagesy($source);
        $scale = min(512 / $width, 512 / $height, 1);
        $targetWidth = max(1, (int) round($width * $scale));
        $targetHeight = max(1, (int) round($height * $scale));
        $canvas = imagecreatetruecolor(512, 512);
        $white = imagecolorallocate($canvas, 255, 255, 255);
        imagefill($canvas, 0, 0, $white);
        imagecopyresampled($canvas, $source, (512 - $targetWidth) / 2, (512 - $targetHeight) / 2, 0, 0, $targetWidth, $targetHeight, $width, $height);
        ob_start();
        imagejpeg($canvas, null, 88);
        $bytes = (string) ob_get_clean();
        imagedestroy($source);
        imagedestroy($canvas);

        return $bytes;
    }
}
