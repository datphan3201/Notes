<?php

namespace App\Actions\Auth;

use App\Models\User;
use App\Models\UserPreference;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Hash;

final class RegisterUser
{
    public function handle(string $email, string $displayName, string $password): User
    {
        return DB::transaction(function () use ($email, $displayName, $password): User {
            $now = now();
            $user = User::create([
                'email' => $email,
                'display_name' => $displayName,
                'password' => Hash::make($password),
                'created_at' => $now,
                'updated_at' => $now,
            ]);

            // Preferences are created atomically so every authenticated shell
            // can safely render defaults without a nullable-settings branch.
            UserPreference::create([
                'user_id' => $user->id,
                'created_at' => $now,
                'updated_at' => $now,
            ]);

            return $user->fresh('preferences');
        });
    }
}
