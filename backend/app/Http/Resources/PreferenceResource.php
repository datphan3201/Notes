<?php

namespace App\Http\Resources;

use Illuminate\Http\Request;
use Illuminate\Http\Resources\Json\JsonResource;

class PreferenceResource extends JsonResource
{
    public function toArray(Request $request): array
    {
        return [
            'theme' => $this->theme,
            'note_font_size' => (int) $this->note_font_size,
            'default_note_color' => $this->default_note_color,
            'notes_view' => $this->notes_view,
        ];
    }
}
