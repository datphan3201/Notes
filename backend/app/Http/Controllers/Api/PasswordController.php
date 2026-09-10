<?php

namespace App\Http\Controllers\Api;

use App\Actions\Auth\ChangePassword;
use App\Http\Controllers\Controller;
use App\Http\Requests\ChangePasswordRequest;
use App\Support\ApiError;
use Illuminate\Http\JsonResponse;
use Illuminate\Support\Facades\Auth;

class PasswordController extends Controller
{
    public function update(ChangePasswordRequest $request, ChangePassword $change): JsonResponse
    {
        try {
            $change->handle(
                $request->user(),
                (string) $request->validated('current_password'),
                (string) $request->validated('password'),
            );
        } catch (\InvalidArgumentException $exception) {
            return ApiError::validation(['current_password' => [$exception->getMessage()]]);
        }

        Auth::logout();
        $request->session()->invalidate();
        $request->session()->regenerateToken();

        return response()->json(['data' => ['redirect_to' => route('login')]]);
    }
}
