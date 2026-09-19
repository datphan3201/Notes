<?php

declare(strict_types=1);

namespace Planner\Domain\Tags;

final readonly class TagRecord
{
    public function __construct(
        public int $id,
        public int $userId,
        public string $name,
        public int $version,
        public string $createdAt,
        public string $updatedAt,
        public ?int $parentId = null,
        public string $color = 'neutral',
        public int $position = 0,
        public ?string $archivedAt = null,
    ) {}
}
