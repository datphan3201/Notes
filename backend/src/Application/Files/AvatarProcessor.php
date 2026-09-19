<?php

declare(strict_types=1);

namespace Planner\Application\Files;

use finfo;
use GdImage;
use Planner\Domain\Files\UploadedFile;
use Planner\Http\HttpException;
use Planner\Http\ValidationException;

final class AvatarProcessor
{
    public function makeJpeg(UploadedFile $file): string
    {
        if ($file->error !== UPLOAD_ERR_OK) {
            if (in_array($file->error, [UPLOAD_ERR_INI_SIZE, UPLOAD_ERR_FORM_SIZE], true)) {
                throw new HttpException(413, 'PAYLOAD_TOO_LARGE', 'The profile picture cannot exceed 2 MB.');
            }

            throw new ValidationException(['avatar' => ['The profile picture is invalid.']]);
        }

        if (! is_file($file->temporaryPath) || is_link($file->temporaryPath)) {
            throw new ValidationException(['avatar' => ['The profile picture is invalid.']]);
        }

        $size = filesize($file->temporaryPath);

        if (! is_int($size) || $size !== $file->reportedSize || $size < 1 || $size > 2_097_152) {
            throw new HttpException(413, 'PAYLOAD_TOO_LARGE', 'The profile picture cannot exceed 2 MB.');
        }

        $mime = (new finfo(FILEINFO_MIME_TYPE))->file($file->temporaryPath) ?: '';

        if (! in_array($mime, ['image/jpeg', 'image/png', 'image/webp'], true)) {
            throw new ValidationException(['avatar' => ['The profile picture must be a JPEG, PNG, or WebP image.']]);
        }

        $dimensions = @getimagesize($file->temporaryPath);

        if (! is_array($dimensions) || $dimensions[0] < 1 || $dimensions[1] < 1
            || $dimensions[0] > 4096 || $dimensions[1] > 4096) {
            throw new ValidationException(['avatar' => ['The profile picture dimensions are invalid.']]);
        }

        $bytes = file_get_contents($file->temporaryPath);
        $source = is_string($bytes) ? @imagecreatefromstring($bytes) : false;

        if (! $source instanceof GdImage) {
            throw new ValidationException(['avatar' => ['The profile picture could not be read.']]);
        }

        $canvas = imagecreatetruecolor(512, 512);

        if (! $canvas instanceof GdImage) {
            throw new HttpException(503, 'IMAGE_PROCESSING_FAILED', 'The profile picture could not be processed.');
        }

        $width = imagesx($source);
        $height = imagesy($source);
        $scale = min(512 / $width, 512 / $height, 1);
        $targetWidth = max(1, (int) round($width * $scale));
        $targetHeight = max(1, (int) round($height * $scale));
        $left = intdiv(512 - $targetWidth, 2);
        $top = intdiv(512 - $targetHeight, 2);
        $white = imagecolorallocate($canvas, 255, 255, 255);
        imagefill($canvas, 0, 0, $white);
        imagecopyresampled(
            $canvas,
            $source,
            $left,
            $top,
            0,
            0,
            $targetWidth,
            $targetHeight,
            $width,
            $height,
        );
        ob_start();
        $encoded = imagejpeg($canvas, null, 88);
        $jpeg = ob_get_clean();

        if (! $encoded || ! is_string($jpeg) || $jpeg === '') {
            throw new HttpException(503, 'IMAGE_PROCESSING_FAILED', 'The profile picture could not be processed.');
        }

        return $jpeg;
    }
}
