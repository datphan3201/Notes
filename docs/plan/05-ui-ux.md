# UI and Interaction Specification

## Design direction

Build a quiet Vietnamese writing workspace named **“Ghi chú”**. The note title and body are the visual focus. Use a cool gray-blue application surface, white writing surfaces, restrained teal actions, and optional soft note colors. Content is left-aligned; text remains readable instead of becoming dashboard decoration.

The owner's daily note workflow is the design basis. There is no evidence for invented personas, satisfaction scores, or usage analytics. No marketing hero, decorative statistics, onboarding tour, testimonial blocks, or unrelated navigation.

Brief review: a generic SaaS dashboard would waste space on summary widgets and repeated panels. This specification uses the space for actual note previews, an accessible search input, and a large editor. The required note grid is appropriate to the product; settings and navigation should not become additional grids of decorative cards.

## Design tokens

Use CSS custom properties in `tokens.css`, with a `[data-theme="dark"]` override. These values are implementation targets; verify contrast in T09/T12 rather than claiming certification from the palette alone.

| Token | Light | Dark |
| --- | --- | --- |
| `--canvas` | `#F3F6FA` | `#15202D` |
| `--surface` | `#FFFFFF` | `#1E2C3D` |
| `--text` | `#243247` | `#EDF3F9` |
| `--muted` | `#53647A` | `#B7C5D3` |
| `--border` | `#C4CEDA` | `#50647C` |
| `--accent` | `#0F766E` | `#72D6C6` |
| `--on-accent` | `#FFFFFF` | `#12352F` |
| `--danger` | `#B42332` | `#FF9CA9` |
| `--focus` | `#1D4ED8` | `#93C5FD` |

Note color tokens (same stored names in both themes):

| Name | Vietnamese label | Light background | Dark background |
| --- | --- | --- | --- |
| neutral | Mặc định | `#FFFFFF` | `#1E2C3D` |
| lemon | Vàng nhạt | `#FFF8CD` | `#3B3620` |
| mint | Xanh lá nhạt | `#E7F4EC` | `#213D32` |
| sky | Xanh dương nhạt | `#E7F0FC` | `#24364D` |
| rose | Hồng nhạt | `#FBECEF` | `#422D39` |

- Font: locally bundled Noto Sans, weights 400/500/600, with `system-ui, sans-serif` fallback. Include Vietnamese glyph coverage. No runtime Google Fonts/CDN call.
- UI body: 14px/1.5; page heading: 24px/1.3 weight 600; note title in editor: 24px/1.4; note body: selected 14/16/18px, line-height 1.7. Editor body line length at most approximately 75 characters.
- Spacing scale: 4, 8, 12, 16, 24, 32px. Control min-height 44px; icon hit areas at least 44×44px. Notes radius 12px, fields/buttons 8px, dialogs 16px; chip radius 999px only for labels.
- Use a 1px border on notes and input controls. Reserve a subtle shadow for floating dialogs/menus. Never communicate selection/error exclusively by color.
- Focus: 2px `--focus` outline with 2px offset. Respect `prefers-reduced-motion`; otherwise transitions only for state changes, 120–160ms. No automatic card entrance animations.
- Use a small consistent inline-SVG icon component for menu/search/grid/list/pin/attachment/more/close/theme. Decorative icons are aria-hidden; icon buttons have Vietnamese accessible names. Do not add raster artwork or externally hosted assets.

## Information architecture

```text
Guest
  Đăng nhập
  Tạo tài khoản

Authenticated
  Ghi chú (/)
    All notes / selected label filters
    Search and grid/list switch
    One create/edit dialog
    Label manager dialog
  Cài đặt
    Hồ sơ
    Giao diện
    Đổi mật khẩu
  Đăng xuất
```

“Được chia sẻ”, AI, note-lock, trash, and offline navigation do not appear in R1. Pin is an icon/action, not a separate navigation section. Settings are regular pages sharing the same application shell.

## Desktop workspace

At viewport widths >=1024px, show a fixed 240px sidebar and flexible main region. Main padding: 32px at >=1280px, 24px otherwise. Use two note columns from 1024–1279px and three from 1280px upward, with 16px gaps. Cap main content at 1440px and keep it left aligned within available space.

```text
┌──────────────────────┬───────────────────────────────────────────────────┐
│ Ghi chú              │ Ghi chú của tôi                  [+ Ghi chú mới] │
│                      │                                                   │
│ Tất cả ghi chú       │ [ Tìm trong tiêu đề và nội dung... ] [Grid][List] │
│                      │ [Email của bạn chưa được xác minh.]              │
│ Nhãn       [Quản lý] │ Filters: [Học tập ×]                              │
│ [ ] Học tập          │                                                   │
│ [ ] Công việc        │ ┌──────────────┐ ┌──────────────┐ ┌─────────────┐ │
│ [ ] Cá nhân          │ │ Title   pin ⋮│ │ Title      ⋮│ │ Title     ⋮│ │
│                      │ │ Body preview │ │ Body preview │ │ Preview     │ │
│                      │ │ Label  2 files│ │ Label        │ │             │ │
│                      │ └──────────────┘ └──────────────┘ └─────────────┘ │
│                      │              [Trước] 1 / 3 [Sau]                 │
│ Cài đặt              │                                                   │
│ Avatar  Display name │                                                   │
│ Đăng xuất            │                                                   │
└──────────────────────┴───────────────────────────────────────────────────┘
```

Notes use one consistent card height minimum 180px and maximum preview of six visual lines, with text clamping and wrapping for long strings. Do not use masonry, which complicates keyboard order. Clicking the title or main preview opens the note. Keep pin and more-menu controls separate; do not nest buttons inside a link/button containing the whole card.

List view uses rows with title, up to two preview lines, labels, modified time, attachment count, pin, and menu. Collapse optional time into the secondary text on small widths. Both views use the same data/order and selection state.

Search stays live; Enter does not submit a form or create a search button. During a query retain prior results with an unobtrusive “Đang tìm…” indicator; replace only when the newest request succeeds. On failure show “Không tải được ghi chú.” and “Thử lại” without presenting stale results as current.

## Tablet and phone

- 768–1023px: hide permanent sidebar; top header has a menu button opening a modal navigation drawer. Main padding 24px, two note columns.
- Below 768px: padding 16px, one note column. Title and new-note action occupy one row when they fit; search occupies a full row. Grid/list remain accessible beside/below search without horizontal overflow.
- Navigation drawer width `min(320px, 90vw)`; trap focus, close on Escape/backdrop, restore trigger focus. Sidebar label checkboxes remain usable by touch.
- Editor at >=768px: centered dialog width `min(800px, calc(100vw - 48px))`, max-height `calc(100dvh - 48px)`. Body scrolls inside, header/footer stay reachable.
- Editor below 768px: full-screen dialog using `100dvh`, zero outer margin, safe-area bottom padding, no horizontal overflow. Avoid fixed textarea heights that hide content behind the virtual keyboard.
- Other dialogs fit `min(480px, calc(100vw - 32px))`; they scroll internally if required. At 200% zoom, controls wrap instead of overlapping.

## Shared note editor

Use a native `<dialog>` with accessible heading, controlled `showModal()`/`close()`, and a `cancel` event routed through the unsaved-change guard. The same markup/component handles new and saved notes.

```text
┌──────────────────────────────────────────────────────────────────┐
│ Ghi chú mới / Chỉnh sửa ghi chú         Đã lưu             [Đóng] │
├──────────────────────────────────────────────────────────────────┤
│ Tiêu đề                                                          │
│ [Cơ sở dữ liệu_______________________________________________]   │
│                                                                  │
│ Nội dung                                                         │
│ [Ôn lại khóa ngoại và chỉ mục.                                ]   │
│ [  Giữ nguyên thụt dòng.                                     ]   │
│ [                                                           ]   │
│                                                                  │
│ [Ghim]   Màu: ○ ○ ○ ○ ○   Nhãn: [Học tập ×] [Chọn nhãn]           │
│                                                                  │
│ Tệp đính kèm                                      [Thêm tệp]     │
│ outline.pdf   2 KB                         [Tải xuống] [Xóa]      │
├──────────────────────────────────────────────────────────────────┤
│ Cập nhật ...                                      [Xóa ghi chú]  │
└──────────────────────────────────────────────────────────────────┘
```

- New editor focuses title. Existing editor first loads detail, then focuses title without selecting/replacing all text.
- Required labels “Tiêu đề” and “Nội dung” stay visible. Placeholders are hints, not label substitutes.
- New draft initially displays “Nhập tiêu đề và nội dung để tự động lưu.” Do not show validation errors immediately on untouched empty fields; show on blur/attempt to leave or an invalid edited saved note.
- Before first persistence, omit pin/labels/attachment/delete controls; show concise helper text where attachment controls will appear: “Tệp đính kèm sẽ khả dụng sau khi ghi chú được lưu.” Color is initialized from preference and can be shown as a passive swatch until saved.
- After first acknowledgment reveal optional controls in the same dialog. Do not navigate to a second edit screen.
- “Đã lưu” appears only under the state-machine rule. Notes never have a Save button. “Thử lại” retries a failed request; settings/profile forms may have explicit submit buttons.
- Editor gets its own loaded note object. A list refresh must not replace textarea values, caret position, selected labels, or active draft.
- Pin/color/label changes within this dialog feed the same autosave queue as text. Attachments have their own sequential upload queue.
- Close button, Escape, backdrop click, opening another note, settings navigation, and logout use the common close/leave guard. No direct dialog `.close()` bypass from these triggers.
- On a clean close, restore focus to the originating card/action. If a deleted card is absent, focus the page heading/new-note action.
- Optional deep link `/?note=<uuid>` opens an owned saved note after bootstrap. Update/remove that query via `history.replaceState` on open/close; it does not create a frontend routing stack. Preserve query/filter parameters. Never put an unsaved draft body in the URL.

## Dialogs and edge states

| State | Message and actions |
| --- | --- |
| Empty library | “Chưa có ghi chú.” / “Tạo ghi chú đầu tiên” |
| Empty search/filter | “Không tìm thấy ghi chú phù hợp.” / “Xóa bộ lọc” |
| Loading detail | Dialog skeleton, “Đang tải ghi chú…”; inputs disabled |
| Saving | “Đang lưu…”; user may continue typing |
| Waiting for connectivity | “Chưa kết nối. Thay đổi chưa được lưu lên máy chủ.” |
| Retry exhausted | “Chưa lưu được thay đổi.” / “Thử lại” |
| Missing/foreign/deleted note | “Ghi chú không còn khả dụng.”; preserve existing unsaved text if present |
| Storage recovery unavailable | “Trình duyệt không thể giữ bản nháp khi tải lại trang.”; saving to server can continue |
| Auth expired | “Phiên đăng nhập đã hết hạn.” / “Đăng nhập” in a separate tab, “Kiểm tra lại” |
| Unsaved leave | “Thay đổi chưa được lưu.” / “Tiếp tục chỉnh sửa”, “Thử lại”, “Bỏ thay đổi và rời đi” |
| Delete note | “Xóa ghi chú «{title}»?” + “Ghi chú và các tệp đính kèm sẽ bị xóa.” / “Hủy”, “Xóa ghi chú” |
| Delete attachment | “Xóa tệp «{filename}»?” / “Hủy”, “Xóa tệp” |
| Delete label | “Xóa nhãn «{name}»?” + “Các ghi chú vẫn được giữ lại.” / “Hủy”, “Xóa nhãn” |
| Conflict | “Ghi chú đã thay đổi ở một cửa sổ khác.”; compare panels and actions below |

Conflict dialog: two labeled, read-only panes (“Bản trên máy chủ”, “Bản đang soạn”), showing full title/body and meaningful pin/color/label differences. Actions “Dùng bản trên máy chủ”, “Giữ bản đang soạn”, and “Quay lại” obey document 06. Stack panes vertically on mobile. State explicitly that keeping the local draft replaces the displayed server version. No hidden merge or force-overwrite switch.

Recovered draft dialog: “Có bản nháp chưa lưu trong cửa sổ này.” Show note title and timestamp; offer “Khôi phục bản nháp” or “Bỏ bản nháp”. Do not auto-submit recovered content before the user's choice and current server check.

Confirmation dialogs focus the safe/cancel action first. For nested editor confirmations, preserve the editor state and restore focus correctly; never destroy/remount the editor as a way to show a confirmation.

## Label management

“Quản lý” opens a dialog listing name + rename + delete actions and a small “Tên nhãn” field with “Thêm nhãn”. Inline rename uses “Đổi tên” and “Hủy”; validate duplicates/length beside the field. Show an empty-label message when appropriate. Refresh label data and note displays after mutations; a rename must not create an independent copied label on every note.

Editor label selector is a checkbox popover with current selection, a count out of 20, and an action opening the same manager. Selecting labels saves automatically. A deleted label is removed from available options; document 06 determines how a dirty editor reconciles its revision.

## Profile/settings/auth screens

- Auth layout: readable single form column, max width 400px, product title above it. Registration has exactly four inputs. Password hint: “Tối thiểu 10 ký tự, tối đa 72 byte.” Use password input autocomplete values appropriately, and show/hide password only as an optional non-field button.
- No terms checkbox, username, phone, organization, recovery control, or marketing panel.
- Profile: current avatar, file chooser/remove, email read-only, display name input, “Lưu thay đổi” for the name. Avatar upload/removal acts immediately with status. Avatar errors do not erase a typed name change.
- Preferences: theme buttons with text labels, 14/16/18px font-size choices and a body preview, default-color swatches with labels. Preference updates autosubmit with status; reject/roll back invalid or failed values.
- Password: current/new/confirmation fields, “Đổi mật khẩu”. Success explains logout and navigates to login. Failure clears password inputs, leaves useful field errors, and never exposes submitted values in page source.
- Settings navigation includes a clear return to notes. There is no editable account email or account deletion action.

## Accessibility and visual verification

- Use landmarks, a skip link, real buttons/links, associated labels, keyboard-accessible menus, and `aria-current`/`aria-pressed`/checkbox state as appropriate.
- Use `role="status"`/polite live region for meaningful save transitions, not every keystroke; alerts for blocking errors. Label errors with `aria-describedby` and invalid fields with `aria-invalid`.
- Focus must not escape an active modal into the background. Escape cannot discard a dirty note without the same guard as the Close button.
- Do not rely on hover for actions. Name pin actions “Ghim ghi chú”/“Bỏ ghim”; name color choices and selected state.
- Use readable wrapping for Vietnamese, emoji, long titles, long filenames, and unbroken text. Body text uses `white-space: pre-wrap; overflow-wrap: anywhere` in previews/read-only displays.
- Capture workspace/editor/settings and representative empty/error/conflict screens in both themes, at 360×800, 768×1024, and 1440×900. Check focus, text overflow, contrast, actual font loading, and no missing icons. Store artifacts under `output/playwright/`.

The browser checks are planned evidence, not completed research. Use the Playwright skill's snapshot → interact → snapshot workflow during implementation.
