<?php

namespace App\Http\Controllers\Api;

use App\Actions\Files\DeleteAttachment;
use App\Actions\Files\ProcessFileDeletion;
use App\Actions\Files\UploadAttachment;
use App\Http\Controllers\Controller;
use App\Http\Requests\AttachmentUploadRequest;
use App\Http\Resources\AttachmentResource;
use App\Models\Note;
use App\Support\ApiException;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;

class AttachmentController extends Controller
{
    public function index(Request $request, string $note): JsonResponse
    {
        $model = $this->note($request, $note);
        $attachments = $model->attachments()->active()->orderBy('created_at')->orderBy('id')->get();

        return response()->json(['data' => AttachmentResource::collection($attachments)->resolve()]);
    }

    public function store(
        AttachmentUploadRequest $request,
        string $note,
        UploadAttachment $upload,
    ): JsonResponse {
        $model = $this->note($request, $note);
        $result = $upload->handle(
            $request->user(),
            $model,
            strtolower((string) $request->validated('id')),
            $request->file('file'),
        );

        return response()->json([
            'data' => AttachmentResource::make($result['attachment'])->resolve(),
            'meta' => ['replayed' => $result['replayed']],
        ], $result['replayed'] ? 200 : 201);
    }

    public function destroy(
        Request $request,
        string $note,
        string $attachment,
        DeleteAttachment $delete,
        ProcessFileDeletion $cleanup,
    ): JsonResponse {
        $model = $this->note($request, $note);
        $cleanup->handle($delete->handle($request->user(), $model, $attachment));

        return response()->json([], 204);
    }

    private function note(Request $request, string $id): Note
    {
        $note = Note::query()->ownedBy($request->user())->active()->whereKey($id)->first();
        if ($note === null) {
            throw new ApiException('NOT_FOUND', 'Không tìm thấy dữ liệu.', 404);
        }

        return $note;
    }
}
