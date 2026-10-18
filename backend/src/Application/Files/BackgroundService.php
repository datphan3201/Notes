<?php

declare(strict_types=1);
namespace Planner\Application\Files;

use Planner\Domain\Files\UploadedFile;
use Planner\Http\HttpException;
use Planner\Http\ValidationException;
use Planner\Infrastructure\Database\TransactionManager;
use Planner\Infrastructure\Persistence\Pdo\Account\PdoAccountRepository;
use Planner\Infrastructure\Persistence\Pdo\Files\PendingDeletionRepository;
use Planner\Infrastructure\Storage\LocalPrivateStorage;
use Planner\Support\Clock;
use Planner\Support\Timestamp;

final readonly class BackgroundService
{
    public function __construct(private PdoAccountRepository $accounts, private TransactionManager $transactions, private LocalPrivateStorage $storage, private PendingDeletionRepository $pending, private Clock $clock)
    {
    }

    public function replace(int $userId, UploadedFile $file): void
    {
        $path = $this->storage->putBytes('backgrounds', $this->jpeg($file), 'jpg');
        try {
            $this->transactions->run(function () use ($userId, $path): void {
                $this->accounts->findById($userId, true) ?? throw new HttpException(404, 'NOT_FOUND', 'Account not found.');
                $old = $this->accounts->backgroundPath($userId);
                $this->accounts->setBackgroundPath($userId, $path, Timestamp::database($this->clock->now()));
                if ($old !== null) {
                    $this->pending->queue($userId, $old, Timestamp::database($this->clock->now()));
                }
            });
        } catch (\Throwable $error) {
            $this->storage->delete($path);
            throw $error;
        }
    }

    public function remove(int $userId): void
    {
        $this->transactions->run(function () use ($userId): void {
            $this->accounts->findById($userId, true) ?? throw new HttpException(404, 'NOT_FOUND', 'Account not found.');
            $path = $this->accounts->backgroundPath($userId);
            $this->accounts->setBackgroundPath($userId, null, Timestamp::database($this->clock->now()));
            if ($path !== null) {
                $this->pending->queue($userId, $path, Timestamp::database($this->clock->now()));
            }
        });
    }

    public function authorized(int $userId): string
    {
        $path = $this->accounts->backgroundPath($userId);
        if ($path === null) {
            throw new HttpException(404, 'NOT_FOUND', 'No background image.');
        }
        return $this->storage->resolve($path);
    }

    private function jpeg(UploadedFile $file): string
    {
        if ($file->error !== UPLOAD_ERR_OK || !is_file($file->temporaryPath) || is_link($file->temporaryPath)
            || filesize($file->temporaryPath) !== $file->reportedSize || $file->reportedSize < 1 || $file->reportedSize > 2_097_152) {
            throw new ValidationException(['background' => ['Choose a JPEG, PNG or WebP image up to 2 MB.']]);
        }
        $mime = (new \finfo(FILEINFO_MIME_TYPE))->file($file->temporaryPath);
        $size = @getimagesize($file->temporaryPath);
        if (!in_array($mime, ['image/jpeg', 'image/png', 'image/webp'], true) || !is_array($size)
            || $size[0] < 1 || $size[1] < 1 || $size[0] > 4096 || $size[1] > 4096) {
            throw new ValidationException(['background' => ['Choose a supported image no larger than 4096 × 4096 pixels.']]);
        }
        $image = @imagecreatefromstring((string) file_get_contents($file->temporaryPath));
        if ($image === false) {
            throw new ValidationException(['background' => ['The image could not be read.']]);
        }
        $scale = min(1, 1920 / $size[0], 1920 / $size[1]);
        $canvas = imagecreatetruecolor(max(1, (int) round($size[0] * $scale)), max(1, (int) round($size[1] * $scale)));
        if ($canvas === false) {
            throw new HttpException(503, 'IMAGE_PROCESSING_FAILED', 'The image could not be processed.');
        }
        imagefill($canvas, 0, 0, imagecolorallocate($canvas, 255, 255, 255));
        imagecopyresampled($canvas, $image, 0, 0, 0, 0, imagesx($canvas), imagesy($canvas), $size[0], $size[1]);
        ob_start();
        $ok = imagejpeg($canvas, null, 88);
        $bytes = ob_get_clean();
        if (!$ok || !is_string($bytes)) {
            throw new HttpException(503, 'IMAGE_PROCESSING_FAILED', 'The image could not be processed.');
        }
        return $bytes;
    }
}
