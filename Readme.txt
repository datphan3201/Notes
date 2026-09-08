GHI CHÚ CÁ NHÂN — RELEASE R1
============================

1. Phạm vi
----------

R1 có đăng ký/đăng nhập/đăng xuất, hồ sơ và avatar, đổi mật khẩu, tùy chọn
giao diện, ghi chú plain-text tự lưu, xung đột phiên bản, khôi phục theo tab,
tìm kiếm literal, nhãn, ghim, màu, tệp đính kèm và giao diện responsive.

R2–R5 chưa nằm trong R1: xác minh/khôi phục email, mật khẩu riêng cho note,
chia sẻ/cộng tác, WebSocket, AI, PWA, Docker Compose và public deployment.

2. Yêu cầu máy
--------------

- PHP 8.5 với pdo_mysql, mbstring, intl, fileinfo, zip, gd, xml, dom.
- Composer 2.x.
- MySQL 8.4 với collation utf8mb4_0900_ai_ci.
- Node 22.22.2 và npm 10.x.

Không dùng SQLite cho ứng dụng hoặc test. Không cần Redis, mail server,
queue worker hay Docker cho R1.

3. Cài đặt lần đầu
------------------

Từ thư mục project:

    cp .env.example .env
    composer install
    php artisan key:generate

Tạo database và user riêng cho development/test trong MySQL (dùng mật khẩu
riêng của máy, không commit vào repo):

    CREATE DATABASE notes_dev CHARACTER SET utf8mb4 COLLATE utf8mb4_0900_ai_ci;
    CREATE DATABASE notes_test CHARACTER SET utf8mb4 COLLATE utf8mb4_0900_ai_ci;
    CREATE USER 'notes_dev'@'127.0.0.1' IDENTIFIED BY 'doi-mat-khau-dev';
    CREATE USER 'notes_test'@'127.0.0.1' IDENTIFIED BY 'doi-mat-khau-test';
    GRANT ALL PRIVILEGES ON notes_dev.* TO 'notes_dev'@'127.0.0.1';
    GRANT ALL PRIVILEGES ON notes_test.* TO 'notes_test'@'127.0.0.1';
    FLUSH PRIVILEGES;

Điền thông tin notes_dev vào .env. Tạo .env.testing tương ứng với notes_test
và APP_ENV=testing; tuyệt đối không trỏ test tới notes_dev.

    php artisan migrate --force
    npm ci
    npm run build

4. Chạy local
-------------

    php artisan serve --host=127.0.0.1 --port=8000

Hoặc dùng web server trỏ document root tới thư mục public/. Trong production
local, phục vụ asset đã build trong public/build; không cần chạy Vite dev server.

5. Kiểm thử và kiểm tra
-----------------------

    composer validate --strict
    composer check-platform-reqs
    php artisan config:clear
    php artisan test
    vendor/bin/pint --test
    npm run test:unit
    npm run format:check
    npm run build

Dọn file riêng tư pending/orphan cũ hơn một giờ bằng:

    php artisan files:prune

Các test backend dùng MySQL notes_test và có guard từ chối database khác.
Không chạy migrate:fresh trên notes_dev.

6. Ghi chú vận hành
-------------------

- Session dùng database, CSRF dùng same-origin token, JSON API ở /api/v1.
- File upload đi vào storage/app/private, không có public storage symlink.
- Autosave dùng sessionStorage theo user/tab; đây không phải offline/PWA.
- Private response có no-store; file URL luôn kiểm tra owner và note/attachment
  còn active trước khi mở.
- Mật khẩu không được log/flash; file path/hash không được trả ra resource.

Kết quả kiểm thử thực tế và giới hạn môi trường hiện tại được cập nhật tại
docs/verification.md và docs/implementation-status.md.
