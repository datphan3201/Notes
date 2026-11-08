# Authentication refinement

The retained guest layout and authentication views are the visual/interaction reference. This pass covers sign-in, sign-up, recovery by link/code, password reset, verification results and the pending two-factor challenge. It keeps migrated accounts and the running Funnel intact.

## Current review mode

The user has paused testing and further backend integration until the interface is approved. Continue with UI changes only. The dedicated `/preview/login?lang=vi` entry links all six authentication screens, reuses the same components, and handles form feedback/navigation locally. Preview handlers and effects return before account API calls; no credentials, account mutations or email jobs are sent. Existing runtime work remains on the migration branch, but it is not evidence of UI approval. Pending API/browser verification is deferred until the user accepts the interface.

## Plan and checks

1. Reuse the original guest split layout, branding, form widths, mobile treatment and English/Vietnamese copy. Compare rendered baseline/current screenshots at desktop and mobile sizes.
2. Restore explicit routes, password visibility/confirmation, field-level validation, pending/error/success states, keyboard focus and navigation. Verify sign-in/sign-up return to Dashboard and language choice survives guest navigation.
3. Complete recovery-code and email-fallback interactions through real API/outbox behavior, retaining expiry, bounded attempts, single-use tokens and session revocation. Exercise isolated PostgreSQL tests; send no live test emails.
4. Run the auth browser matrix and the existing interaction suite on separate test ports/storage/build output, keeping the public development runtime available.

## Boundaries

The new runtime currently requires 12 characters for new passwords; the old template says 10. This pass keeps the authoritative 12-character policy and updates the hint. Existing shorter legacy passwords remain accepted at sign-in. Administrative invitation/closed-registration management and profile email-change workflows remain separate migration gaps; the guest UI must not advertise unsupported controls.

## Implemented behavior

- Canonical `/login`, `/register`, `/forgot-password`, `/reset-password`, `/verify-email` and `/two-factor` pages, with compatibility for existing `/account/recover|reset|verify` links. Successful sign-in/sign-up opens Dashboard; authenticated visitors to sign-in/sign-up return there as well.
- Original guest branding, icons, fonts, split layout, responsive treatment and English/Vietnamese copy. Language is carried through guest links; registration persists it and creates the baseline three default Areas in that language.
- Independent password visibility controls, confirmation, field errors/focus, disabled pending forms and retained entries after connection errors. New-password hints reflect the authoritative 12-character policy. Reset also validates the entered account email when supplied.
- Recovery emails include a single-use full link and six-digit code. Five bad guesses disable the code while preserving the full link. Successful code exchange rotates the capability without extending its original 30-minute expiry. Reset revokes existing sessions and tokens and requires a new sign-in. Verification links expire after 24 hours.
- MFA remains a pending identity until a valid authenticator or email fallback code succeeds. Only the latest fallback code works; expiry, attempt limits and single-use/replay rejection remain enforced. A refresh preserves the pending challenge in the current tab; Back to sign in clears it.
- Email capabilities are removed from the visible URL and retained only in tab-scoped storage until expiry/success, so refresh/language navigation works. Hash changes are handled when another email link opens on the current page.

## Visual evidence and deliberate differences

Offline renders of the retained PHP templates (no database or application startup) were compared with React screenshots in ignored `output/playwright/auth-refinement/{baseline,current}/`. At 1280×800 and 390×844, measured card, heading, story and language-region bounding boxes match for English/Vietnamese sign-in and English sign-up. The original icon paths and password eye paths are retained. These measurements cover those screens, not every possible error state or viewport.

Recovery and MFA retain the original shell and copy while using the same full-width, explicit-label field controls as sign-in/sign-up; their field arrangement differs from the legacy inline recovery labels. Error/focus and pending feedback are explicit. Browser screenshots and interactions are used for acceptance, rather than claiming every auth pixel is identical. The 12-character hint is another deliberate difference.

## Verification

The final verification results are recorded in [implementation status](status.md). API tests cover localized default Areas, confirmation rollback, recovery-code rotation/expiry/attempt limits, generic failures, email matching, session revocation and pending MFA email fallback. Browser cases cover desktop/mobile layout, guest language, password eyes/keyboard, confirmation, Dashboard navigation, duplicate submission, connection loss, link/code recovery, refresh, compatibility URLs, token reuse/expiry, automatic verification and both MFA paths. Mail is inspected only in the isolated database outbox; this pass sends no live test emails.

Administrative registration policy controls, profile email change, email-only MFA enrollment and assisted recovery of imported MFA accounts remain outside this guest refinement. Full product parity remains open in ISSUE-045.
