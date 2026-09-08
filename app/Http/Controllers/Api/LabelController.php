<?php

namespace App\Http\Controllers\Api;

use App\Actions\Labels\CreateLabel;
use App\Actions\Labels\DeleteLabel;
use App\Actions\Labels\RenameLabel;
use App\Http\Controllers\Controller;
use App\Http\Requests\LabelCreateRequest;
use App\Http\Requests\LabelDeleteRequest;
use App\Http\Requests\LabelUpdateRequest;
use App\Http\Resources\LabelResource;
use App\Models\Label;
use App\Support\ApiException;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;

class LabelController extends Controller
{
    public function index(Request $request): JsonResponse
    {
        $labels = Label::where('user_id', $request->user()->id)
            ->orderBy('name')
            ->orderBy('id')
            ->get();

        return response()->json(['data' => LabelResource::collection($labels)->resolve()]);
    }

    public function store(LabelCreateRequest $request, CreateLabel $create): JsonResponse
    {
        $label = $create->handle($request->user(), $request->validated('name'));

        return response()->json(['data' => LabelResource::make($label)->resolve()], 201);
    }

    public function update(LabelUpdateRequest $request, string $label, RenameLabel $rename): JsonResponse
    {
        $model = $this->owned($request, $label);
        $updated = $rename->handle(
            $request->user(),
            $model,
            $request->validated('name'),
            (int) $request->validated('base_version'),
        );

        return response()->json(['data' => LabelResource::make($updated)->resolve()]);
    }

    public function destroy(LabelDeleteRequest $request, string $label, DeleteLabel $delete): JsonResponse
    {
        $model = $this->owned($request, $label);
        $delete->handle($request->user(), $model, (int) $request->validated('base_version'));

        return response()->json([], 204);
    }

    private function owned(Request $request, string $id): Label
    {
        $model = Label::where('user_id', $request->user()->id)->whereKey($id)->first();

        if ($model === null) {
            throw new ApiException('NOT_FOUND', 'Không tìm thấy dữ liệu.', 404);
        }

        return $model;
    }
}
