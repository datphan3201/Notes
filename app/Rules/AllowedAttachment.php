<?php

namespace App\Rules;

use App\Support\ApiException;
use Closure;
use Illuminate\Contracts\Validation\ValidationRule;
use Illuminate\Http\UploadedFile;
use ZipArchive;

final class AllowedAttachment implements ValidationRule
{
    /** @var array<string, array<int, string>> */
    private const EXTENSIONS = [
        'jpg' => ['image/jpeg'],
        'jpeg' => ['image/jpeg'],
        'png' => ['image/png'],
        'webp' => ['image/webp'],
        'mp4' => ['video/mp4'],
        'webm' => ['video/webm'],
        'pdf' => ['application/pdf'],
        'txt' => ['text/plain'],
        'md' => ['text/plain', 'text/markdown'],
        'csv' => ['text/plain', 'text/csv'],
        'zip' => ['application/zip', 'application/x-zip-compressed'],
        'docx' => ['application/vnd.openxmlformats-officedocument.wordprocessingml.document', 'application/zip'],
        'xlsx' => ['application/vnd.openxmlformats-officedocument.spreadsheetml.sheet', 'application/zip'],
        'pptx' => ['application/vnd.openxmlformats-officedocument.presentationml.presentation', 'application/zip'],
    ];

    public function validate(string $attribute, mixed $value, Closure $fail): void
    {
        try {
            $this->inspect($value);
        } catch (ApiException $exception) {
            $fail($exception->getMessage());
        }
    }

    /**
     * @return array{original_name:string,mime_type:string,kind:string,size:int,sha256:string,extension:string}
     */
    public function inspect(UploadedFile $file): array
    {
        if (! $file->isValid()) {
            throw new ApiException('PAYLOAD_TOO_LARGE', 'Mỗi tệp tối đa 20 MB.', 413);
        }

        $size = (int) $file->getSize();
        if ($size < 1 || $size > 20_971_520) {
            throw new ApiException('PAYLOAD_TOO_LARGE', 'Mỗi tệp tối đa 20 MB.', 413);
        }

        $name = (string) $file->getClientOriginalName();
        if (preg_match('/[\\\\\/\x00-\x1F\x7F]/u', $name) === 1 || mb_strlen($name, 'UTF-8') > 255) {
            throw new ApiException('VALIDATION_FAILED', 'Tên tệp không hợp lệ.', 422, [
                'errors' => ['file' => ['Tên tệp không hợp lệ.']],
            ]);
        }

        $basename = basename(str_replace('\\', '/', $name));
        $extension = strtolower(pathinfo($basename, PATHINFO_EXTENSION));
        if (! isset(self::EXTENSIONS[$extension])) {
            throw new ApiException('VALIDATION_FAILED', 'Loại tệp chưa được hỗ trợ.', 422, [
                'errors' => ['file' => ['Loại tệp chưa được hỗ trợ.']],
            ]);
        }

        $path = $file->getRealPath();
        $mime = (new \finfo(FILEINFO_MIME_TYPE))->file($path) ?: 'application/octet-stream';
        if (! in_array($mime, self::EXTENSIONS[$extension], true)) {
            throw new ApiException('VALIDATION_FAILED', 'Nội dung tệp không khớp phần mở rộng.', 422, [
                'errors' => ['file' => ['Nội dung tệp không khớp phần mở rộng.']],
            ]);
        }

        if (in_array($extension, ['jpg', 'jpeg', 'png', 'webp'], true)) {
            $dimensions = @getimagesize($path);
            if (! $dimensions || $dimensions[0] < 1 || $dimensions[1] < 1 || $dimensions[0] > 10_000 || $dimensions[1] > 10_000 || $dimensions[0] * $dimensions[1] > 25_000_000) {
                throw new ApiException('VALIDATION_FAILED', 'Ảnh không hợp lệ hoặc quá lớn.', 422, [
                    'errors' => ['file' => ['Ảnh không hợp lệ hoặc quá lớn.']],
                ]);
            }
        }

        if (in_array($extension, ['txt', 'md', 'csv'], true)) {
            $contents = file_get_contents($path);
            if ($contents === false || str_contains($contents, "\0") || ! mb_check_encoding($contents, 'UTF-8')) {
                throw new ApiException('VALIDATION_FAILED', 'Tệp văn bản phải là UTF-8 và không chứa NUL.', 422, [
                    'errors' => ['file' => ['Tệp văn bản không hợp lệ.']],
                ]);
            }
        }

        if (in_array($extension, ['zip', 'docx', 'xlsx', 'pptx'], true)) {
            $archive = new ZipArchive;
            if ($archive->open($path) !== true || $archive->numFiles > 10_000) {
                throw new ApiException('VALIDATION_FAILED', 'Tệp nén không hợp lệ.', 422, [
                    'errors' => ['file' => ['Tệp nén không hợp lệ.']],
                ]);
            }
            if ($extension !== 'zip') {
                $expected = [
                    'docx' => '[Content_Types].xml',
                    'xlsx' => '[Content_Types].xml',
                    'pptx' => '[Content_Types].xml',
                ][$extension];
                $required = [
                    'docx' => 'word/document.xml',
                    'xlsx' => 'xl/workbook.xml',
                    'pptx' => 'ppt/presentation.xml',
                ][$extension];
                if ($archive->locateName($expected) === false || $archive->locateName($required) === false) {
                    $archive->close();
                    throw new ApiException('VALIDATION_FAILED', 'Tệp Office không hợp lệ.', 422, [
                        'errors' => ['file' => ['Tệp Office không hợp lệ.']],
                    ]);
                }
            }
            $archive->close();
        }

        $kind = in_array($extension, ['jpg', 'jpeg', 'png', 'webp'], true)
            ? 'image'
            : (in_array($extension, ['mp4', 'webm'], true) ? 'video' : 'file');

        return [
            'original_name' => $basename,
            'mime_type' => $mime,
            'kind' => $kind,
            'size' => $size,
            'sha256' => hash_file('sha256', $path),
            'extension' => $extension,
        ];
    }
}
