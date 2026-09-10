@extends('layouts.app', ['title' => 'Ghi chú'])

@section('content')
<div class="workspace" data-notes-workspace>
    <header class="workspace-header">
        <div class="workspace-heading">
            <button class="mobile-menu-button icon-button" type="button" data-open-sidebar aria-label="Mở điều hướng">☰</button>
            <div>
                <p class="eyebrow">Kho lưu trữ cá nhân</p>
                <h1>Ghi chú</h1>
            </div>
        </div>
        <div class="workspace-header-actions">
            <span class="save-status" data-global-status role="status"></span>
            <button class="button button-primary" type="button" data-new-note>
                <span aria-hidden="true">＋</span><span>Ghi chú mới</span>
            </button>
        </div>
    </header>

    <div class="workspace-layout">
        <aside class="notes-filter-panel" aria-label="Bộ lọc ghi chú">
            <button class="filter-all is-active" type="button" data-filter-all>
                <span class="filter-icon" aria-hidden="true">▦</span>
                <span>Tất cả ghi chú</span>
                <span class="filter-count" data-note-total>0</span>
            </button>
            <div class="filter-divider"></div>
            <div class="filter-heading">
                <span>Nhãn</span>
                <button class="text-button" type="button" data-open-label-manager>Quản lý</button>
            </div>
            <div class="label-filter-list" data-label-filter-list>
                <p class="subtle-copy">Đang tải nhãn…</p>
            </div>
            <button class="label-add-link" type="button" data-open-label-manager><span aria-hidden="true">＋</span> Thêm nhãn</button>
        </aside>

        <section class="notes-column" aria-labelledby="notes-heading">
            <div class="notes-toolbar">
                <div class="search-field">
                    <span aria-hidden="true">⌕</span>
                    <label class="sr-only" for="notes-search">Tìm trong ghi chú</label>
                    <input id="notes-search" type="search" placeholder="Tìm trong tiêu đề và nội dung…" autocomplete="off" data-notes-search>
                    <button class="search-clear icon-button is-hidden" type="button" data-clear-search aria-label="Xóa tìm kiếm">×</button>
                </div>
                <div class="view-switch" role="group" aria-label="Kiểu hiển thị">
                    <button class="view-button is-active" type="button" data-view="grid" aria-label="Hiển thị dạng lưới" aria-pressed="true">▦</button>
                    <button class="view-button" type="button" data-view="list" aria-label="Hiển thị dạng danh sách" aria-pressed="false">☷</button>
                </div>
            </div>
            <div class="active-filter-row is-hidden" data-active-filter-row>
                <span class="active-filter-copy" data-active-filter-copy></span>
                <button class="text-button" type="button" data-clear-filters>Xóa bộ lọc</button>
            </div>
            <div class="notes-feedback" data-notes-feedback role="status"></div>
            <div class="notes-grid" data-notes-grid aria-live="polite"></div>
            <div class="notes-list is-hidden" data-notes-list aria-live="polite"></div>
            <div class="pagination" data-pagination></div>
        </section>
    </div>
</div>

<div class="modal-backdrop is-hidden" data-editor-dialog-backdrop></div>
<section class="modal editor-modal is-hidden" data-editor-dialog role="dialog" aria-modal="true" aria-labelledby="editor-heading" aria-describedby="editor-description">
    <div class="modal-header">
        <div>
            <p class="eyebrow" data-editor-eyebrow>Ghi chú mới</p>
            <h2 id="editor-heading" data-editor-heading>Viết điều bạn muốn giữ lại</h2>
            <p class="sr-only" id="editor-description">Nội dung được tự động lưu sau khi máy chủ xác nhận.</p>
        </div>
        <button class="icon-button" type="button" data-close-editor aria-label="Đóng trình soạn thảo">×</button>
    </div>
    <div class="editor-status-row">
        <span class="save-status" data-editor-status role="status"></span>
        <span class="editor-meta" data-editor-meta></span>
        <button type="button" class="text-button is-hidden" data-retry-save>Thử lại</button>
    </div>
    <div class="is-hidden" data-session-recovery>
        <a href="{{ route('login', absolute: false) }}" target="_blank" rel="noopener">Đăng nhập trong cửa sổ khác</a>
        <button type="button" class="button button-quiet" data-recheck-session>Kiểm tra lại</button>
    </div>
    <form class="editor-form" data-editor-form>
        <div class="field editor-title-field">
            <label for="editor-title">Tiêu đề</label>
            <input id="editor-title" class="editor-title-input" type="text" maxlength="200" placeholder="Tiêu đề" autocomplete="off" data-editor-title>
            <p class="field-error is-hidden" data-editor-title-error></p>
        </div>
        <div class="field editor-body-field">
            <label for="editor-content">Nội dung</label>
            <textarea id="editor-content" class="editor-content-input" maxlength="50000" placeholder="Bắt đầu viết…" data-editor-content></textarea>
            <p class="field-error is-hidden" data-editor-content-error></p>
        </div>
        <div class="editor-controls">
            <div class="editor-control-group">
                <span class="control-label">Màu ghi chú</span>
                <div class="color-options" role="group" aria-label="Màu ghi chú" data-editor-colors>
                    <button type="button" class="color-swatch color-neutral is-selected" data-color="neutral" aria-label="Mặc định" aria-pressed="true"></button>
                    <button type="button" class="color-swatch color-lemon" data-color="lemon" aria-label="Vàng nhạt" aria-pressed="false"></button>
                    <button type="button" class="color-swatch color-mint" data-color="mint" aria-label="Xanh lá nhạt" aria-pressed="false"></button>
                    <button type="button" class="color-swatch color-sky" data-color="sky" aria-label="Xanh dương nhạt" aria-pressed="false"></button>
                    <button type="button" class="color-swatch color-rose" data-color="rose" aria-label="Hồng nhạt" aria-pressed="false"></button>
                </div>
            </div>
            <div class="editor-actions">
                <button class="button button-quiet" type="button" data-editor-pin aria-pressed="false"><span aria-hidden="true">♢</span> <span data-pin-label>Ghim</span></button>
                <button class="button button-quiet" type="button" data-editor-labels><span aria-hidden="true">⌑</span> Nhãn</button>
                <button class="button button-danger-quiet is-hidden" type="button" data-editor-delete>Xóa</button>
            </div>
        </div>
        <div class="editor-label-popover is-hidden" data-editor-label-popover>
            <div class="popover-heading"><strong>Gắn nhãn</strong><span data-label-selection-count>0/20</span></div>
            <div data-editor-label-list></div>
            <button class="text-button" type="button" data-open-label-manager>Tạo hoặc quản lý nhãn</button>
        </div>
        <div class="attachments-section is-hidden" data-attachments-section>
            <div class="section-heading"><span>Tệp đính kèm</span><span class="subtle-copy" data-attachment-count></span></div>
            <div class="attachment-list" data-attachment-list></div>
            <label class="button button-quiet attachment-picker">
                <span aria-hidden="true">＋</span> Thêm tệp
                <input type="file" hidden multiple accept=".jpg,.jpeg,.png,.webp,.mp4,.webm,.pdf,.txt,.md,.csv,.zip,.docx,.xlsx,.pptx" data-attachment-input>
            </label>
        </div>
    </form>
</section>

<div class="modal-backdrop is-hidden" data-label-dialog-backdrop></div>
<section class="modal compact-modal is-hidden" data-label-dialog role="dialog" aria-modal="true" aria-labelledby="label-dialog-heading">
    <div class="modal-header">
        <div><p class="eyebrow">Sắp xếp nhẹ nhàng</p><h2 id="label-dialog-heading">Quản lý nhãn</h2></div>
        <button class="icon-button" type="button" data-close-label-manager aria-label="Đóng quản lý nhãn">×</button>
    </div>
    <form class="inline-add-form" data-label-create-form>
        <label class="sr-only" for="new-label-name">Tên nhãn</label>
        <input id="new-label-name" type="text" maxlength="40" placeholder="Tên nhãn" data-label-create-input>
        <button class="button button-primary" type="submit">Thêm nhãn</button>
    </form>
    <p class="field-error is-hidden" data-label-create-error></p>
    <div class="managed-label-list" data-managed-label-list></div>
</section>

<div class="modal-backdrop is-hidden" data-conflict-dialog-backdrop></div>
<section class="modal conflict-modal is-hidden" data-conflict-dialog role="dialog" aria-modal="true" aria-labelledby="conflict-heading">
    <div class="modal-header">
        <div><p class="eyebrow">Cần bạn quyết định</p><h2 id="conflict-heading">Ghi chú đã thay đổi</h2></div>
        <button class="icon-button" type="button" data-close-conflict aria-label="Đóng hộp thoại xung đột">×</button>
    </div>
    <p class="modal-intro">Ghi chú đã thay đổi ở một cửa sổ khác. Chọn phiên bản muốn tiếp tục.</p>
    <div class="conflict-compare">
        <article><h3>Bản trên máy chủ</h3><strong data-conflict-server-title></strong><pre data-conflict-server-content></pre></article>
        <article><h3>Bản đang soạn</h3><strong data-conflict-local-title></strong><pre data-conflict-local-content></pre></article>
    </div>
    <p class="subtle-copy" data-conflict-note></p>
    <div class="modal-actions">
        <button class="button button-quiet" type="button" data-close-conflict>Quay lại</button>
        <button class="button button-quiet" type="button" data-use-server> Dùng bản trên máy chủ</button>
        <button class="button button-primary" type="button" data-keep-local>Giữ bản đang soạn</button>
    </div>
</section>

<div class="modal-backdrop is-hidden" data-confirm-dialog-backdrop></div>
<section class="modal compact-modal confirm-modal is-hidden" data-confirm-dialog role="dialog" aria-modal="true" aria-labelledby="confirm-heading">
    <div class="modal-header"><div><p class="eyebrow">Xác nhận</p><h2 id="confirm-heading" data-confirm-title>Bạn chắc chứ?</h2></div></div>
    <p class="modal-intro" data-confirm-message></p>
    <div class="modal-actions">
        <button class="button button-quiet" type="button" data-confirm-cancel>Hủy</button>
        <button class="button button-danger" type="button" data-confirm-accept>Tiếp tục</button>
    </div>
</section>

<div class="modal-backdrop is-hidden" data-recovery-dialog-backdrop></div>
<section class="modal compact-modal is-hidden" data-recovery-dialog role="dialog" aria-modal="true" aria-labelledby="recovery-heading">
    <div class="modal-header"><div><p class="eyebrow">Khôi phục</p><h2 id="recovery-heading">Có bản nháp chưa lưu</h2></div></div>
    <p class="modal-intro">Có bản nháp chưa lưu trong cửa sổ này. Bạn muốn làm gì với nó?</p>
    <p class="recovery-preview" data-recovery-preview></p>
    <div class="modal-actions">
        <button class="button button-quiet" type="button" data-recovery-discard>Bỏ bản nháp</button>
        <button class="button button-primary" type="button" data-recovery-accept>Khôi phục bản nháp</button>
    </div>
</section>
@endsection
