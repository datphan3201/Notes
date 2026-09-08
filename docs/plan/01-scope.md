# R1 Scope and Business Rules

## Purpose and success

The owner needs a personal application to capture, find, organize, and revisit notes. The first release should be usable locally without paid accounts or external services. This is based on the owner's stated goal; no interviews, surveys, or usage statistics have been collected.

R1 succeeds when a user can register, create a note, see an honest saved indicator, reload and find the same content, organize it with labels/pinning, attach and retrieve files, and repeat the workflow on a narrow screen. Another account must not access any of that user's data.

## R1 requirement register

| ID | Requirement | Observable acceptance |
| --- | --- | --- |
| R1-A01 | Registration | Exactly email, display name, password, confirmation; bcrypt; automatic login; personal empty homepage |
| R1-A02 | Login/logout | Guests are redirected for HTML pages; JSON returns 401; logout invalidates the session |
| R1-A03 | Profile | View email/name/avatar, edit name, replace/remove validated avatar; deterministic default avatar |
| R1-A04 | Password change | Current password plus matching new passwords; all sessions invalidated; manual login with the new password |
| R1-A05 | Preferences | Persist light/dark theme, font size, default new-note color, grid/list preference |
| R1-N01 | Notes | Create, read, update, confirmed deletion; only the owner's active notes are accessible |
| R1-N02 | One editor and autosave | Same component and fields for add/edit; no Save button; obey the full autosave contract |
| R1-N03 | Views/order | Grid initially; list option; pinned notes first by pin time descending; others by update time descending |
| R1-N04 | Search | Live 300 ms debounce, title and body, case/accent-insensitive literal substring; no Search button |
| R1-N05 | Labels | List/create/rename/delete, many-to-many assignment, multi-label filtering; delete preserves notes |
| R1-N06 | Pin/color | Pin/unpin and note color changes persist; pin icon in both views |
| R1-N07 | Attachments | Images, videos, allowed document/archive files; multiple items; authorized preview/download/removal |
| R1-U01 | Usability | Vietnamese interface, keyboard navigation, focus control, honest pending/error/empty states |
| R1-U02 | Responsive | Usable at 360, 768, and 1440 CSS-pixel widths, including the editor and dialogs |
| R1-D01 | Integrity | No cross-user leaks, duplicate note on retry, silent stale overwrite, or false saved status |
| R1-D02 | Local operation | Documented PHP/MySQL setup, lockfiles, migrations, tests, no third-party service credentials required |

## Explicit scope boundaries

R1 has no email delivery, reset-password screen, note-password screen, sharing menu, shared-with-me section, WebSocket server, AI UI, service worker, offline note library, Compose file, or public deployment. Do not add disabled placeholders for these features.

`email_verified_at` remains null for normal R1 registrations. Display the factual banner **“Email của bạn chưa được xác minh.”** without claiming that an email was sent or suggesting a nonexistent resend action. The account is fully usable. This is a deliberate intermediate release and does not satisfy rubric criteria 2 or 4; automatic login and the restricted registration fields still apply.

No folders, trash/restore UI, markdown rendering, rich-text editing, to-do modes, calendar/reminders, social login, billing, administration, analytics dashboard, export/import product feature, or public note links. Technical draft recovery and internal deletion metadata support autosave integrity; they are not new product modules.

## Detailed rules

### Identity and settings

- Email: ASCII mailbox address, trim and lowercase, valid syntax, at most 254 characters, unique. No DNS lookup. Do not allow email editing in R1.
- Display name: trim, NFC normalize, 1–80 Unicode code points; reject line breaks and control characters.
- Account password: 10 or more Unicode code points, at most 72 UTF-8 bytes; reject NUL. Never trim, normalize, log, flash back, or truncate passwords. Confirmation is exact equality.
- Wrong login credentials produce the same message whether email exists or not. No Remember me field in R1.
- Preferences: `theme = light|dark` (default light), `note_font_size = 14|16|18` (default 16), `default_note_color = neutral|lemon|mint|sky|rose` (default neutral), `notes_view = grid|list` (default grid).
- Preferences belong to the account and persist across login. Default color affects only subsequently created notes. Font size affects note bodies/previews, not the entire application.

### Note data

- Title: NFC normalize, trim outer whitespace, reject line breaks/control characters, length 1–200 Unicode code points.
- Body: plain text, normalize CRLF/CR to LF, preserve all other whitespace and Unicode exactly; must contain at least one non-whitespace character; maximum 50,000 Unicode code points. Allow tab/LF, reject NUL and other C0 controls.
- Treat note text as data: HTML and Markdown-looking text remain literal. Use a textarea, escaped Blade output, and `x-text`/`textContent`, not an HTML editor or `x-html`.
- Initial creation requires only title/body. UUID, timestamps, revision, color, pin state, and label IDs are system state, never extra mandatory form fields.
- An empty/incomplete new editor creates no database row. Retain its draft locally while the editor/tab remains recoverable. Existing notes may temporarily have invalid draft fields while typing; keep the last valid server version until corrected.
- Default order: pinned first, `pinned_at DESC`, then `updated_at DESC`, then `id DESC`. Within unpinned notes use `updated_at DESC, id DESC`. Repinning an already-pinned note is a no-op; unpinning and pinning again gives a new pin time.
- Use server UTC timestamps, formatted for display in the browser's timezone. Never trust client-supplied timestamps or ownership.
- Note mutation revisions and recovery rules are defined in documents 03 and 06. A revision conflict must never silently overwrite another tab.
- Deletion is permanent in the product. Always show a confirmation dialog naming the note. An internal scrubbed tombstone prevents late requests from recreating a deleted note; there is no restore endpoint.

### Search, filters, and labels

- Query is trimmed/NFC normalized, at most 200 code points. Search the complete title and body, not just the card preview. `%`, `_`, and `!` are literal characters, not query operators.
- One search phrase matches a contiguous substring in title OR body. No stemming, fuzzy matching, token splitting, or attachment-content search.
- Label filter uses **ANY/OR** across selected labels; combine with search using AND. No selected labels means no label constraint. Clicking “Tất cả ghi chú” clears search and label filters.
- Label names: trim/NFC normalize, 1–40 code points, single line, no control characters. Uniqueness is per owner and case-insensitive but accent-sensitive: `Work` and `work` conflict, `hoc` and `học` may coexist.
- Maximum 100 labels per user and 20 labels per note. A label may be unused. Sort labels by database collation name ascending, then ID ascending.
- Renaming a label changes all displays without duplicating labels. Deleting it detaches associations and retains notes/attachments; show a confirmation explaining this consequence.
- New notes created while filtering start without labels. Do not infer assignment from the current filter; labels remain an explicit optional action after initial persistence.
- List responses are paginated, 30 notes per page. Search/filter changes reset to page 1. After a mutation reload the active page; if the page becomes empty and `page > 1`, load the previous available page. Never silently cap the entire library to the first 30 notes.

### Attachments and avatar

- Attachments become available after a note is first saved. Upload one file per request, sequentially; allow at most 20 active files and 200 MiB per note, at most 20 MiB per file.
- The allowed-type matrix and limits in document 04 are authoritative. Server-detected type decides preview behavior. A filename or browser MIME is insufficient.
- Images display a thumbnail; videos have native playback controls; other files have a file row and download action. Every attachment also has a download action.
- Deleting an attachment asks for confirmation. Successful attachment operations do not modify the text revision or sort time of the parent note; refresh its attachment list/count separately.
- Avatar: JPEG/PNG/WebP, at most 2 MiB, width/height 1–4096; decode then resize to fit 512 × 512 and re-encode JPEG with a white background. No cropping tool. Files are private and served to their owner.
- An avatar removal restores a default circle containing the first code point of the display name, uppercased where applicable. No external avatar service.

## User journeys

| Journey | Steps | Failure response |
| --- | --- | --- |
| First use | Register → personal empty homepage → new editor → fill title/body → saved → close | Field errors remain beside fields; failed save preserves draft |
| Capture and revisit | New note → type → autosave → close → reload → open | Saved status only after server acknowledgment of current draft |
| Organize and find | Create labels → attach labels → pin/color → search/filter → open | Empty results preserve filters and offer clear-filter action |
| Keep a file | Open saved note → choose file(s) → upload status → preview/download | Rejected/failed item stays visible with reason and retry/remove action |
| Edit in two tabs | Open same revision twice → edit tab A → edit tab B | Tab B gets explicit conflict with server and local versions |
| Finish a session | Close editor safely → logout | Unsaved draft requires retry or explicit discard before leaving |

## Assignment traceability

| Rubric IDs | R1 status | Later destination |
| --- | --- | --- |
| 1, 3, 5–8 | Included; email-dependent registration side effect is deferred | R3 completes email behavior |
| 2, 4 | Deferred | R3 email verification/recovery |
| 9–17, 19–22 | Included | Maintain behavior in later phases |
| 18 | Partial: pinned indicator in grid/list | R2 adds locked/shared indicators |
| 23–26 | Deferred | R2 protection, sharing, WebSocket collaboration |
| 27–28 | Deferred | R5 LLM integration |
| 29–30 | Included; instructor's score remains subjective | Maintain and refine |
| 31 | Deferred; draft recovery is not PWA completion | R4 offline viewing/synchronization |
| 32 | Deferred; local app is not online deployment | R5 delivery |

GitHub contribution history, oral examination, demo video, and submission packaging remain final-assignment obligations in `agent.md`. They are not R1 implementation tasks and must not be fabricated.
