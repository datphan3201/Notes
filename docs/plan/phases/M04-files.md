# M04 — Private Files and Avatars

Status: Verified on 2026-09-17. Depends on M03.

## Objective

Port private file integrity and streaming before rendering/cutover.

## Why this phase comes now

Files depend on M03 Note ownership and must be proven before M05 removes
Laravel's storage and binary-response behavior.

## Required reading

Security/runtime, database, operations; existing file actions/rules/controllers/command/tests.

## Files affected

Every existing file/avatar action, controller, request/rule, resource, model,
prune command, private storage path, target adapters, routes and tests.

## Files to create

- `backend/src/Application/Files/{UploadValidator,AvatarProcessor,FileService,FileStreamer,PruneFiles}.php`
- `backend/src/Infrastructure/Storage/LocalPrivateStorage.php`
- `backend/src/Infrastructure/Persistence/Pdo/Files/{AttachmentRepository,PendingDeletionRepository}.php`
- Target controllers/validators under `backend/src/Http/`

Modify target routes/bootstrap/CLI/tests. Remove nothing.

## Files to modify

Target routes, explicit bootstrap wiring, CLI command registry, target schema,
tests, environment storage configuration, status and verification evidence.

## Files to remove

None.

## Detailed implementation steps

### M04.1 Storage/validation

Implement configured canonical root, generated relative paths, symlink/path containment, upload error/size/name/extension/MIME/image/text/archive validation, digest, and kind. Preserve exact limits and error layers.

### M04.2 Attachments

Write bytes before transaction; lock owner/Note; validate UUID replay/tombstone, 20 files/200 MiB quota; create metadata; compensate new bytes on failure. Delete scrubs metadata and records pending cleanup without changing Note version/time.

### M04.3 Avatar

Validate 2 MiB/4096 dimensions, decode, fit 512×512 on white, JPEG quality 88, write replacement, atomically swap path, enqueue old file, compensate on DB failure.

### M04.4 Streaming/cleanup

Authorize owner and active parent before path access. Implement GET/HEAD, single ranges, 206/416, safe preview types, Unicode Content-Disposition, no-store/nosniff. Implement retryable pending cleanup and >1-hour managed orphan pruning.

## Business rules

Private bytes are never under the public root or addressable by storage path.
Database metadata is authoritative; file writes precede and compensate failed
transactions, while file deletes follow a transactional pending-deletion row.
Streams release the session lock and never reveal foreign existence.

## Risks

Traversal/symlink escape, MIME spoofing, header injection, wrong Range/HEAD
semantics, quota races, orphaned bytes, deleting active files, memory-buffered
large streams, and DB/filesystem partial failure.

## Validation

Inspect configured/canonical paths and public-root separation, verify response
headers and byte ranges through real HTTP, inject DB/storage failures, and run
prune twice to prove safe retry/idempotency.

## Tests

Port Files/FileIntegrity/Security cases; add symlink/traversal/header injection, valid/suffix/open-ended/invalid/multiple range, HEAD body suppression, competing quota slot, upload-vs-delete, DB/disk compensation, active/recent file retention.

## Exit criteria

All existing file/avatar contracts plus new stream/path checks pass through target; no raw private file is web-accessible.
