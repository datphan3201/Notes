# Complete UI review preview

> Historical migration/design record. Current runtime is `apps/` on `main`; PHP/JS source paths were retired in `8714dc0` and can be inspected in Git history. Earlier pending/integration/branch statements describe that stage only. [Current status](status.md), [live feature maps](../README.md) and [cloud operations](../operations/cloud.md) supersede present-state claims here. Referenced test runs are historical, not freshly executed.

Current status: this is a historical UI-only review record. The user subsequently accepted the revised interface and authorized full integration; see [the current integration record](ui-integration.md) for connected behavior and checks. Earlier deferral/pending statements below apply to that earlier pass.

Written before implementation for the user's request to finish all remaining interface clusters for one combined review. Work stays on `feat/personal-ai-planner-v1`; the PHP/JS baseline, private data and real API implementation remain intact. The user provisionally accepted the revised UI and authorized [backend integration](ui-integration.md) on 2026-11-07. The UI-only observations below describe the earlier review pass.

## Scope and sequence

1. Establish one in-memory preview dataset and navigation for Goals/Milestones, Tasks/series, Notes, Habits, Calendar, Reviews/Activity, settings and support. Reuse the existing illustrated Planner palette (`#f3f7ff`, `#ffffff`, `#142849`, `#55708e`, `#067287`, `#e1ebf5`), Be Vietnam Pro and original assets. Existing Dashboard/Tasks previews must remain reachable and keep their drafts while navigating.
2. Complete ISSUE-051/052: independent Goal tree disclosure, Areas management/icons/stars, explicit shared focus, dated timeline, fishbone paging, Goal information/Strategy/Related, Milestone Task/criteria/prerequisite panels and scoped local editing/archival confirmations.
3. Complete ISSUE-054/055: Notes collection/editor and attachments/share/lock/offline/summary examples; Calendar month/week/Gantt, selection/capture, unscheduled tray, drag and keyboard scheduling. Calendar changes must appear in the same sample Task dataset.
4. Complete ISSUE-056/057: Habit capture/check-in/history/future-rest/weekly target presentation; daily/weekly/monthly Review snapshots, editable reflections and date-selected Activity facts without fabricated scoring.
5. Complete ISSUE-058–060: Profile/avatar/email and Appearance gallery/preview/save/cancel; password visibility/confirmation and guided email/authenticator MFA samples; notification preferences, History/reopen and Archive filtering/grouped restoration/parent blockers/destructive confirmations.
6. Complete ISSUE-061/062: conversational assistant with named citations, readable before/after proposals, explicit local Confirm/Reject and stale/error examples; localized screenshot-led guide/FAQ/tour; reporting and administrator review/users/invitations/registration/moderation-log screens. The user's request for all remaining listed clusters authorizes these support/admin UI examples. It does not authorize real moderation, account deletion, mail or provider calls. Teamwork is permanently removed; live collaboration remains excluded from V1.
7. Remove navigation placeholders for these clusters, expose a single review entry point, inspect rendered desktop/mobile compositions and representative local flows, then update each issue with honest implementation/review limits. No automated tests/build/type checks or backend mutations in this UI pass.

## Review boundary

All work is a synthetic client-side review surface. Refresh resets the session; files/images selected for preview stay in browser memory. Security verification codes, AI responses, notifications and moderation examples are explicitly illustrative. Sensitive actions require local confirmation but never operate on an actual account, database, external provider or private server file. Full parity, security, persistence, accessibility and production readiness are not established by this preview.

The final handoff must link the complete preview, list any actual remaining UI limitation and keep migration issues open until the user accepts the interface and subsequent integration/verification is performed.

## Implemented review surface

Open [the shared Funnel preview](https://tdat.tail431746.ts.net/preview/workspace?lang=vi), or `http://127.0.0.1:3000/preview/workspace?lang=vi`. The default is Dashboard; every listed cluster is reachable from its sidebar. The footer Settings button opens the personal settings destinations, reports and guide. Administration appears in the main navigation when the preview role is administrator. The optional topbar preview-controls popover switches locale, scenery, populated/empty/loading/error examples and role; the initial role is personal. The circular assistant launcher stays available across pages. Authentication is separately reachable at `/preview/login?lang=vi`.

| Cluster | Preview source | Included UI |
| --- | --- | --- |
| ISSUE-051/052 | [Planning](../../apps/web/src/components/preview/planning.tsx) | Areas, independent Goal tree, shared focus, icons/stars, dated timeline, paged fishbone, information/Strategy/Related, Milestone work/prerequisites and confirmations |
| ISSUE-054 | [Notes](../../apps/web/src/components/preview/notes.tsx) | Collection/editor, links/tags/pin/color, local autosave/offline/conflict, browser file previews/backgrounds, sharing/lock and illustrative summary/questions |
| ISSUE-055 | [Calendar](../../apps/web/src/components/preview/calendar.tsx) | Month/week/agenda/unscheduled capture, date moves, Gantt tree/grouping/three zooms, prerequisites/progress and drag/keyboard controls |
| ISSUE-056 | [Habits](../../apps/web/src/components/preview/habits.tsx) | Capture/edit, direct check-in, seven recent days and three future rest dates, daily/weekly targets/streaks, rest window and archival |
| ISSUE-057 | [Reviews/Activity](../../apps/web/src/components/preview/reviews.tsx) | Period collections, independent saved snapshot, reflection drafts/deletion, date/type/month selection and yearly heatmap |
| ISSUE-058–060 | [Settings](../../apps/web/src/components/preview/settings.tsx) | Profile/avatar/email, scenery/background/RGB/quote, security/MFA confirmations, notification settings, History and grouped Archive |
| ISSUE-061 | [Assistant](../../apps/web/src/components/preview/assistant.tsx) | Persistent chat, named Note chips, local before/after proposal confirmation/rejection, stale/pending/error/interrupted examples |
| ISSUE-062 | [Support](../../apps/web/src/components/preview/support.tsx) | Localized guide/tour/FAQ, report evidence/snapshots/outcomes, guarded user actions, registration/invitations/log |

[Shared preview data](../../apps/web/src/components/preview/workspace-data.tsx) connects these screens with the existing Dashboard and Tasks. Task status/checklist changes and Habit check-ins append illustrative Activity facts. Shared floating Task and Goal/Milestone editors preserve their originating page. Task-linked Notes open in the same Notes collection. Browser Back/Forward restores section context without discarding mounted draft maps. The earlier isolated Dashboard fixtures and minimal Task editor were removed once no longer used.

Sample day: **2026-11-07**, with DATE values distinct from ISO activity instants. Sample locked-Note password and security verification code: **123456**. These are intentionally fake; do not enter real credentials. Sample sharing recipients are `binh@example.test` and `chi@example.test`.

## Initial rendered review on 2026-11-07

Used Playwright CLI to operate a browser and inspect compositions. This was a UI review, not an automated test suite or a claim of complete accessibility/behavior equivalence.

- At **1280×720**, visited Goals/tree/roadmap, Calendar, Habits, Notes/editor, Reviews, Dashboard and Profile/Appearance/Security/History/Archive/Reports/Administration. Inspected full-page captures and corrected fishbone text overlap, oversized month cells, filter widths, checkbox alignment, appearance switches and dark-theme assistant contrast.
- At **390×844**, opened mobile navigation and the Notes, Goals, Calendar, Habits and Reviews collections. Observed page scroll width **390 px** for each; Calendar/Gantt keep their own horizontal scroll. Viewed Appearance and the assistant in dark mode; the assistant stayed within the viewport. Mobile Goal row density and launcher size were subsequently reduced.
- Operated a Habit check-in and observed Dashboard display **3/3 this week**. Opened an assistant proposal, confirmed it and observed **Applied**. Created a weekly Review snapshot displaying **1/5 completed Tasks, 7 Habit check-ins** in that review session. These figures describe that sample session, not imported personal data or a production calculation audit.
- Restored the archived sample Goal group, which returned with two contents; the Archive list then had no rows. Completed the authenticator setup example with code `123456`. An unmatched-email report disabled Resolve and could be dismissed without actions.
- Edited an English-locale Note title, observed its locally saved title in the collection, navigated to Calendar and used browser Back to return to Notes. Opened a Goal edit sheet from Gantt while the Calendar remained behind it.
- In the HTTPS Funnel browser session, opened a Dashboard roadmap step and observed the shared Milestone detail panel. In Calendar/Gantt, `Alt+ArrowRight` moved the selected Goal bar from `266px` to `304px` at the day zoom. Revisited the final mobile Goal tree at **390×844** and observed a **390 px** document scroll width after the row-spacing adjustment.
- Both the local and HTTPS Funnel preview endpoints returned **HTTP 200**. Funnel points at `http://127.0.0.1:3000`; only the Next.js frontend was started for this pass, with Fast Refresh enabled. No API, database or worker was launched by this UI work.

Ignored artifacts under `output/playwright/` include `full-goals-desktop.png`, `full-roadmap-desktop.png`, `full-calendar-desktop.png`, `full-gantt-desktop.png`, `full-calendar-goal-sheet.png`, `full-habits-desktop.png`, `full-notes-desktop.png`, `full-note-editor-desktop.png`, `full-reviews-desktop.png`, `full-dashboard-desktop.png`, settings/report/admin captures, matching `full-*-mobile.png` captures, `full-appearance-mobile-dark.png`, `full-assistant-mobile-dark.png` and `full-assistant-proposal.png`. Some captures precede later spacing/data refinements; they are review artifacts, not a frozen visual-regression baseline.

## Acceptance and integration limits

### Baseline alignment follow-up

The user rejected the combined preview because its layout and interactions diverge from the retained application. Presence of every cluster is not acceptance. The next UI pass uses the PHP templates, browser modules and retained guide captures as the reference, preserving the existing synthetic dataset and deferred backend/tests boundary.

1. Restore the shared composition: move preview controls into an optional topbar popover, preserve the original sidebar/settings destinations and circular assistant launcher. Verify the page begins with its own content at desktop and phone widths.
2. Restore Goals: illustrated Main goal card with title picker, description, importance and progress; collapsed Area disclosure with counts/average progress; independent child disclosure and Expand all. Verify focus changes still reach Dashboard and editing stays on the originating page.
3. Restore Roadmap: original header actions and context; Goal information in a centered dialog with Strategy/Related sections; Milestone selection replaces the fishbone with an in-page focus panel and finite/recurring tabs, with Back to roadmap. Preserve draft/discard guards, prerequisite context and floating editors. Verify these local flows in a real browser.
4. Compare the remaining cluster layouts and entry/return behavior against their own templates and guide captures, record unresolved differences, and correct the next concrete discrepancies without treating a mock screen as parity. Keep all migration issues open for user acceptance. No automated tests, build/type check or backend integration in this pass.

The follow-up restores these source-based structures:

- Goals uses the illustrated focus card, collapsed Area summaries, independent child disclosure, Expand all and the retained deadline-ordered vertical Timeline. The former date-range bar chart was a preview divergence. Goal/Area/Milestone/Habit icon actions now use a compact palette/catalogue popover; separate Edit actions retain their forms.
- Roadmap keeps its contextual header, paged fishbone and centered Goal information dialog with collapsible Strategy/Related work/Notes. Selecting a Milestone replaces the map with an in-page focus section. Finite/recurring work are separate tabs, with Back to roadmap. The selected Milestone is part of the preview URL/history; editing a Task keeps that page behind its side sheet.
- Notes restores the left collection/tag column, search/order/layout controls, Pinned/Other groups and a centered continuous editor over the collection. It fills the phone viewport. Previews reuse the retained checklist-text parser. Notes-local tag management and text-size controls are included; local autosave and existing file/share/password examples remain available.
- Calendar places navigation, Goal filter and view switch in its main panel, alongside separate selected-day/unscheduled cards. On phones, month cells show date/dots and week view stacks its days. Existing floating editors and drag/Gantt controls remain; ordinary calendar chips also expose Alt-arrow moves.
- Habits restores the streak/quote summary and compact rows with seven recent days plus the three-day rest window. Daily check-in and secondary rest/archive controls remain distinct. The retained plant/trophy raster regions and SVG symbol sprite are reused.
- Reviews restores the period-filtered collection, snapshot metrics/day bars/facts, four reflection fields, explicit refresh/save, Finalize/Reopen and period navigation. New snapshots exclude recurring occurrences from the finite Task denominator. Activity remains on Dashboard. Appearance restores Themes versus Scenery/quote tabs, the personal image/color tile/dialog, immediate theme/mode selection and explicit quote saving; other settings retain their account header and original panel widths.

Additional rendered observations at **1280×720** and **390×844**: selecting an Area icon did not expand its disclosure; Expand all opened all three sample Areas. Notes had a 390 px page width and a **390×844** editor dialog. A Habit checkbox changed from false to true. A new weekly Review accepted a reflection, made it read-only on Finalize, and retained it after Reopen; its synthetic snapshot displayed 9 actions, 1/4 finite Tasks, and 5 completed-work facts in that browser session. Selecting Forest and Dark changed the document theme immediately, and quote saving retained the entered text. The Milestone focus opened with no modal dialog; Task editing preserved its URL; Back to roadmap and browser Back returned to the expected map/focus contexts. These observations are browser operation/visual-review evidence, not automated-test or production acceptance.

Reopened the revised Notes UI over HTTPS Funnel, changed its sample title and closed/reopened its editor; the edited title remained available. The final compact Habit view had ten day controls per row and a 390 px document width at the phone viewport. No real account or stored personal record was involved.

Ignored follow-up captures use the `output/playwright/baseline-*.png` prefix, including Goals, Roadmap, Goal information, Milestone focus, Notes/editor, Calendar mobile, Habits, Review and Appearance. Captures may precede later spacing adjustments.

Remaining UI comparison work includes the full Goal tags/contribution-management surface, all Notes invitation/search-highlight/card metadata details, cross-module tag-manager behavior, modified-click/new-tab navigation, and the complete confirmation/keyboard matrix. Earlier Review fixtures without detailed snapshot facts display `—` for unavailable metrics until explicitly refreshed. The preview still does not establish pixel-by-pixel or complete interaction parity across every cluster.

Every remaining listed cluster has a reviewable screen and local interactions. The user subsequently accepted the UI provisionally and authorized integration; full baseline parity remains pending. The open issues stay In progress until each cluster is connected and verified.

- No automated tests, production build, type check, database operation, account mutation, mail delivery, scheduler materialization, live provider call or deployment was performed in this pass. Prior evidence for the connected runtime is separate.
- Offline mode is an in-memory queue example; there is no IndexedDB/PWA synchronization in this preview. Uploaded files/images are object URLs in browser memory. Reload resets the entire sample session.
- Passwords/MFA/email verification and moderation are presentation flows only. Authenticator setup uses an illustrative key rather than provisioning a real TOTP identity. The personal/admin toolbar is a review switch, not authorization.
- Assistant replies are canned. The examples apply only a today/week Task selection or a new Task, after explicit confirmation and sample source-snapshot comparison. The production tool catalogue, retrieval/streaming and arbitrary roadmap/Habit/Note mutations are not integrated.
- Retained guide screenshots show the earlier interface and are labelled accordingly. Teamwork is permanently removed; live collaborative editing remains excluded from V1. Calendar date examples, recurrence, weekly streaks, graph transitions, permanent-delete closure and every accessibility/keyboard edge still require the later isolated behavioral verification phase.
