# M09 — AI Proposal and Approval

Status: Verified on 2026-09-18. Depends on M08.

## Objective

Add provider-neutral AI suggestions and an explicit, auditable approval/apply workflow.

## Why this phase comes now

AI comes last among features because it must call the same complete application
services and must not become an alternate validation path.

## Required reading

Architecture, database, HTTP, UI, domain contract, Review contract, AI contract, security/runtime, operations, verification, and M08 evidence. Verify current Google AI Studio model/tier/data-handling documentation immediately before provider implementation; record the verified model rather than assuming the planning-time candidate remains available.

## Files affected

AI schema/domain/application/provider/PDO/HTTP/UI, configuration/privacy/error
handling, Planning/Review service composition, routes/wiring, tests and evidence.

## Files to create

- `backend/src/Application/AI/{AIProviderInterface,GenerationRequest,GenerationResult,PlanningAssistant,ProposalValidator,ApplyAIAction}.php`
- `backend/src/Domain/AI/{AIAction,AIActionStatus,AIPermission,Proposal}/*`
- `backend/src/Infrastructure/AI/{GoogleAIProvider,HttpAITransport}.php`
- `backend/src/Infrastructure/Persistence/Pdo/AI/PdoAIActionRepository.php`
- `backend/src/Http/Controller/Api/AIActionController.php`
- `backend/database/plain-migrations/*_create_ai_actions.php`
- `backend/tests/Plain/{Unit,Integration,Http}/AI/*`
- `frontend/src/js/ai/*` and AI proposal/approval views/components

## Files to modify

Routes, configuration schema and `.env.example`, dependency wiring, CSP/connect policy only if required by server behavior, privacy/help documentation, navigation/Review planning UI, status and verification evidence.

## Files to remove

None.

## Detailed implementation steps

### M09.1 Provider-neutral contracts

Define typed generation input/output, transport, safe provider error codes, and a fake provider. Business/application code depends only on `AIProviderInterface`; only the infrastructure adapter knows Gemini endpoints/auth/response shape. Provider receives allowlisted serialized context, never repositories, cookies, file bytes, arbitrary tools, SQL, or write access.

### M09.2 Context and consent

Implement capability-specific context loaders for selected owned active objects, capped by object/byte limits. Exclude Notes, attachments, secrets and unrelated records by default. Add first-use disclosure/opt-in and a per-request preview of categories sent. Reject foreign/archived IDs using non-enumerating behavior before provider invocation.

### M09.3 Proposal validation/storage

Reject duplicate JSON keys, unknown fields/operations, invalid types/states/limits and forbidden ownership/status fields. Resolve only allowlisted existing IDs and earlier local IDs. Canonicalize exactly as document 13, hash with SHA-256, and persist immutable canonical JSON, context versions, provider/model, status, expiry and audit metadata. Provider output never creates domain data.

### M09.4 Approval/apply transaction

Implement Apply in the documented lock order. Recheck status, hash, expiry, owner, active references and expected versions; validate the whole proposed hierarchy/dependency graph; generate server UUIDs; call ordinary services; commit created-ID map and Applied state atomically. Matching Applied replay returns the stored map. Any validation/write failure rolls back all domain rows and preserves a safe, actionable proposal state. Reject is an idempotent state transition.

### M09.5 Google adapter and operations

Use server-side key/configured model, strict timeouts, bounded retry only for generation transport, structured-output request where supported, and safe parsing. Never retry Apply or silently use a paid/different model. Map timeout, 429/quota, safety refusal, malformed output, and unavailable provider distinctly. Log IDs/model/latency/token counts/error code only—never prompt, context, output, or key.

### M09.6 UI

Implement capability/object selection, disclosure, generation progress/cancel semantics, exact structured preview, per-operation validation display, Apply/Reject confirmation, stale/expired regeneration guidance, and created-object links. Do not expose Modify/Delete permissions in v1 UI.

## Business rules

Read/Suggest occurs only after user action; Create occurs only after explicit approval. Modify/Delete are disabled. AI-created structures use identical services, transaction rules, ownership, versioning and validation as manual work. Provider failure cannot modify planning data.

## Risks

Vendor/model changes, prompt injection in user content, accidental data over-sharing/logging, partial apply, stale context, duplicate apply, malformed structured output, free-tier quotas, and tests accidentally calling a live provider.

## Validation

Inspect canonical JSON/hash examples, persisted audit rows/log redaction,
disabled-provider behavior and retry timings; prove the required suite has no
network access; perform only an explicitly configured non-sensitive optional
live smoke against the implementation-time verified model.

## Tests

Use the fake provider for all required tests: each capability, allowlist/redaction/limits, duplicate keys, canonical hash stability, local-reference ordering, cycles, foreign/archived/stale IDs, expiry, tampered hash, provider errors, retry boundaries, rejection, atomic rollback and apply replay. Assert manual and AI creation produce equivalent persisted objects/validation errors. Network must be blocked or fake-injected in the suite. Optional live smoke uses non-sensitive fixtures and is evidence-separated.

## Exit criteria

Critical cases 15–17 pass; no generation path writes domain data; no apply path bypasses normal services; logs and persisted audits contain no prohibited content; application works fully when AI is disabled or unavailable.
