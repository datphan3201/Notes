<?php

namespace App\Http\Controllers;

use App\Support\ApiException;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Storage;
use Symfony\Component\HttpFoundation\BinaryFileResponse;

class AvatarContentController extends Controller
{
    public function show(Request $request): BinaryFileResponse
    {
        $path = $request->user()->avatar_path;
        if (! $path || str_contains($path, '..') || ! Storage::disk('private')->exists($path)) {
            throw new ApiException('NOT_FOUND', 'Không tìm thấy dữ liệu.', 404);
        }

        return response()->file(Storage::disk('private')->path($path), [
            'Content-Type' => 'image/jpeg',
            'Content-Disposition' => 'inline',
        ]);
    }
}
