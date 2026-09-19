<?php

declare(strict_types=1);

namespace Planner\Application\Notes;

use Planner\Application\Tags\LabelSerializer;
use Planner\Domain\Notes\NoteRecord;
use Planner\Support\Timestamp;

final readonly class NoteSerializer
{
    public function __construct(private LabelSerializer $labels) {}

    /** @return array<string, mixed> */
    public function full(NoteRecord $note): array
    {
        $attachments = array_map(function (array $attachment): array {
            $id = rawurlencode($attachment['id']);

            return [
                'id' => $attachment['id'],
                'original_name' => $attachment['original_name'],
                'mime_type' => $attachment['mime_type'],
                'kind' => $attachment['kind'],
                'size_bytes' => $attachment['size_bytes'],
                'preview_url' => in_array($attachment['kind'], ['image', 'video'], true)
                    ? '/files/attachments/'.$id.'/preview'
                    : null,
                'download_url' => '/files/attachments/'.$id.'/download',
                'created_at' => Timestamp::api($attachment['created_at']),
            ];
        }, $note->attachments);

        return [
            'id' => $note->id,
            'title' => $note->title,
            'content' => $note->content,
            'color' => $note->color,
            'is_pinned' => $note->pinnedAt !== null,
            'pinned_at' => Timestamp::api($note->pinnedAt),
            'version' => $note->version,
            'labels' => array_map($this->labels->one(...), $note->labels),
            'attachments' => $attachments,
            'attachment_count' => count($attachments),
            'created_at' => Timestamp::api($note->createdAt),
            'updated_at' => Timestamp::api($note->updatedAt),
        ];
    }

    /** @return array<string, mixed> */
    public function summary(NoteRecord $note): array
    {
        return [
            'id' => $note->id,
            'title' => $note->title,
            'content_preview' => mb_substr($note->content, 0, 240, 'UTF-8'),
            'color' => $note->color,
            'is_pinned' => $note->pinnedAt !== null,
            'pinned_at' => Timestamp::api($note->pinnedAt),
            'version' => $note->version,
            'labels' => array_map($this->labels->one(...), $note->labels),
            'attachment_count' => $note->attachmentCount,
            'created_at' => Timestamp::api($note->createdAt),
            'updated_at' => Timestamp::api($note->updatedAt),
        ];
    }
}
