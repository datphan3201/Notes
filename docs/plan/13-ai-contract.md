# AI Proposal and Approval Contract

## Boundary

`AIProviderInterface::generate(GenerationRequest): GenerationResult` is the only business-facing provider interface. `GoogleAIProvider` translates the Gemini protocol. `PlanningAssistant` loads selected owned context, `ProposalValidator` canonicalizes output, and `ApplyAIAction` executes approved operations through ordinary application services.

No provider receives repositories, SQL, session cookies, file bytes, or write tools.

## User flow

1. Select capability and objects.
2. Server loads owned, active, allowlisted fields only.
3. UI previews which data will leave the application and obtains first-use opt-in.
4. Provider returns structured JSON.
5. Server validates/canonicalizes and stores immutable proposal, hash, context versions, provider/model, and expiry.
6. User reviews exact operations and chooses Apply or Reject.
7. Apply revalidates everything and commits atomically.

## V1 capabilities and permissions

Suggest Goals/Milestones/Tasks, review selected Goals/Tasks, break a Goal into structure, help plan, and draft Review reflection. Read/Suggest are enabled during generation; Create is enabled only by approval. Modify/Delete are defined enum values but disabled.

## Proposal schema

```json
{
  "schema_version": 1,
  "summary": "string",
  "operations": [
    {
      "op": "create_goal",
      "local_id": "g1",
      "parent": { "existing_id": "uuid", "version": 3 },
      "fields": { "name": "...", "importance": 3 }
    }
  ]
}
```

Allowed operations: create_goal, create_milestone, create_task, add_contribution, add_milestone_dependency. References may target selected existing objects with expected versions or earlier proposal-local IDs. Ownership/user IDs, timestamps, status Completed/Done, SQL, code, arbitrary URLs, and unknown fields are forbidden.

Limits: 50 operations, 100 KiB proposal, 50 context objects, 100 KiB selected context, 24-hour expiry.

## Canonical hash

Decode JSON with duplicate-key rejection, validate types, sort object keys recursively while preserving operation/array order, encode UTF-8 JSON without insignificant whitespace, then compute SHA-256. Store exact canonical JSON and hash. The Apply request sends action ID, base version, and proposal hash. Editing a proposal creates a new AIAction; stored proposals are immutable.

## Apply transaction

1. Begin and lock owner then AIAction.
2. Require Proposed state, matching version/hash, and unexpired action.
3. If already Applied with matching hash, return stored created-ID map (idempotent replay).
4. Reload referenced contexts; require owner, active state, and expected versions.
5. Resolve local references to server-generated UUIDs.
6. Validate the proposed hierarchy/dependency graphs as one batch.
7. Call normal create/relationship services inside the existing transaction.
8. Store created-ID map and mark Applied atomically.

Any failure rolls back all writes and leaves the proposal Proposed with a safe error response. Rejected/Expired/Failed cannot apply.

## Provider operations

Server-side key only. Configuration selects model; initial candidate is `gemini-2.5-flash-lite`, verified against the actual account at implementation time. Connection timeout 5s, total 30s, browser 40s. Retry transient transport/429/503 at most twice with jitter and `Retry-After`; never retry an Apply transaction or switch automatically to a paid model.

Malformed output, safety rejection, quota exhaustion, timeout, and provider unavailability have distinct safe error codes. Generation writes no domain records.

## Privacy/logging/tests

Free-tier data handling is disclosed before first use. Never send all Notes/attachments by default. Logs include action/request IDs, provider/model, latency, token counts if supplied, and safe error code—never selected content, prompt, response, or key.

Use a fake provider for deterministic tests. A live smoke check is optional and requires configured credentials and non-sensitive fixtures; it is reported separately.
