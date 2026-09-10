<?php

namespace App\Http\Controllers;

use Illuminate\Http\Request;
use Illuminate\View\View;

class SettingsPageController extends Controller
{
    public function profile(Request $request): View
    {
        $user = $request->user()->loadMissing('preferences');

        return view('settings.profile', ['user' => $user, 'preferences' => $user->preferences]);
    }

    public function preferences(Request $request): View
    {
        return view('settings.preferences', [
            'user' => $request->user(),
            'preferences' => $request->user()->loadMissing('preferences')->preferences,
        ]);
    }

    public function password(Request $request): View
    {
        $user = $request->user()->loadMissing('preferences');

        return view('settings.password', ['user' => $user, 'preferences' => $user->preferences]);
    }
}
