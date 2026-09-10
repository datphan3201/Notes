@extends('layouts.app', ['title' => 'Giao diện'])

@section('content')
<section class="settings-page" data-preference-settings id="main-content" aria-labelledby="settings-title">
    <header class="settings-header">
        <div><p class="eyebrow">Tài khoản</p><h1 id="settings-title">Giao diện</h1><p>Chọn nhịp làm việc phù hợp với mắt và cách bạn đọc.</p></div>
        <a class="button button-quiet" href="{{ route('notes.index') }}">← Về ghi chú</a>
    </header>
    <div class="settings-panel preference-panel">
        <section class="preference-section"><div><h2>Chủ đề</h2><p class="subtle-copy">Thay đổi nền của không gian làm việc.</p></div>
            <div class="segmented-control" role="group" aria-label="Chủ đề"><button class="segment-button" type="button" data-pref="theme" data-value="light">Sáng</button><button class="segment-button" type="button" data-pref="theme" data-value="dark">Tối</button></div>
        </section>
        <section class="preference-section"><div><h2>Cỡ chữ ghi chú</h2><p class="subtle-copy">Áp dụng cho nội dung và phần xem trước.</p></div>
            <div class="segmented-control" role="group" aria-label="Cỡ chữ"><button class="segment-button" type="button" data-pref="note_font_size" data-value="14">Nhỏ</button><button class="segment-button" type="button" data-pref="note_font_size" data-value="16">Vừa</button><button class="segment-button" type="button" data-pref="note_font_size" data-value="18">Lớn</button></div>
        </section>
        <section class="preference-section"><div><h2>Màu ghi chú mới</h2><p class="subtle-copy">Chỉ áp dụng cho ghi chú tạo sau khi chọn.</p></div>
            <div class="preference-color-options" role="group" aria-label="Màu ghi chú mặc định"><button class="preference-color color-neutral" type="button" data-pref="default_note_color" data-value="neutral" aria-label="Mặc định"></button><button class="preference-color color-lemon" type="button" data-pref="default_note_color" data-value="lemon" aria-label="Vàng nhạt"></button><button class="preference-color color-mint" type="button" data-pref="default_note_color" data-value="mint" aria-label="Xanh lá nhạt"></button><button class="preference-color color-sky" type="button" data-pref="default_note_color" data-value="sky" aria-label="Xanh dương nhạt"></button><button class="preference-color color-rose" type="button" data-pref="default_note_color" data-value="rose" aria-label="Hồng nhạt"></button></div>
        </section>
        <section class="preference-section"><div><h2>Kiểu hiển thị</h2><p class="subtle-copy">Chọn cách xem thư viện ghi chú.</p></div>
            <div class="segmented-control" role="group" aria-label="Kiểu hiển thị"><button class="segment-button" type="button" data-pref="notes_view" data-value="grid">Lưới</button><button class="segment-button" type="button" data-pref="notes_view" data-value="list">Danh sách</button></div>
        </section>
        <p class="save-status" data-preference-status role="status"></p>
    </div>
</section>
@endsection
