@extends('layouts.app', ['title' => 'Hồ sơ'])

@section('content')
<section class="settings-page" data-profile-settings id="main-content" aria-labelledby="settings-title">
    <header class="settings-header">
        <div><p class="eyebrow">Tài khoản</p><h1 id="settings-title">Hồ sơ</h1><p>Thông tin hiển thị trong không gian ghi chú của bạn.</p></div>
        <a class="button button-quiet" href="{{ route('notes.index') }}">← Về ghi chú</a>
    </header>
    <div class="settings-panel">
        <div class="profile-avatar-row">
            <span class="avatar avatar-large" data-profile-avatar>{{ mb_strtoupper(mb_substr($user->display_name, 0, 1)) }}</span>
            <div><strong>Ảnh đại diện</strong><p class="subtle-copy">Ảnh JPEG, PNG hoặc WebP, tối đa 2 MB.</p>
                <div class="inline-actions">
                    <label class="button button-quiet">Chọn ảnh<input type="file" hidden accept=".jpg,.jpeg,.png,.webp" data-avatar-input></label>
                    <button class="text-button" type="button" data-avatar-remove>Xóa ảnh</button>
                </div>
            </div>
        </div>
        <form class="settings-form" data-profile-form>
            <div class="field"><label for="profile-email">Email</label><input id="profile-email" type="email" value="{{ $user->email }}" readonly><p class="field-hint">Email không thể thay đổi trong release này.</p></div>
            <div class="field"><label for="profile-display-name">Tên hiển thị</label><input id="profile-display-name" name="display_name" type="text" value="{{ $user->display_name }}" maxlength="80" required data-profile-name><p class="field-error is-hidden" data-profile-error></p></div>
            <div class="form-actions"><button class="button button-primary" type="submit">Lưu thay đổi</button><span class="save-status" data-profile-status role="status"></span></div>
        </form>
    </div>
</section>
@endsection
