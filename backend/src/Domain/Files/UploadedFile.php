<?php

declare(strict_types=1);

namespace Planner\Domain\Files;

final readonly class UploadedFile
{
    public function __construct(
        public string $originalName,
        public string $temporaryPath,
        public int $error,
        public int $reportedSize,
    ) {}
}
