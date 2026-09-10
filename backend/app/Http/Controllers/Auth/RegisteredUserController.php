<?php

namespace App\Http\Controllers\Auth;

use App\Actions\Auth\RegisterUser;
use App\Http\Controllers\Controller;
use App\Http\Requests\RegisterRequest;
use Illuminate\Http\RedirectResponse;
use Illuminate\Support\Facades\Auth;
use Illuminate\View\View;

class RegisteredUserController extends Controller
{
    public function create(): View
    {
        return view('auth.register');
    }

    public function store(RegisterRequest $request, RegisterUser $register): RedirectResponse
    {
        $user = $register->handle(
            $request->validated('email'),
            $request->validated('display_name'),
            $request->validated('password'),
        );

        Auth::login($user, false);
        $request->session()->regenerate();

        return redirect()->route('notes.index');
    }
}
