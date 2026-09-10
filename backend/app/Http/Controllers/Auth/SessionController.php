<?php

namespace App\Http\Controllers\Auth;

use App\Http\Controllers\Controller;
use App\Http\Requests\LoginRequest;
use Illuminate\Http\RedirectResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Auth;
use Illuminate\Support\Facades\RateLimiter;
use Illuminate\Support\Str;
use Illuminate\View\View;

class SessionController extends Controller
{
    public function create(): View
    {
        return view('auth.login');
    }

    public function store(LoginRequest $request): RedirectResponse
    {
        $email = (string) $request->validated('email');
        $key = Str::lower($email).'|'.$request->ip();

        if (RateLimiter::tooManyAttempts($key, 5) || RateLimiter::tooManyAttempts('login-ip|'.$request->ip(), 20)) {
            return back()->withErrors(['email' => 'Bạn thử đăng nhập quá nhiều lần. Vui lòng thử lại sau.'])
                ->onlyInput('email');
        }

        if (! Auth::attempt(['email' => $email, 'password' => $request->validated('password')], false)) {
            RateLimiter::hit($key, 60);
            RateLimiter::hit('login-ip|'.$request->ip(), 60);

            return back()->withErrors(['email' => 'Email hoặc mật khẩu không đúng.'])
                ->onlyInput('email');
        }

        RateLimiter::clear($key);
        $request->session()->regenerate();

        return redirect()->intended(route('notes.index'));
    }

    public function destroy(Request $request): RedirectResponse
    {
        Auth::logout();
        $request->session()->invalidate();
        $request->session()->regenerateToken();

        return redirect()->route('login');
    }
}
