# Ghi chú cá nhân — R1

Ứng dụng ghi chú cá nhân gồm hai vùng source độc lập:

- `frontend/`: Blade, Alpine.js, JavaScript modules, CSS và Vite 8.
- `backend/`: Laravel 13, PHP 8.5, API `/api/v1`, MySQL và private storage.

Hai vùng chạy cùng origin để giữ session cookie và CSRF của Laravel. Vite build
asset từ `frontend/src` sang `backend/public/build`; Laravel đọc Blade tại
`frontend/src/views`.

Hướng dẫn đầy đủ, gồm cấu hình database, kiểm thử và các phần được hoãn, nằm
trong [`Readme.txt`](Readme.txt). Bằng chứng chạy kiểm thử/browser nằm trong
[`docs/verification.md`](docs/verification.md).
