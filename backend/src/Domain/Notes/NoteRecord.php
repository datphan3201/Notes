<?php

declare(strict_types=1);

namespace Planner\Domain\Notes;

use Planner\Domain\Tags\TagRecord;

final readonly class NoteRecord
{
    /**
     * @param  list<TagRecord>  $labels
     * @param  list<array{id:string,original_name:string,mime_type:string,kind:string,size_bytes:int,created_at:string}>  $attachments
     */
    public function __construct(
        public string $id,
        public int $userId,
        public string $title,
        public string $content,
        public string $color,
        public ?string $pinnedAt,
        public int $version,
        public ?string $deletedAt,
        public string $createdAt,
        public string $updatedAt,
        public array $labels = [],
        public array $attachments = [],
        public int $attachmentCount = 0,
    ) {}
}
