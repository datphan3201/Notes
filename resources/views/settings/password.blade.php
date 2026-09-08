@extends('layouts.app', ['title' => 'Đổi mật khẩu'])

@section('content')
<section class="settings-page" data-password-settings id="main-content" aria-labelledby="settings-title">
    <header class="settings-header">
        <div><p class="eyebrow">Tài khoản</p><h1 id="settings-title">Đổi mật khẩu</h1><p>Sau khi đổi, các cửa sổ đang đăng nhập sẽ được đăng xuất.</p></div>
        <a class="button button-quiet" href="{{ route('notes.index') }}">← Về ghi chú</a>
    </header>
    <div class="settings-panel settings-panel-narrow">
        <form class="settings-form" data-password-form>
            <div class="field"><label for="current-password">Mật khẩu hiện tại</label><input id="current-password" name="current_password" type="password" autocomplete="current-password" required></div>
            <div class="field"><label for="new-password">Mật khẩu mới</label><input id="new-password" name="password" type="password" autocomplete="new-password" required><p class="field-hint">Tối thiểu 10 ký tự, tối đa 72 byte.</p><p class="field-error is-hidden" data-password-error></p></div>
            <div class="field"><label for="new-password-confirmation">Nhập lại mật khẩu mới</label><input id="new-password-confirmation" name="password_confirmation" type="password" autocomplete="new-password" required></div>
            <div class="form-actions"><button class="button button-primary" type="submit">Đổi mật khẩu</button><span class="save-status" data-password-status role="status"></span></div>
        </form>
    </div>
</section>
@endsection
