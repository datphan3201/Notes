# Verification limits

[Testing](README.md) · [Issue report](../issues.md) · [Executed documentation checks](documentation-checks.md)

Record discovered defects and unresolved product decisions in the issue report. This guide defines what each kind of evidence can establish; it is not another issue register.

| Evidence | What it establishes | What it does not establish |
| --- | --- | --- |
| Documentation checker | Registered route coverage, unique source targets, valid local links/anchors, fresh generated output and matching diagram receipts | Correct business behavior or complete UI/authorization coverage |
| Documentation-tool regression runner | The actual checker/generator accept healthy fixtures and reject the tested forms of drift | Correct behavior of the application or every possible Markdown/registry input |
| Named PHPUnit/Node test link | The relevant existing case can be inspected at that source location | That the case passed in this environment or exercises a whole browser page |
| HTTP shell 200 | The shell route rendered successfully | The subsequently fetched object is owned/accessible or the browser applied CSS and initialized controls |
| Archify final receipts | The listed automated artifact/provenance/browser checks passed for those exact candidate/artifact bytes | Perceptual visual review or application acceptance |
| Local/fake provider test | The exercised deterministic protocol/logic path behaves as asserted | Actual SMTP delivery, live AI availability, provider quotas or production configuration |

Main Notes has account-scoped recovery. Explicit-save Task/Review drafts do not promise browser-crash recovery. Check each component's `Coverage limit` note and relevant source when deciding what a test actually exercises.

Live SMTP/AI, deployed web-server behavior, concurrency/failure injection and backup restoration require their own scoped evidence. Historical suite totals and unrelated passing checks do not resolve an open issue. Document the command, environment, observed result and remaining limits before changing an issue to Resolved.
