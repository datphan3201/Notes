<?php

namespace App\Rules;

use App\Support\ApiException;
use Closure;
use Illuminate\Contracts\Validation\ValidationRule;
use Illuminate\Http\UploadedFile;

final class ValidAvatar implements ValidationRule
{
    public function validate(string $attribute, mixed $value, Closure $fail): void
    {
        try {
            $this->inspect($value);
        } catch (ApiException $exception) {
            $fail($exception->getMessage());
        }
    }

    /** @return array{mime:string,width:int,height:int} */
    public function inspect(UploadedFile $file): array
    {
        if (! $file->isValid() || (int) $file->getSize() > 2_097_152) {
            throw new ApiException('PAYLOAD_TOO_LARGE', 'Ảnh đại diện tối đa 2 MB.', 413);
        }
        $mime = (new \finfo(FILEINFO_MIME_TYPE))->file($file->getRealPath()) ?: '';
        if (! in_array($mime, ['image/jpeg', 'image/png', 'image/webp'], true)) {
            throw new ApiException('VALIDATION_FAILED', 'Ảnh đại diện phải là JPEG, PNG hoặc WebP.', 422);
        }
        $dimensions = @getimagesize($file->getRealPath());
        if (! $dimensions || $dimensions[0] < 1 || $dimensions[1] < 1 || $dimensions[0] > 4096 || $dimensions[1] > 4096) {
            throw new ApiException('VALIDATION_FAILED', 'Kích thước ảnh đại diện không hợp lệ.', 422);
        }

        return ['mime' => $mime, 'width' => $dimensions[0], 'height' => $dimensions[1]];
    }
}
