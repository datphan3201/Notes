<?php

namespace App\Http\Requests;

use App\Rules\AllowedAttachment;

class AttachmentUploadRequest extends ApiFormRequest
{
    protected array $allowedKeys = ['id', 'file'];

    public function rules(): array
    {
        return [
            'id' => ['required', 'uuid'],
            'file' => ['required', 'file', new AllowedAttachment],
        ];
    }
}
