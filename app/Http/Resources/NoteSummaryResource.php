<?php

namespace App\Http\Resources;

use App\Models\Note;
use Illuminate\Http\Request;

class NoteSummaryResource extends NoteResource
{
    public function toArray(Request $request): array
    {
        /** @var Note $note */
        $note = $this->resource;
        $labels = $note->relationLoaded('labels') ? $note->labels : $note->labels()->get();

        // The list query supplies withCount('attachments') on purpose. Building
        // a summary directly avoids turning a paginated list into one attachment
        // query per card just because the full resource exposes file metadata.
        return [
            'id' => (string) $note->id,
            'title' => $note->title,
            'content_preview' => mb_substr((string) $note->content, 0, 240, 'UTF-8'),
            'color' => $note->color,
            'is_pinned' => $note->pinned_at !== null,
            'pinned_at' => self::timestamp($note->pinned_at),
            'version' => (int) $note->version,
            'labels' => LabelResource::collection($labels)->resolve(),
            'attachment_count' => (int) ($note->attachment_count ?? 0),
            'created_at' => self::timestamp($note->created_at),
            'updated_at' => self::timestamp($note->updated_at),
        ];
    }
}
