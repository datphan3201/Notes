@php
    $user->loadMissing('preferences');
    $bootstrap = [
        'user' => [
            'id' => (string) $user->id,
            'email' => $user->email,
            'display_name' => $user->display_name,
            'email_verified' => $user->email_verified_at !== null,
            'avatar_url' => $user->avatar_path ? route('files.avatar') : null,
        ],
        'preferences' => [
            'theme' => $preferences->theme,
            'note_font_size' => (int) $preferences->note_font_size,
            'default_note_color' => $preferences->default_note_color,
            'notes_view' => $preferences->notes_view,
        ],
        'csrf_token' => csrf_token(),
    ];
@endphp
<!doctype html>
<html lang="vi" data-theme="{{ $preferences->theme }}" data-font-size="{{ $preferences->note_font_size }}">
    <head>
        <meta charset="utf-8">
        <meta name="viewport" content="width=device-width, initial-scale=1">
        <meta name="csrf-token" content="{{ csrf_token() }}">
        <title>{{ $title ?? 'Ghi chú' }} · Ghi chú</title>
        <script>
            window.notesBootstrap = {{ Illuminate\Support\Js::from($bootstrap) }};
        </script>
        @vite(['resources/css/app.css', 'resources/js/app.js'])
    </head>
    <body class="app-page">
        <a class="skip-link" href="#main-content">Bỏ qua đến nội dung</a>
        <div class="app-frame">
            <aside class="app-sidebar" id="app-sidebar" aria-label="Điều hướng chính">
                <div class="sidebar-brand">
                    <span class="brand-symbol" aria-hidden="true"><span></span><i></i></span>
                    <span>Ghi chú</span>
                </div>
                <button class="mobile-sidebar-close icon-button" type="button" data-close-sidebar aria-label="Đóng điều hướng">×</button>
                <nav class="sidebar-nav">
                    <a class="nav-link {{ request()->routeIs('notes.index') ? 'is-active' : '' }}" href="{{ route('notes.index') }}">
                        <span class="nav-icon" aria-hidden="true">⌂</span><span>Tất cả ghi chú</span>
                    </a>
                    <div class="sidebar-section-label">Tài khoản</div>
                    <a class="nav-link {{ request()->routeIs('settings.profile') ? 'is-active' : '' }}" href="{{ route('settings.profile') }}" data-leave-guard>
                        <span class="nav-icon" aria-hidden="true">○</span><span>Hồ sơ</span>
                    </a>
                    <a class="nav-link {{ request()->routeIs('settings.preferences') ? 'is-active' : '' }}" href="{{ route('settings.preferences') }}" data-leave-guard>
                        <span class="nav-icon" aria-hidden="true">◒</span><span>Giao diện</span>
                    </a>
                    <a class="nav-link {{ request()->routeIs('settings.password') ? 'is-active' : '' }}" href="{{ route('settings.password') }}" data-leave-guard>
                        <span class="nav-icon" aria-hidden="true">⌁</span><span>Đổi mật khẩu</span>
                    </a>
                </nav>
                <div class="sidebar-footer">
                    <div class="sidebar-user">
                        <span class="avatar avatar-small" data-avatar-fallback>{{ mb_strtoupper(mb_substr($user->display_name, 0, 1)) }}</span>
                        <span class="sidebar-user-copy">
                            <strong>{{ $user->display_name }}</strong>
                            <small>{{ $user->email }}</small>
                        </span>
                    </div>
                    <form action="{{ route('logout') }}" method="post" data-leave-guard-form>
                        @csrf
                        <button class="nav-link nav-link-button" type="submit">
                            <span class="nav-icon" aria-hidden="true">↪</span><span>Đăng xuất</span>
                        </button>
                    </form>
                </div>
            </aside>
            <div class="sidebar-scrim" data-close-sidebar></div>
            <main class="app-main" id="main-content">
                @if (! $user->email_verified_at)
                    <div class="notice notice-info" role="status">
                        <span aria-hidden="true">i</span>
                        <span>Email của bạn chưa được xác minh.</span>
                    </div>
                @endif
                @yield('content')
            </main>
        </div>
        <div class="toast-region" data-toast-region aria-live="polite"></div>
    </body>
</html>
