<?php

declare(strict_types=1);

namespace Planner\Domain\Files;

final readonly class InspectedUpload
{
    public function __construct(
        public UploadedFile $upload,
        public string $originalName,
        public string $mimeType,
        public string $kind,
        public int $size,
        public string $sha256,
        public string $extension,
    ) {}
}
