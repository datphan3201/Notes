<?php

namespace App\Http\Controllers;

use App\Models\Attachment;
use App\Support\ApiException;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Storage;
use Symfony\Component\HttpFoundation\BinaryFileResponse;

class AttachmentContentController extends Controller
{
    public function preview(Request $request, string $attachment): BinaryFileResponse
    {
        $model = $this->authorized($request, $attachment);
        if (! in_array($model->kind, ['image', 'video'], true)) {
            throw new ApiException('NOT_FOUND', 'Không tìm thấy dữ liệu.', 404);
        }

        return response()->file($this->path($model), [
            'Content-Type' => $model->mime_type,
            'Content-Disposition' => 'inline',
            'Accept-Ranges' => 'bytes',
        ]);
    }

    public function download(Request $request, string $attachment): BinaryFileResponse
    {
        $model = $this->authorized($request, $attachment);

        return response()->download(
            $this->path($model),
            $model->original_name,
            [
                'Content-Type' => 'application/octet-stream',
                'X-Content-Type-Options' => 'nosniff',
            ],
        );
    }

    private function authorized(Request $request, string $id): Attachment
    {
        $model = Attachment::query()
            ->whereKey($id)
            ->whereNull('deleted_at')
            ->whereHas('note', static fn ($notes) => $notes->where('user_id', $request->user()->id)->whereNull('deleted_at'))
            ->first();
        if ($model === null) {
            throw new ApiException('NOT_FOUND', 'Không tìm thấy dữ liệu.', 404);
        }

        return $model;
    }

    private function path(Attachment $attachment): string
    {
        $path = (string) $attachment->path;
        if ($path === '' || str_contains($path, '..') || str_starts_with($path, '/') || ! Storage::disk('private')->exists($path)) {
            throw new ApiException('NOT_FOUND', 'Không tìm thấy dữ liệu.', 404);
        }

        return Storage::disk('private')->path($path);
    }
}
