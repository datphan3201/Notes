<?php

declare(strict_types=1);

namespace Planner\Application\Files;

use Planner\Domain\Files\AttachmentRecord;
use Planner\Support\Timestamp;

final class AttachmentSerializer
{
    /** @return array<string, mixed> */
    public function one(AttachmentRecord $attachment): array
    {
        $id = rawurlencode($attachment->id);

        return [
            'id' => $attachment->id,
            'original_name' => $attachment->originalName,
            'mime_type' => $attachment->mimeType,
            'kind' => $attachment->kind,
            'size_bytes' => $attachment->sizeBytes,
            'preview_url' => in_array($attachment->kind, ['image', 'video'], true)
                ? '/files/attachments/'.$id.'/preview'
                : null,
            'download_url' => '/files/attachments/'.$id.'/download',
            'created_at' => Timestamp::api($attachment->createdAt),
        ];
    }
}
