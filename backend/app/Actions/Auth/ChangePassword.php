<?php

namespace App\Actions\Auth;

use App\Models\User;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Hash;

final class ChangePassword
{
    public function handle(User $user, string $current, string $new): void
    {
        if (! Hash::check($current, (string) $user->password)) {
            throw new \InvalidArgumentException('Mật khẩu hiện tại không đúng.');
        }

        DB::transaction(function () use ($user, $new): void {
            $user->forceFill(['password' => Hash::make($new), 'updated_at' => now()])->save();

            // Database-backed sessions make “log out everywhere” explicit,
            // including sessions that are not the request currently running.
            DB::table('sessions')->where('user_id', $user->id)->delete();
        });
    }
}
