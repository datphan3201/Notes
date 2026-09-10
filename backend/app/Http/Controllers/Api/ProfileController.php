<?php

namespace App\Http\Controllers\Api;

use App\Actions\Files\ProcessFileDeletion;
use App\Actions\Files\RemoveAvatar;
use App\Actions\Files\ReplaceAvatar;
use App\Http\Controllers\Controller;
use App\Http\Requests\ProfileUpdateRequest;
use App\Http\Resources\UserResource;
use App\Rules\ValidAvatar;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;

class ProfileController extends Controller
{
    public function show(Request $request): JsonResponse
    {
        return response()->json(['data' => UserResource::make($request->user())->resolve()]);
    }

    public function update(ProfileUpdateRequest $request): JsonResponse
    {
        $user = $request->user();
        $user->forceFill([
            'display_name' => $request->validated('display_name'),
            'updated_at' => now(),
        ])->save();

        return response()->json(['data' => UserResource::make($user->fresh())->resolve()]);
    }

    public function avatar(Request $request, ReplaceAvatar $replace): JsonResponse
    {
        $request->validate(['avatar' => ['required', 'file', new ValidAvatar]]);
        $user = $replace->handle($request->user(), $request->file('avatar'));

        return response()->json(['data' => UserResource::make($user)->resolve()]);
    }

    public function removeAvatar(Request $request, RemoveAvatar $remove, ProcessFileDeletion $cleanup): JsonResponse
    {
        $cleanup->handle($remove->handle($request->user()));

        return response()->json([], 204);
    }
}
