<?php

declare(strict_types=1);

namespace Planner\Application\Files;

use Planner\Domain\Files\UploadedFile;
use Planner\Http\HttpException;
use Planner\Http\ValidationException;

/**
 * Validates an uploaded JPEG/PNG/WebP image and re-encodes it as a JPEG.
 * Re-encoding drops metadata (EXIF, GPS) and any non-image payload.
 */
final readonly class ImageNormalizer
{
    public function jpeg(UploadedFile $file, string $field, int $maxBytes, int $maxOutputSide): string
    {
        $megabytes = intdiv($maxBytes, 1_048_576);
        if ($file->error !== UPLOAD_ERR_OK || !is_file($file->temporaryPath) || is_link($file->temporaryPath)
            || filesize($file->temporaryPath) !== $file->reportedSize || $file->reportedSize < 1 || $file->reportedSize > $maxBytes) {
            throw new ValidationException([$field => ["Choose a JPEG, PNG or WebP image up to $megabytes MB."]]);
        }
        $mime = (new \finfo(FILEINFO_MIME_TYPE))->file($file->temporaryPath);
        $size = @getimagesize($file->temporaryPath);
        if (!in_array($mime, ['image/jpeg', 'image/png', 'image/webp'], true) || !is_array($size)
            || $size[0] < 1 || $size[1] < 1 || $size[0] > 4096 || $size[1] > 4096) {
            throw new ValidationException([$field => ['Choose a supported image no larger than 4096 × 4096 pixels.']]);
        }
        $image = @imagecreatefromstring((string) file_get_contents($file->temporaryPath));
        if ($image === false) {
            throw new ValidationException([$field => ['The image could not be read.']]);
        }
        $scale = min(1, $maxOutputSide / $size[0], $maxOutputSide / $size[1]);
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
