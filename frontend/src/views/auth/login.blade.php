@extends('layouts.guest', ['title' => 'Đăng nhập'])

@section('content')
    <section class="auth-card" id="main-content" aria-labelledby="auth-title">
        <p class="eyebrow">Không gian cá nhân</p>
        <h1 id="auth-title">Chào mừng trở lại</h1>
        <p class="auth-intro">Đăng nhập để tiếp tục với những điều bạn đang lưu lại.</p>
        <form class="stack-form" action="{{ route('login.store') }}" method="post">
            @csrf
            <div class="field">
                <label for="email">Email</label>
                <input id="email" name="email" type="email" value="{{ old('email') }}" autocomplete="email" required autofocus>
                @error('email') <p class="field-error">{{ $message }}</p> @enderror
            </div>
            <div class="field">
                <label for="password">Mật khẩu</label>
                <input id="password" name="password" type="password" autocomplete="current-password" required>
                @error('password') <p class="field-error">{{ $message }}</p> @enderror
            </div>
            <button class="button button-primary button-wide" type="submit">Đăng nhập</button>
        </form>
        <p class="auth-switch">Chưa có tài khoản? <a href="{{ route('register') }}">Tạo tài khoản</a></p>
    </section>
@endsection
