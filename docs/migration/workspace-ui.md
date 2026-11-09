# Shared workspace UI refinement

> Historical migration/design record. Current runtime is `apps/` on `main`; PHP/JS source paths were retired in `8714dc0` and can be inspected in Git history. Earlier pending/integration/branch statements describe that stage only. [Current status](status.md), [live feature maps](../README.md) and [cloud operations](../operations/cloud.md) supersede present-state claims here. Referenced test runs are historical, not freshly executed.

Current status: this is a historical UI-only review record. The user subsequently accepted the revised interface and authorized full integration; see [the current integration record](ui-integration.md) for connected behavior and checks. Earlier deferral/pending statements below apply to that earlier pass.

Current handoff: the [combined UI review](full-ui-review.md) now includes all remaining listed clusters. Its shared data/editors/navigation supersede earlier statements below about placeholders, independent Dashboard capture or queued Notes/History screens. Earlier screenshots remain evidence of their original focused pass.


This is the UI-only prototype for ISSUE-049, following the user's request to refine the interface before backend integration and tests. It remains on `feat/personal-ai-planner-v1`. Other UI clusters remain queued for later review.

## Plan before implementation

1. Reuse the retained Planner visual system: canvas `#f3f7ff`, surface `#ffffff`, text `#142849`, muted `#55708e`, accent `#067287`, border `#e1ebf5`; Be Vietnam Pro and the original sidebar/topbar/scenery. Preserve the original light/dark distinction.
2. Add `/preview/workspace` with synthetic in-memory content. Provide sidebar/mobile navigation, an ordinary toolbar, notification panel and localized controls. No identity, account or workspace API requests.
3. Demonstrate a compact confirmation dialog and a longer side sheet with basic/advanced fields, localized close labels, a stable Cancel/Save footer and a dirty-draft keep/discard decision. Local saves change only the synthetic preview list.
4. Provide populated/empty/loading/error states, notification read/unread controls and destinations, English/Vietnamese and light/dark selection. Inspect the rendered desktop/mobile composition only; automated tests and integration remain deferred.

## Review boundary

The preview reuses baseline CSS and the native dialog behavior. It is a review surface for shared controls, not approval of a new Tasks/Dashboard layout or a replacement for their pending issues. All content is synthetic, refresh resets local changes, and preview navigation must not enter authenticated routes or invoke providers, mail, storage or mutation endpoints. Existing application data and APIs stay unchanged.

The user has authorized work to start on the shared cluster by saying “continue”; final UI approval is still pending. Do not close ISSUE-049 merely because this prototype renders.

## Implemented preview

Open `/preview/workspace?lang=vi` (or `lang=en`); the authentication preview toolbar links to it. The frontend development server supports Fast Refresh through the existing Funnel hostname. This preview needs only Next.js; it does not start the API, database or worker.

- The sidebar, compact topbar and original scenery now wrap dedicated [Task fixtures](tasks-ui.md) for ISSUE-053, replacing the original minimal Task-list demonstration. Dashboard has its own [UI-only composition](dashboard-ui.md) for ISSUE-050; other sidebar destinations identify themselves as navigation placeholders and do not claim page parity. Settings remain discoverable in the preview sidebar.
- Create/edit updates in-memory samples. Tasks now follow the retained centered creation dialog and right-side edit sheet; both keep Cancel/Save available, advanced fields collapsed and dirty-draft keep/discard choices explicit. Short completion/reopen/archive/series-end/help confirmations use centered dialogs. Dashboard still uses the earlier compact capture fixture pending a final shared-pattern decision. No new persistence or account behavior is connected.
- Notifications include time, destination, read state, per-item/all-read controls and an unread filter. Preview controls expose populated/empty/loading/error states, five sceneries and two languages. The topbar switches light/dark. Language changes keep the new Task fixture state; reload resets sample changes. Appearance does not update saved preferences. The initial screenshots below describe the first shared-shell pass, before the dedicated Task screens.

## Rendered review, 2026-11-07

Used the Playwright CLI as a browser to inspect the rendered composition, not to run the test suite. Viewed desktop 1440×1000 and mobile 390×844, the basic/expanded editor, keep-editing confirmation, notification panel, mobile sidebar and English dark error state. Adjusted stretched form rows, active navigation styling, settings visibility and narrow preview selectors after inspection. Local draft creation and dialog dismissal were exercised for review; these are not integration or regression-test claims.

Screenshots are local ignored artifacts under `output/playwright/`: `workspace-desktop.png`, `workspace-editor-desktop.png`, `workspace-discard-desktop.png`, `workspace-notifications-desktop.png`, `workspace-mobile.png`, `workspace-editor-mobile.png`, `workspace-navigation-mobile.png`, `workspace-notifications-mobile-dark.png`, `workspace-empty-mobile.png`, `workspace-error-mobile.png`, `workspace-loading-mobile.png`. Earlier images may precede the final spacing adjustments. The final desktop/mobile populated screenshots and mobile loading view were captured through the existing HTTPS Funnel hostname; the preview URL returned HTTP 200. The frontend remains running independently with Fast Refresh and an ignored log at `output/playwright/planner-v1-dev/ui-preview.log`.

Automated tests, production build/type checking, exhaustive keyboard/accessibility checks, real notification delivery and backend integration were not run. UI acceptance is pending; ISSUE-049 remains in progress.
