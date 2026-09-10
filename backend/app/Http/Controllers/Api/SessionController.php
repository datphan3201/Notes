<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Http\Resources\PreferenceResource;
use App\Http\Resources\UserResource;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;

class SessionController extends Controller
{
    public function show(Request $request): JsonResponse
    {
        $user = $request->user()->loadMissing('preferences');

        return response()->json([
            'data' => [
                'user' => UserResource::make($user)->resolve(),
                'preferences' => PreferenceResource::make($user->preferences)->resolve(),
                'csrf_token' => $request->session()->token(),
            ],
        ]);
    }
}
