# Dashboard UI refinement

Current status: this is a historical UI-only review record. The user subsequently accepted the revised interface and authorized full integration; see [the current integration record](ui-integration.md) for connected behavior and checks. Earlier deferral/pending statements below apply to that earlier pass.

Current handoff: the [combined UI review](full-ui-review.md) now includes all remaining listed clusters. Its shared data/editors/navigation supersede earlier statements below about placeholders, independent Dashboard capture or queued Notes/History screens. Earlier screenshots remain evidence of their original focused pass.


UI-only work for ISSUE-050 on `feat/personal-ai-planner-v1`. The user requested continued interface refinement before testing or backend integration. ISSUE-049 and authentication remain under review.

## Plan before implementation

1. Match the retained `frontend/src/views/planning/dashboard.php` and Vietnamese guide screenshots: illustrated greeting, chosen roadmap, Daily/Weekly tabs, checklist in the main column and supporting cards in the side column. The source/template and screenshots currently use the split layout; the older “cards above a full-width checklist” sentence in architecture decisions does not match this retained screen. Use the visible baseline for this prototype; final layout acceptance remains with the user.
2. Reuse Be Vietnam Pro and the existing palette: canvas `#f3f7ff`, surface `#ffffff`, text `#142849`, muted `#55708e`, accent `#067287`, border `#e1ebf5`. Reuse native controls, existing scenery and ring/calendar/chart classes. Keep text left aligned and responsive columns stacked on mobile. No new visual identity or decorative cards.
3. Add Dashboard to the existing workspace preview using synthetic in-memory fixtures. Daily includes Habit check-ins and selectable 30-day activity cells/legend; Weekly includes Milestones, Habit targets and seven labelled activity bars. Progress uses the full local selection, independently of status/sort filters; no denominator displays `—`.
4. Demonstrate all five Task status choices, importance/scheduled sorting, local completion, plan selection, Add for today, an explicit focus Goal choice and reused Task editing. Keep daily and weekly membership independent of dates; daily selection also selects the week. Activity figures remain labelled sample facts, not derived productivity scores.
5. Inspect rendered desktop/mobile compositions and empty/loading/error states. Record only observations actually made. Automated tests, build/type checks and backend integration remain deferred. Full Activity/Reviews refinement remains ISSUE-057; other destination pages remain preview placeholders.

## Boundary

Open `/preview/workspace?section=dashboard&lang=vi`. Reload resets all local changes. No APIs, account storage, database writes, external providers or email are used by this prototype. Do not mark ISSUE-050 complete until the user accepts the interface and later integration/verification work is resolved.

## Implemented and inspected, 2026-11-07

The existing workspace preview now opens Dashboard from its sidebar or the `section=dashboard` query. The API-backed Dashboard remains separate. The prototype includes the planned Daily/Weekly cards, localized status/filter controls, plan picker, Task editor, Habit check-ins, selected roadmap and selectable calendar/bar details. The full Activity tab explicitly identifies its separate pending review. Task dates are displayed as date-only values; the demonstration date is fixed at 2026-11-07, with the Monday week of 2–8 November. Activity counts are static synthetic facts and do not claim to project the local Task mutations.

Compared the retained Vietnamese desktop Daily/Weekly guide images and inspected the new composition with the Playwright CLI as a browser at 1440×1100 and 390×844. Reviewed local Habit/calendar selection and adding an existing Task to Today; adjusted narrow supporting-card widths, roadmap overflow, header shape and progress-bar appearance after visual inspection. Recent-calendar counts agree with the same sample week's bars, and Habit weekly counts agree with their displayed sample history. Focus choice is retained when switching tabs, languages or preview navigation; it is never silently replaced by another Goal.

Rendered review through the existing HTTPS Funnel URL returned HTTP 200. After selecting the second roadmap, navigating to the shared Task preview and returning, the selector still held `reading`. The Blocked filter showed one of five weekly Tasks while the full-selection ring remained 40%. These are observed fixture values, not test-suite results or evidence of production projection correctness.

Local ignored screenshots under `output/playwright/` include `dashboard-daily-desktop.png`, `dashboard-weekly-desktop.png`, `dashboard-weekly-filtered-desktop.png`, `dashboard-daily-mobile.png`, `dashboard-weekly-mobile.png`, `dashboard-plan-picker-mobile.png`, `dashboard-empty-mobile.png`, `dashboard-weekly-dark-mobile.png`, `dashboard-editor-desktop.png`, `dashboard-error-mobile.png` and `dashboard-loading-mobile.png`. Some screenshots predate the final visual adjustments and show intermediate local choices.

No automated tests, type check, production build, exhaustive keyboard/accessibility review or backend integration was run for this UI pass. ISSUE-050 remains in progress pending user visual approval and later integration/verification.
