<?php

namespace App\Support;

use Illuminate\Http\JsonResponse;

/**
 * Keep every JSON failure machine-readable so autosave can distinguish a
 * conflict, an invalid draft, and an expired session without parsing HTML.
 */
final class ApiError
{
    public static function make(string $code, string $message, int $status, array $extra = []): JsonResponse
    {
        return response()->json(array_merge([
            'code' => $code,
            'message' => $message,
        ], $extra), $status);
    }

    /**
     * @param  array<string, array<int, string>>  $errors
     */
    public static function validation(array $errors): JsonResponse
    {
        return self::make('VALIDATION_FAILED', 'Dữ liệu không hợp lệ.', 422, [
            'errors' => $errors,
        ]);
    }

    public static function conflict(
        string $code,
        string $message,
        array $current,
        int $status = 409,
    ): JsonResponse {
        return self::make($code, $message, $status, ['current' => $current]);
    }
}
