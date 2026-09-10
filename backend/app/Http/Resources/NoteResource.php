<?php

namespace App\Http\Resources;

use App\Models\Note;
use Illuminate\Http\Request;
use Illuminate\Http\Resources\Json\JsonResource;

class NoteResource extends JsonResource
{
    public function toArray(Request $request): array
    {
        /** @var Note $note */
        $note = $this->resource;
        $labels = $note->relationLoaded('labels') ? $note->labels : $note->labels()->get();
        $attachments = $note->relationLoaded('attachments')
            ? $note->attachments->whereNull('deleted_at')->values()
            : $note->attachments()->active()->orderBy('created_at')->orderBy('id')->get();

        return [
            'id' => (string) $note->id,
            'title' => $note->title,
            'content' => $note->content,
            'color' => $note->color,
            'is_pinned' => $note->pinned_at !== null,
            'pinned_at' => self::timestamp($note->pinned_at),
            'version' => (int) $note->version,
            'labels' => LabelResource::collection($labels)->resolve(),
            'attachments' => AttachmentResource::collection($attachments)->resolve(),
            'attachment_count' => $attachments->count(),
            'created_at' => self::timestamp($note->created_at),
            'updated_at' => self::timestamp($note->updated_at),
        ];
    }

    public static function timestamp($value): ?string
    {
        return $value?->utc()->format('Y-m-d\TH:i:s.u\Z');
    }
}
