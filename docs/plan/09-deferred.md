# Deferred Work and Full-Assignment Path

R1 is the fully specified implementation target. The phases below preserve the remaining assignment scope and explain extension boundaries; **they are not detailed implementation contracts or part of R1 completion**. Create a similarly concrete schema/API/UX/test addendum before implementing each later phase. Provider/infrastructure decisions remain deferred as requested.

## R2 — Note protection, sharing, and live collaboration

Prerequisite: R1 integrity and autosave gates pass.

1. Specify per-note bcrypt passwords, separate from account/other-note passwords. New/change password needs confirmation; change/disable requires current note password.
2. Define server-verified, note/session-scoped unlock authorization and its lifetime. Prompt before protected-note actions as required; do not assume an indefinite UI-only unlock satisfies the assignment.
3. Extend every access path: detail, preview, search, labels/counts, attachments, AI later, and local recovery. R1 plaintext draft recovery must be disabled for protected notes or replaced with a carefully specified secure mechanism **before** protection is enabled.
4. Add registered-email recipients, owner-only permission/revocation management, read-only/edit roles, sharing timestamp, owner identity, and an in-account notification. Add shared-with-me and recognizable locked/shared icons in both views.
5. Refactor the R1 per-owner write lock for shared-note aggregates: collaborating users must synchronize on the same note/permission boundary, not independent recipient user locks. Define lock ordering, revocation races and attachment policy explicitly.
6. Implement simultaneous editing with a local WebSocket service. Evaluate Laravel Reverb/Echo or another PHP-compatible approach then. WebSocket broadcast of last-writer text alone is not a complete conflict-resolution algorithm; specify ordering/revisions or a suitable collaboration data model.

Required future gates: read-only cannot write, recipients cannot manage owner permissions, revocation stops HTTP/WebSocket/file access immediately, wrong note password blocks all protected actions, protected content never leaks via previews, concurrent edits converge without lost text, and owner sees all recipients/permissions.

No fake lock/share booleans, empty share tables, websocket stubs, or placeholder controls are needed in R1.

## R3 — Email verification and password recovery

Prerequisite: owner chooses a delivery approach or authorizes a local email-capture service. No credentials/service setup is assumed now.

- After registration, automatically log in and send an activation link. Retain full functionality until verification; banner disappears after activation.
- Specify expiring/single-use credentials, safe resend behavior, verification links and rate limits. Do not expose activation tokens to the normal browser as an email-delivery replacement.
- Implement email link or OTP recovery, validation before new-password entry, secure token consumption and session invalidation. Require manual login after reset.
- Send sharing notification email if sharing exists; in-account notification remains a minimum acceptable sharing notification mechanism from the assignment.

Required future gates: real/captured mail contains usable links, wrong/expired/reused credentials fail safely, reset cannot enumerate accounts, verification never gates normal use, reset never auto-logs in. These gates replace R1's deliberately limited unverified banner behavior.

## R4 — PWA offline access

Prerequisite: agree how protection/sharing interact with offline data, and define the achievable access-revocation policy while a device has no network.

- Add manifest, versioned service worker/app-shell caching and IndexedDB note storage.
- Define exactly which owned/shared/unlocked notes and attachments are eligible for offline viewing, what gets cached, and how accounts are separated and cleared on logout.
- Define sync cursor/version/deletion markers, conflict behavior, cache invalidation, local schema migrations and reconnect handling. The R1 tombstone concept helps, but a proper incremental sync API still needs design.
- Keep offline editing optional unless newly chosen; the assignment explicitly requires offline access/viewing and synchronization, not an unlimited offline editor.

Required future gates: previously cached eligible notes remain viewable without network, cached data is isolated per user, deletes/revocations reconcile on reconnect, protected content follows the agreed policy, service worker update does not strand the app. SessionStorage draft recovery alone does not satisfy this phase.

## R5 — AI and delivery

AI prerequisite: owner selects provider/model/budget and permits outbound note-content processing.

- Single-note concise summary with regeneration and clear loading/error behavior.
- Natural-language Q&A retrieves authorized relevant note contents, synthesizes a grounded answer and includes direct references opening those notes.
- Choose a retrieval approach compatible with MySQL and the actual dataset. Do not replace MySQL with PostgreSQL just because a framework's vector-search example uses it.
- Enforce ownership/sharing/protection for retrieved content and citations; handle deletions/stale references, provider failure, token limits, and secrets on the backend.
- Do not present keyword search as completed AI Q&A or hardcoded text as an LLM result.

Delivery prerequisite: owner requests containerization/deployment and supplies the instructor template when available.

- Add Docker Compose for the PHP application, MySQL, assets/build and any actually required WebSocket/mail services. Define persistent data volumes, health checks, migrations, permissions and exact startup commands.
- Public deployment is separate: HTTPS, application/database/service operation throughout grading, environment/secret management, database/file backup/restore instructions and grading accounts.
- Complete rubric workbook, sequential 32-criterion demo, README, source cleanup and required GitHub evidence with real history. Preserve `.git` when claiming contribution compliance.

Do not interpret Docker Compose as automatically earning online-deployment points. Do not claim the final course project is complete until the complete assignment and submission requirements in `agent.md` have been verified.
