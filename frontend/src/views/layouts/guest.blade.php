<!doctype html>
<html lang="vi">
    <head>
        <meta charset="utf-8">
        <meta name="viewport" content="width=device-width, initial-scale=1">
        <meta name="csrf-token" content="{{ csrf_token() }}">
        <title>{{ $title ?? 'Ghi chú' }} · Ghi chú</title>
        @vite(['src/css/app.css', 'src/js/app.js'])
    </head>
    <body class="guest-page">
        <main class="guest-shell">
            <a class="skip-link" href="#main-content">Bỏ qua đến nội dung</a>
            <div class="guest-mark" aria-hidden="true">
                <span class="mark-dot"></span>
                <span class="mark-line"></span>
                <span class="mark-dot mark-dot-small"></span>
            </div>
            <p class="brand-wordmark">Ghi chú</p>
            @yield('content')
        </main>
    </body>
</html>
