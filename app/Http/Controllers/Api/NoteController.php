<?php

namespace App\Http\Controllers\Api;

use App\Actions\Files\ProcessFileDeletion;
use App\Actions\Notes\CreateNote;
use App\Actions\Notes\DeleteNote;
use App\Actions\Notes\UpdateNote;
use App\Http\Controllers\Controller;
use App\Http\Requests\NoteCreateRequest;
use App\Http\Requests\NoteListRequest;
use App\Http\Requests\NoteUpdateRequest;
use App\Http\Resources\NoteResource;
use App\Http\Resources\NoteSummaryResource;
use App\Models\Label;
use App\Models\Note;
use App\Queries\NoteListQuery;
use App\Support\ApiException;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;

class NoteController extends Controller
{
    public function index(NoteListRequest $request, NoteListQuery $query): JsonResponse
    {
        $labelIds = array_map('intval', $request->validated('label_ids', []));
        if ($labelIds !== [] && Label::where('user_id', $request->user()->id)->whereIn('id', $labelIds)->count() !== count($labelIds)) {
            throw new ApiException('VALIDATION_FAILED', 'Dữ liệu không hợp lệ.', 422, [
                'errors' => ['label_ids' => ['Một hoặc nhiều nhãn không tồn tại.']],
            ]);
        }

        $page = (int) $request->validated('page', 1);
        $paginator = $query->paginate(
            $request->user(),
            (string) $request->validated('q', ''),
            $labelIds,
            $page,
        );

        return response()->json([
            'data' => NoteSummaryResource::collection($paginator->items())->resolve(),
            'meta' => [
                'current_page' => $paginator->currentPage(),
                'per_page' => 30,
                'last_page' => max(1, $paginator->lastPage()),
                'total' => $paginator->total(),
            ],
        ]);
    }

    public function store(NoteCreateRequest $request, CreateNote $create): JsonResponse
    {
        $result = $create->handle($request->user(), $request->validated());

        return response()->json([
            'data' => NoteResource::make($result['note'])->resolve(),
            'meta' => ['replayed' => $result['replayed']],
        ], $result['replayed'] ? 200 : 201);
    }

    public function show(Request $request, string $note): JsonResponse
    {
        $model = $this->ownedActive($request, $note);

        return response()->json(['data' => NoteResource::make($model)->resolve()]);
    }

    public function update(NoteUpdateRequest $request, string $note, UpdateNote $update): JsonResponse
    {
        $model = $this->ownedActive($request, $note);
        $updated = $update->handle($request->user(), $model, $request->validated());

        return response()->json(['data' => NoteResource::make($updated)->resolve()]);
    }

    public function destroy(
        Request $request,
        string $note,
        DeleteNote $delete,
        ProcessFileDeletion $cleanup,
    ): JsonResponse {
        $payload = $request->validate([
            'base_version' => ['required', 'integer', 'min:1'],
        ]);
        $model = Note::query()->where('id', $note)->where('user_id', $request->user()->id)->first();

        if ($model === null) {
            throw new ApiException('NOT_FOUND', 'Không tìm thấy dữ liệu.', 404);
        }

        $result = $delete->handle($request->user(), $model, (int) $payload['base_version']);
        $cleanup->handle($result['paths']);

        return response()->json([], 204);
    }

    private function ownedActive(Request $request, string $id): Note
    {
        $model = Note::query()
            ->ownedBy($request->user())
            ->active()
            ->with(['labels', 'attachments'])
            ->whereKey($id)
            ->first();

        if ($model === null) {
            $tombstone = Note::query()->ownedBy($request->user())->whereKey($id)->exists();
            throw new ApiException(
                $tombstone ? 'NOTE_DELETED' : 'NOT_FOUND',
                $tombstone ? 'Ghi chú đã bị xóa.' : 'Không tìm thấy dữ liệu.',
                $tombstone ? 410 : 404,
            );
        }

        return $model;
    }
}
