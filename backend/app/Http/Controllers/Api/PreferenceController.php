<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Http\Requests\PreferenceUpdateRequest;
use App\Http\Resources\PreferenceResource;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;

class PreferenceController extends Controller
{
    public function show(Request $request): JsonResponse
    {
        $preferences = $request->user()->loadMissing('preferences')->preferences;

        return response()->json(['data' => PreferenceResource::make($preferences)->resolve()]);
    }

    public function update(PreferenceUpdateRequest $request): JsonResponse
    {
        $preferences = $request->user()->loadMissing('preferences')->preferences;
        $preferences->forceFill(array_merge(
            $request->validated(),
            ['updated_at' => now()],
        ))->save();

        return response()->json(['data' => PreferenceResource::make($preferences->fresh())->resolve()]);
    }
}
