<?php

declare(strict_types=1);

namespace Planner\Domain\Files;

final readonly class AttachmentRecord
{
    public function __construct(
        public string $id,
        public int $userId,
        public string $noteId,
        public string $originalName,
        public ?string $path,
        public string $mimeType,
        public string $kind,
        public int $sizeBytes,
        public ?string $sha256,
        public ?string $deletedAt,
        public string $createdAt,
        public string $updatedAt,
    ) {}
}
