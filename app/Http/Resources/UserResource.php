<?php

namespace App\Http\Resources;

use Illuminate\Http\Request;
use Illuminate\Http\Resources\Json\JsonResource;

class UserResource extends JsonResource
{
    public function toArray(Request $request): array
    {
        return [
            'id' => (string) $this->id,
            'email' => $this->email,
            'display_name' => $this->display_name,
            'email_verified' => $this->email_verified_at !== null,
            'avatar_url' => $this->avatar_path ? route('files.avatar') : null,
        ];
    }
}
