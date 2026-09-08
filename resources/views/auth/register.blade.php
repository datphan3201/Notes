@extends('layouts.guest', ['title' => 'Tạo tài khoản'])

@section('content')
    <section class="auth-card" id="main-content" aria-labelledby="auth-title">
        <p class="eyebrow">Bắt đầu nhẹ nhàng</p>
        <h1 id="auth-title">Tạo tài khoản</h1>
        <p class="auth-intro">Chỉ cần bốn thông tin để có một nơi riêng cho các ghi chú của bạn.</p>
        <form class="stack-form" action="{{ route('register.store') }}" method="post">
            @csrf
            <div class="field">
                <label for="display_name">Tên hiển thị</label>
                <input id="display_name" name="display_name" type="text" value="{{ old('display_name') }}" autocomplete="name" maxlength="80" required autofocus>
                @error('display_name') <p class="field-error">{{ $message }}</p> @enderror
            </div>
            <div class="field">
                <label for="email">Email</label>
                <input id="email" name="email" type="email" value="{{ old('email') }}" autocomplete="email" maxlength="254" required>
                @error('email') <p class="field-error">{{ $message }}</p> @enderror
            </div>
            <div class="field">
                <label for="password">Mật khẩu</label>
                <input id="password" name="password" type="password" autocomplete="new-password" required>
                <p class="field-hint">Tối thiểu 10 ký tự, tối đa 72 byte.</p>
                @error('password') <p class="field-error">{{ $message }}</p> @enderror
            </div>
            <div class="field">
                <label for="password_confirmation">Nhập lại mật khẩu</label>
                <input id="password_confirmation" name="password_confirmation" type="password" autocomplete="new-password" required>
                @error('password_confirmation') <p class="field-error">{{ $message }}</p> @enderror
            </div>
            <button class="button button-primary button-wide" type="submit">Tạo tài khoản</button>
        </form>
        <p class="auth-switch">Đã có tài khoản? <a href="{{ route('login') }}">Đăng nhập</a></p>
    </section>
@endsection
