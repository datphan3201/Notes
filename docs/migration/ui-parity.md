# Personal UI parity

> Historical migration/design record. Current runtime is `apps/` on `main`; PHP/JS source paths were retired in `8714dc0` and can be inspected in Git history. Earlier pending/integration/branch statements describe that stage only. [Current status](status.md), [live feature maps](../README.md) and [cloud operations](../operations/cloud.md) supersede present-state claims here. Referenced test runs are historical, not freshly executed.

The historical PHP views/JavaScript behavior and retained CSS/guide screenshots informed the React UI; only current copied assets and React source remain in this checkout. Matching colors alone is insufficient. Teamwork is permanently removed from the product by user decision; live collaborative editing remains excluded from V1; core personal interactions remain required. This work does not change the existing MySQL source or replace migrated personal records.

## Current acceptance scope

The user provisionally accepted the baseline-alignment follow-up and authorized integration of all approved modules. Those modules now use real system data; the [integration record](ui-integration.md) supersedes the earlier UI-only restrictions and first-slice status. Synthetic previews remain available for comparison. Complete historical/pixel-level acceptance remains in ISSUE-045; connected behavior is checked with isolated API and desktop/mobile browser tests.

## Implementation order and checks

1. Restore the original shell, route destinations, illustrated themes, typography and mobile navigation. Verify the original CSS/assets render and keyboard/backdrop/focus behavior works.
2. Restore page-specific controls: Dashboard tabs and focus picker; Task time/status/sort/group controls and manual planning; Goal hierarchy and roadmap; Notes grid/list/tags/pin; Calendar navigation and rescheduling; Habit day history; Review periods. Verify real API responses and persisted results rather than decorative controls.
3. Restore appearance settings and editor interactions, preserving Notes autosave/conflict recovery and explicit saves elsewhere. Verify settings survive reload and cancel never silently saves a planning draft.
4. Run isolated backend/browser checks and compare desktop/mobile screenshots against the retained guide. Record remaining differences; do not claim full parity until every required flow is accepted.

## Baseline visual system

Reuse the existing CSS and five theme images rather than drawing a replacement. The baseline palette uses canvas `#f3f7ff`, surface `#ffffff`, text `#142849`, muted `#55708e`, border `#e1ebf5`, accent `#067287`. Be Vietnam Pro retains its original type scale. Keep the original fixed sidebar, compact topbar, scene header and content-specific layouts; return editing actions to their originating page.

## Acceptance record

The React runtime now reuses the baseline stylesheet set, five scenery images and translation dictionary. Routes restore Notes at `/`, Dashboard at `/dashboard`, Goal roadmaps at `/goals/{id}`, Task details at `/tasks/{id}` and the individual settings destinations. Pages have separate React components rather than one generic collection view.

Restored controls include Task time/status/sort/group filters and explicit daily/weekly planning, atomic plan-on-capture, the Goal tree and focus picker, responsive fishbone branches with a Milestone Task panel, Notes tags/pin/grid-list/color, Calendar month/week/Gantt navigation and versioned rescheduling, Habit day controls, Review period tabs and persisted appearance/history/notification settings. The retained plain-text Note engine has a typed React lifecycle wrapper, preserving checkboxes, composition and undo. Planning drafts use an explicit discard decision; account-scoped session recovery keeps interrupted drafts and their original version.

The current browser suite covers these ordinary workflows plus real invitations/files/passwords, offline conflict/deletion recovery, Habit/Review facts, recurrence lifecycle, private avatars, email MFA and email change, report moderation, permanent Archive deletion and explicit assistant unavailability. See [status](status.md) for current executed results and their limits.

Full historical UI acceptance is still a human cutover gate. Teamwork and realtime collaboration are deliberate scope decisions rather than missing controls. Cloud recovery, larger datasets and actual provider quality/cost remain separate release checks.
