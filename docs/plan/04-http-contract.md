# HTTP Contract

## Transport conventions

- Browser requests are same-origin. JSON base path: `/api/v1`; define in `routes/web.php` so session/CSRF protection remains active.
- The HTML shell includes a CSRF meta tag and an escaped bootstrap object with current user/preferences. JSON mutation requests send `Accept: application/json`, `Content-Type: application/json`, `X-CSRF-TOKEN`, and `credentials: 'same-origin'`.
- Multipart uploads send the same Accept/CSRF/cookie settings. Let the browser set multipart Content-Type and its boundary.
- Use relative paths and `URLSearchParams`; never interpolate unescaped titles, queries, names, or file paths into URLs.
- IDs are JSON strings; revisions/sizes/page numbers are JSON numbers; timestamps are UTC ISO 8601 strings; absent optional timestamps/URLs are null.
- Reject unknown JSON mutation keys with 422. Client ownership/timestamps/version increments must never be mass assigned. Validate only explicitly permitted fields.
- Each endpoint returns only the documented resource data. Password hashes, storage paths, session rows, and private SQL details are never serialized.

## HTML routes

| Method/path | Access | Behavior |
| --- | --- | --- |
| GET `/login` | Guest | Login form; authenticated visitor redirects to `/` |
| POST `/login` | Guest, CSRF | `email`, `password`; on success regenerate session and redirect `/`; invalid input back with field errors |
| GET `/register` | Guest | Registration form; authenticated visitor redirects `/` |
| POST `/register` | Guest, CSRF | `email`, `display_name`, `password`, `password_confirmation`; transaction creates user/preferences, logs in, regenerates session, redirects `/` |
| POST `/logout` | Auth, CSRF | Logout, invalidate session, regenerate CSRF; redirect `/login` |
| GET `/` | Auth + auth.session | Notes shell; no separate `/dashboard` |
| GET `/settings/profile` | Auth + auth.session | Profile/name/avatar screen |
| GET `/settings/preferences` | Auth + auth.session | Preferences screen |
| GET `/settings/password` | Auth + auth.session | Change-password screen |

Use PRG (post/redirect/get) for auth forms, session-flashed field errors, and CSRF hidden inputs. Transport metadata such as `_token` is permitted and does not count as an additional user-input field; extra account attributes such as `role` or `user_id` must be rejected. Never flash passwords. Wrong credentials: “Email hoặc mật khẩu không đúng.” Registration duplicate email is a field error. R1 has no reset-password or email-verification routes. Native browser refresh does not repeat successful auth submissions.

## Success resources

`UserResource`:

```json
{"id":"1","email":"owner@example.test","display_name":"Dat","email_verified":false,"avatar_url":null}
```

`PreferenceResource`:

```json
{"theme":"light","note_font_size":16,"default_note_color":"neutral","notes_view":"grid"}
```

`LabelResource`:

```json
{"id":"7","name":"Học tập","version":1}
```

`NoteResource` (detail/create/update/conflict):

```json
{
  "id":"a49ed56c-1ea9-4bf4-8e0e-f75f7b97a41d",
  "title":"Cơ sở dữ liệu",
  "content":"Ôn lại khóa ngoại.\n  Giữ nguyên thụt dòng.",
  "color":"neutral",
  "is_pinned":false,
  "pinned_at":null,
  "version":1,
  "labels":[{"id":"7","name":"Học tập","version":1}],
  "attachments":[],
  "attachment_count":0,
  "created_at":"2026-09-07T12:00:00.000000Z",
  "updated_at":"2026-09-07T12:00:00.000000Z"
}
```

Snapshot `label_ids` is derived from `labels[].id`; do not independently maintain mismatched ID and object lists. `NoteSummaryResource` is the same except it uses `content_preview` (first 240 Unicode code points, not HTML) instead of `content`, omits `attachments`, and retains `attachment_count`. Responses in a list do not include complete bodies.

`AttachmentResource`:

```json
{
  "id":"335e2898-2506-4520-b7b4-eb0e3d4a1aa1",
  "original_name":"outline.pdf",
  "mime_type":"application/pdf",
  "kind":"file",
  "size_bytes":2048,
  "preview_url":null,
  "download_url":"/files/attachments/335e2898-2506-4520-b7b4-eb0e3d4a1aa1/download",
  "created_at":"2026-09-07T12:00:00.000000Z"
}
```

`preview_url` is non-null only for approved image/video types. `avatar_url`, when present, is `/files/avatar` (private, no-store).

## JSON route register

All routes require authentication. Missing/invalid CSRF may produce 419 before authentication on mutations when Laravel's origin check does not already accept the request; do not bypass the middleware to force another status. The client always sends its CSRF token, while Laravel 13 retains its default same-origin check plus token fallback.

| Method/path | Request | Success |
| --- | --- | --- |
| GET `/api/v1/session` | No body | 200 `{data:{user,preferences,csrf_token}}` for session revalidation |
| GET `/api/v1/notes` | Query below | 200 paginated summaries |
| POST `/api/v1/notes` | Create below | 201 `{data:NoteResource,meta:{replayed:false}}`; safe replay 200 with `replayed:true` |
| GET `/api/v1/notes/{note}` | UUID | 200 `{data:NoteResource}` |
| PATCH `/api/v1/notes/{note}` | Complete snapshot + base_version | 200 `{data:NoteResource}` |
| DELETE `/api/v1/notes/{note}` | `{base_version:positive_integer}` | 204; repeated owned deletion 204 |
| GET `/api/v1/labels` | No parameters | 200 `{data:LabelResource[]}` in name order |
| POST `/api/v1/labels` | `{name:string}` | 201 `{data:LabelResource}` |
| PATCH `/api/v1/labels/{label}` | `{name:string,base_version:positive_integer}` | 200 `{data:LabelResource}` |
| DELETE `/api/v1/labels/{label}` | `{base_version:positive_integer}` | 204 |
| GET `/api/v1/notes/{note}/attachments` | UUID | 200 `{data:AttachmentResource[]}` by created_at/id ascending |
| POST `/api/v1/notes/{note}/attachments` | Multipart `id` UUID and `file` | 201 `{data:AttachmentResource,meta:{replayed:false}}`; replay 200 |
| DELETE `/api/v1/notes/{note}/attachments/{attachment}` | No body | 204; owned attachment tombstone retry 204 |
| GET `/api/v1/profile` | No body | 200 `{data:UserResource}` |
| PATCH `/api/v1/profile` | `{display_name:string}` | 200 `{data:UserResource}` |
| POST `/api/v1/profile/avatar` | Multipart `avatar` | 200 `{data:UserResource}` |
| DELETE `/api/v1/profile/avatar` | No body | 204, including already absent |
| GET `/api/v1/preferences` | No body | 200 `{data:PreferenceResource}` |
| PATCH `/api/v1/preferences` | Nonempty subset of the four preference fields | 200 full `{data:PreferenceResource}` |
| POST `/api/v1/password` | `{current_password,password,password_confirmation}` | 200 `{data:{redirect_to:"/login"}}`, all sessions invalidated |

Preferences permit only the four enumerated keys. Send one changed key at a time through a serialized settings request queue; coalesce repeated unsent changes by key. Roll back that visible setting on failure with inline feedback. Current-note color is changed through the note snapshot, not preferences.

Password change validates current password and matching new password under the same rules as registration. After replacing the hash, invalidate database sessions for this user, log out the current guard, invalidate/regenerate the current session token, and return the redirect instruction. Clear current-user editor recovery on the client before navigating to login. Other sessions fail authentication on their next request. Do not return a logged-in user resource from this endpoint.

## List query

`GET /api/v1/notes?q=...&label_ids[]=7&label_ids[]=8&page=1`

- `q`: optional string; default empty; trim/NFC, max 200 code points.
- `label_ids[]`: optional distinct array of at most 20 existing owned numeric IDs; default empty. Malformed, missing, or foreign selected labels produce 422 `errors.label_ids` without revealing names.
- `page`: optional positive integer; default 1. `per_page` is fixed at 30 and not client-configurable.
- No sort parameter in R1. Use document 01's frozen sort.
- Escape LIKE patterns with `!`: replace `! → !!`, `% → !%`, `_ → !_`; bind `%<escaped-query>%` as a parameter with `ESCAPE '!'`. Group `(title LIKE ... OR content LIKE ...)` beneath the owner/active constraints.
- Return ANY selected label via EXISTS. Never concatenate raw query strings into SQL.

```json
{
  "data":[],
  "meta":{"current_page":1,"per_page":30,"last_page":1,"total":0}
}
```

For a requested page beyond the available range, return an empty `data`, the requested `current_page`, and the actual `last_page` (minimum 1). The client reloads `last_page`; it does not display a permanent empty library. Search/filter changes reset page before sending. A deleted selected label triggers label refresh/removal from active filters and a visible notice, then a fresh query.

## Create and update bodies

Create:

```json
{
  "id":"a49ed56c-1ea9-4bf4-8e0e-f75f7b97a41d",
  "title":"Cơ sở dữ liệu",
  "content":"Ôn lại khóa ngoại.",
  "color":"neutral"
}
```

`id`, `title`, and `content` are required in transport; ID is generated automatically. `color` is optional; server defaults to the user's preference. The client sends its draft's chosen default color for deterministic retry. No labels/pin/attachments in the create request. Show their controls after first successful persistence.

Update:

```json
{
  "base_version":1,
  "title":"Cơ sở dữ liệu",
  "content":"Ôn lại khóa ngoại và chỉ mục.",
  "color":"mint",
  "is_pinned":true,
  "label_ids":["7"]
}
```

All six update fields are required; empty `label_ids` removes associations. Note title/body validation is identical for create/update. An existing note's desired snapshot must never be constructed from a list preview: fetch detail first.

Pin/color actions on a card fetch detail, construct one snapshot changing just the intended field, then PATCH using its version. Disable the card control until acknowledged. Do not use a stale list preview to replace content. A conflict refreshes the card and asks the user to repeat the action; it does not overwrite newer data. When the editor is open, all note changes use its one autosave controller.

## Upload allowlist

Limits use binary units: 2 MiB = 2,097,152 bytes; 20 MiB = 20,971,520 bytes; 200 MiB = 209,715,200 bytes.

| Extensions | Server validation | Kind / serving |
| --- | --- | --- |
| jpg, jpeg | Detected image/jpeg, valid image dimensions | image; inline preview + download |
| png | Detected image/png, valid image dimensions | image; inline preview + download |
| webp | Detected image/webp, valid image dimensions | image; inline preview + download |
| mp4 | Detected video/mp4 | video; inline preview + download |
| webm | Detected video/webm | video; inline preview + download |
| pdf | Detected application/pdf | file; download only |
| txt, md, csv | UTF-8 text (allow an initial BOM), no NUL; detected text/plain, text/csv, or text/markdown | file; download only |
| zip | Detected application/zip or application/x-zip-compressed; opens as a ZIP | file; download only; never extract |
| docx, xlsx, pptx | Matching OOXML MIME or ZIP; ZIP contains `[Content_Types].xml` and the expected `word/document.xml`, `xl/workbook.xml`, or `ppt/presentation.xml` | file; download only; never extract |

For ZIP structure checks, examine entry names without extracting/expanding payloads; reject corrupt archives or more than 10,000 entries. Extension and detected content must agree. Reject empty files, unsupported types, path separators/control characters in normalized display names, and filenames exceeding 255 code points. Derive a basename safely; stored paths are independent randomized names. An HTML/PHP/SVG/executable renamed to an approved extension must not pass.

Attachment images: dimensions up to 10,000 per side and at most 25 million pixels; use metadata validation without full-size thumbnail decoding. Serve the original validated file with constrained CSS for R1; no thumbnail-processing service. Avatar limits/re-encoding are stricter, as specified in document 01.

Multiple files upload sequentially with an indeterminate uploading indicator and completed-item count; do not fabricate a byte-progress percentage from `fetch`. The HTML `accept` value mirrors allowed extensions as a convenience, never the security boundary. A failed item must not block later valid items; retain the failed File object and UUID for explicit retry while the page is open. A different selected file always gets a new UUID.

## Private file routes

| Method/path | Response |
| --- | --- |
| GET `/files/attachments/{attachment}/preview` | Authorized image/video only; detected Content-Type, inline disposition |
| GET `/files/attachments/{attachment}/download` | Authorized file, `application/octet-stream`, attachment disposition with safe original filename |
| GET `/files/avatar` | Current user's processed JPEG; 404 if no avatar |

Support HEAD and byte-range behavior for image/video responses using the framework/Symfony file response, so video seeking works. Do not implement ad hoc range parsing. File responses must retain private no-store/nosniff headers. Do not inline PDFs, HTML, SVG, ZIP, or Office files. Use the framework's safe Content-Disposition builder, including non-ASCII filenames.

Guests navigating HTML/file URLs redirect to login; JSON endpoints return 401. Unknown, foreign, deleted-parent, deleted-attachment, or missing-disk resources return 404. Check the attachment's actual parent matches a nested note route before mutation.

## Errors

JSON error shape:

```json
{
  "code":"VALIDATION_FAILED",
  "message":"Dữ liệu không hợp lệ.",
  "errors":{"title":["Nhập tiêu đề ghi chú."]}
}
```

`errors` is an object; omit it when there are no field errors. Conflict additionally has top-level `current`, containing the authorized current NoteResource or LabelResource.

| HTTP | Code | Required client behavior |
| --- | --- | --- |
| 401 | AUTH_REQUIRED | Pause editor mutations; retain recovery; offer login in another tab and session recheck |
| 404 | NOT_FOUND | No resource disclosure; preserve unsaved note draft and explain unavailability |
| 409 | NOTE_CONFLICT / CREATE_CONFLICT | Pause autosave, compare local/server versions, require explicit resolution |
| 409 | LABEL_CONFLICT | Refresh current label; require user to reapply rename or reconfirm delete |
| 409 | UPLOAD_ID_REUSED | Do not reuse this ID for different file content; show item error |
| 410 | NOTE_DELETED / ATTACHMENT_DELETED | Stop retrying the deleted identity; do not recreate it automatically |
| 413 | PAYLOAD_TOO_LARGE | Preserve form/draft where possible; explain upload/request limit |
| 419 | SESSION_EXPIRED | Same pause/re-auth flow as 401; fetch a fresh CSRF token after session confirmation |
| 422 | VALIDATION_FAILED | Field errors; no automatic unchanged-data retry |
| 429 | TOO_MANY_REQUESTS | Respect Retry-After; do not run an immediate retry loop |
| 500 | INTERNAL_ERROR | Generic message, preserve draft, bounded retry for autosave only |
| 503 | SERVICE_UNAVAILABLE | Same preservation/retry rules; no fake successful save |

Examples of fixed messages: `NOT_FOUND`: “Không tìm thấy dữ liệu.”; `NOTE_CONFLICT`: “Ghi chú đã thay đổi ở một cửa sổ khác.”; `SESSION_EXPIRED`: “Phiên đăng nhập đã hết hạn.”; upload size: “Mỗi tệp tối đa 20 MB.”

Implement exception rendering for `/api/v1/*`, including validation, CSRF, auth, throttle, DB availability, and oversized PHP requests. Never let a login HTML response be parsed as a successful JSON save. The client treats non-JSON/malformed/timeout responses as failed acknowledgments.

Rate limits: registration 10/min/IP; login 5/min/normalized-email+IP and 20/min/IP; password change 5/min/user; note reads 300/min/user; note/label/settings mutations 240/min/user; uploads 30/min/user. Return Retry-After on 429. Tests cover enforcement, and rate-limit state must be isolated between tests.

The exact contracts here are project decisions. Framework behavior should be implemented using [Laravel validation](https://laravel.com/docs/13.x/validation), [responses](https://laravel.com/docs/13.x/responses), and [private file storage](https://laravel.com/docs/13.x/filesystem).
