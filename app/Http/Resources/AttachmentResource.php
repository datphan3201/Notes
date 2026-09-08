<?php

namespace App\Http\Resources;

use Illuminate\Http\Request;
use Illuminate\Http\Resources\Json\JsonResource;

class AttachmentResource extends JsonResource
{
    public function toArray(Request $request): array
    {
        $preview = in_array($this->kind, ['image', 'video'], true)
            ? route('files.attachment.preview', ['attachment' => $this->id])
            : null;

        return [
            'id' => (string) $this->id,
            'original_name' => $this->original_name,
            'mime_type' => $this->mime_type,
            'kind' => $this->kind,
            'size_bytes' => (int) $this->size_bytes,
            'preview_url' => $preview,
            'download_url' => route('files.attachment.download', ['attachment' => $this->id]),
            'created_at' => self::timestamp($this->created_at),
        ];
    }

    private static function timestamp($value): ?string
    {
        return $value?->utc()->format('Y-m-d\TH:i:s.u\Z');
    }
}
