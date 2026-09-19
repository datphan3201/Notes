<?php

declare(strict_types=1);

namespace Planner\Application\Files;

use finfo;
use Planner\Domain\Files\InspectedUpload;
use Planner\Domain\Files\UploadedFile;
use Planner\Http\HttpException;
use Planner\Http\Validation\InputValidator;
use Planner\Http\ValidationException;
use Planner\Support\TextNormalizer;
use Ramsey\Uuid\Uuid;
use ZipArchive;

final readonly class UploadValidator
{
    /** @var array<string, list<string>> */
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

    public function __construct(private InputValidator $input) {}

    /**
     * @param  array<string, mixed>  $form
     * @param  array<string, mixed>  $files
     * @return array{id:string,file:InspectedUpload}
     */
    public function attachment(array $form, array $files): array
    {
        $this->rejectUnknownMultipart($form, $files, ['id'], ['file']);
        $id = is_string($form['id'] ?? null) ? strtolower($form['id']) : '';

        if (! Uuid::isValid($id)) {
            throw new ValidationException(['id' => ['The file UUID is invalid.']]);
        }

        return ['id' => $id, 'file' => $this->inspectAttachment($this->uploaded($files['file'] ?? null, 'file'))];
    }

    /** @param array<string, mixed> $form @param array<string, mixed> $files */
    public function avatar(array $form, array $files): UploadedFile
    {
        $this->rejectUnknownMultipart($form, $files, [], ['avatar']);

        return $this->uploaded($files['avatar'] ?? null, 'avatar');
    }

    /** @param array<string, mixed> $form @param array<string, mixed> $files */
    public function empty(array $form, array $files): void
    {
        $this->rejectUnknownMultipart($form, $files, [], []);
    }

    public function inspectAttachment(UploadedFile $file): InspectedUpload
    {
        if ($file->error !== UPLOAD_ERR_OK) {
            if (in_array($file->error, [UPLOAD_ERR_INI_SIZE, UPLOAD_ERR_FORM_SIZE], true)) {
                throw new HttpException(413, 'PAYLOAD_TOO_LARGE', 'Each file can be at most 20 MB.');
            }

            throw new ValidationException(['file' => ['The uploaded file is invalid.']]);
        }

        $size = $this->actualSize($file);

        if ($size < 1 || $size > 20_971_520) {
            throw new HttpException(413, 'PAYLOAD_TOO_LARGE', 'Each file can be at most 20 MB.');
        }

        $name = TextNormalizer::nfc($file->originalName);

        if ($name === '' || preg_match('/[\\\\\/\x00-\x1F\x7F]/u', $name) === 1
            || TextNormalizer::codePoints($name) > 255) {
            throw new ValidationException(['file' => ['The file name is invalid.']]);
        }

        $basename = basename(str_replace('\\', '/', $name));
        $extension = strtolower(pathinfo($basename, PATHINFO_EXTENSION));

        if (! isset(self::EXTENSIONS[$extension])) {
            throw new ValidationException(['file' => ['This file type is not supported.']]);
        }

        $mime = (new finfo(FILEINFO_MIME_TYPE))->file($file->temporaryPath) ?: 'application/octet-stream';

        if (! in_array($mime, self::EXTENSIONS[$extension], true)) {
            throw new ValidationException(['file' => ['The file content does not match its extension.']]);
        }

        if (in_array($extension, ['jpg', 'jpeg', 'png', 'webp'], true)) {
            $dimensions = @getimagesize($file->temporaryPath);

            if (! is_array($dimensions) || $dimensions[0] < 1 || $dimensions[1] < 1
                || $dimensions[0] > 10_000 || $dimensions[1] > 10_000
                || $dimensions[0] * $dimensions[1] > 25_000_000) {
                throw new ValidationException(['file' => ['The image is invalid or too large.']]);
            }
        }

        if (in_array($extension, ['txt', 'md', 'csv'], true)) {
            $contents = file_get_contents($file->temporaryPath);

            if ($contents === false || str_contains($contents, "\0") || ! mb_check_encoding($contents, 'UTF-8')) {
                throw new ValidationException(['file' => ['The text file is invalid.']]);
            }
        }

        if (in_array($extension, ['zip', 'docx', 'xlsx', 'pptx'], true)) {
            $this->validateArchive($file->temporaryPath, $extension);
        }

        $digest = hash_file('sha256', $file->temporaryPath);

        if (! is_string($digest)) {
            throw new HttpException(503, 'FILE_UNAVAILABLE', 'The uploaded file could not be read.');
        }

        $kind = in_array($extension, ['jpg', 'jpeg', 'png', 'webp'], true)
            ? 'image'
            : (in_array($extension, ['mp4', 'webm'], true) ? 'video' : 'file');

        return new InspectedUpload($file, $basename, $mime, $kind, $size, $digest, $extension);
    }

    private function uploaded(mixed $value, string $field): UploadedFile
    {
        if (! is_array($value)
            || ! is_string($value['name'] ?? null)
            || ! is_string($value['tmp_name'] ?? null)
            || ! is_int($value['error'] ?? null)
            || ! is_int($value['size'] ?? null)) {
            throw new ValidationException([$field => ['An uploaded file is required.']]);
        }

        return new UploadedFile($value['name'], $value['tmp_name'], $value['error'], $value['size']);
    }

    private function actualSize(UploadedFile $file): int
    {
        if (! is_file($file->temporaryPath) || is_link($file->temporaryPath)) {
            throw new ValidationException(['file' => ['The uploaded file is invalid.']]);
        }

        $size = filesize($file->temporaryPath);

        if (! is_int($size) || $size !== $file->reportedSize) {
            throw new ValidationException(['file' => ['The uploaded file size is invalid.']]);
        }

        return $size;
    }

    private function validateArchive(string $path, string $extension): void
    {
        $archive = new ZipArchive;
        $opened = $archive->open($path);

        if ($opened !== true || $archive->numFiles > 10_000) {
            if ($opened === true) {
                $archive->close();
            }

            throw new ValidationException(['file' => ['The archive is invalid.']]);
        }

        try {
            if ($extension !== 'zip') {
                $required = [
                    'docx' => 'word/document.xml',
                    'xlsx' => 'xl/workbook.xml',
                    'pptx' => 'ppt/presentation.xml',
                ][$extension];

                if ($archive->locateName('[Content_Types].xml') === false
                    || $archive->locateName($required) === false) {
                    throw new ValidationException(['file' => ['The Office document is invalid.']]);
                }
            }
        } finally {
            $archive->close();
        }
    }

    /**
     * @param  array<string, mixed>  $form
     * @param  array<string, mixed>  $files
     * @param  list<string>  $allowedForm
     * @param  list<string>  $allowedFiles
     */
    private function rejectUnknownMultipart(array $form, array $files, array $allowedForm, array $allowedFiles): void
    {
        $this->input->rejectUnknown($form, [...$allowedForm, '_token']);
        $this->input->rejectUnknown($files, $allowedFiles);
    }
}
