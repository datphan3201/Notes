# UI and Interaction Contract

## Design direction

The approved whole-application redesign uses the existing custom CSS, Noto Sans, PHP views, and JavaScript modules. The application language remains English throughout. Notes keeps its editor, autosave, filters, recovery, and attachment behavior while adopting the shared visual system.

### Current visual and interaction baseline

Use the approved illustrated reference and graphic contract below. Noto Sans,
semantic light/dark tokens, local icons and the existing responsive shell are
shared across the app. Collection creation is contextual; unrelated Dashboard
functions use selectable modes rather than one long scrolling surface.

Mobile navigation moves focus inside, traps focus, makes the background inert,
supports Escape and returns focus to its trigger. Desktop resize clears mobile
state. Dashboard reads are serialized, loading/errors are visible, successful
retries clear errors, and Activity tooltips stay outside the scrolling calendar.
Only factual data is displayed; no fabricated metrics or inactive controls.

## Information architecture

Primary navigation:

- Dashboard
- Goals
- Tasks
- Habits
- Notes
- Reviews
- AI assistant
- Account settings

Areas appear inside Goals rather than as a separate application. Tags are managed from relevant filters/settings.

## Progressive disclosure and scrolling (2026-10-07)

The user's approved design requirement is to minimize unnecessary scrolling.
Show the content and controls needed for the current task, then reveal optional
details or navigate to another component when requested. Scrolling is justified
by the selected content itself, such as a long Note, Review, Strategy, or a
necessary list; it must not be the way to discover an unrelated function.
Content needed for a meaningful comparison may remain visible together.

Choose the interaction according to the user's purpose:

| Purpose | Preferred interaction |
| --- | --- |
| Switch modes within one workspace or entity | Tabs or a section menu displaying one component at a time |
| Create, rename, or make a short edit | A dialog or drawer opened by an explicit action; use a full-screen presentation on mobile when needed |
| Read optional information related to the current task | An expandable detail section or contextual popover; keep the main action visible |
| Write or inspect substantial content | A focused component or dedicated page with a clear return path |
| Find an item in a large collection | Search, filters, and suitable pagination/grouping rather than an unbounded mixed-content page |

Creation forms open when requested rather than occupying a permanent column
beside an existing collection. First-use onboarding may expose a concise form
when creating the first item is the current task. Selecting an existing Review
opens its focused editor instead of appending it beneath collection/create
controls. Habits and recurring Task management are separate modes; Task working
Notes can open independently of its Checklist. Dashboard time horizons and
historical Activity use explicit modes where they are not being compared.

Keep headers, repeated entity summaries, explanatory copy, and empty states
compact so the initial viewport exposes useful work. Do not shrink text,
truncate essential information, or clip content to force everything into one
viewport. Controls for switching modes and saving remain reachable during
necessary long-content scrolling. Prefer one main scroll surface for the active
component; avoid multiple nested scrolling cards or stacked dialogs.

Navigation preserves the selected item, filters, drafts, and focus when
returning. Dialogs/drawers have a clear close action, keyboard focus containment,
Escape handling, and focus restoration. Closing or navigating must preserve
unsaved edits or request an explicit discard decision. Long editing flows must
not be confined to small popups solely to reduce page height.

These are target interaction requirements. Screen-by-screen implementation
and actual verification are recorded in `docs/implementation-status.md`; this
contract does not imply that every existing screen already follows them.

### Interaction layout implementation target (2026-10-07)

Dashboard selects Today, This week, or Activity; Today groups scheduled/overdue
work; goal-related Habits are now in This week, beside weekly selections. Goals and
Tasks use explicit New dialogs instead of permanent creation columns. Tasks
have name search, status filtering, and bounded client-side pages. After capture,
show the page containing the created task; collection refresh must not block the
next capture or let obsolete responses overwrite a newer list. Goals retain
Area organization as a separate dialog. Habits selects Check-ins or Recurring
tasks, with creation dialogs in each mode. Task detail selects Overview, Notes, or Related work and links back to its existing primary Goal/Milestone context. Optional creation details do not block capture. Task pages show eight rows on desktop and four on mobile.
Review selection replaces its collection with a focused editor and a Back
control; reflections use one selected section at a time. Facts refresh and
checklist changes preserve unsaved text. Review finalization requires saved
reflections. A stale finalized Review follows the existing 422 status contract; the browser reads the latest version and offers explicit reconciliation, retaining a chosen local draft through Reopen. Short creation dialogs retain input on close, prevent dismissal
while saving, and restore trigger focus. Legacy creation hashes still open the
relevant dialog. Email verification remains visible in the account navigation
and on Profile rather than taking up every planning page's first viewport.

## Screen behavior

### Approved illustrated reference — 2026-10-07

Use the bundled `frontend/src/images/reference/UI.png` as the visual reference while preserving current
navigation, ownership, save/draft behavior, and roadmap domain rules. Reuse the
Noto Sans family, semantic controls, focus styles, and one selected content
section at a time. Light defaults: icy blue canvas #f3f7ff, white surfaces,
navy text #142849, teal action #067287, green completion graphics #12a77e
with darker green text #087e5e, and pale context chips. Muted text #55708e
and control borders #7a91ab preserve readability on the light canvas.
Dark uses readable navy/slate surfaces. Decorative scenery stays behind clear
content and is independently disableable. No image may carry essential text.

Dashboard's overview displays a weekly summary, one current Task, a Habit streak,
a compact roadmap preview, and Today/Needs attention. These compare current
focus/context; longer weekly lists and Activity remain selectable sections.
Current Task prioritizes an unfinished weekly selection, then Today, then overdue;
blocked work is not promoted as the recommended next Task. Edit uses an icon in
20% of the action row; the remaining 80% is Complete. It uses the same Checklist
and ancestor acknowledgement flow as other Task controls.

Tasks adds Today, Next, This week, Backlog, and All filters with factual counts.
Today uses local due/start/occurrence dates or a schedule overlapping today;
Next uses future start/deadline/occurrence/scheduled dates; This week uses existing
selections; Backlog has no date/schedule and is not selected. Filters can overlap;
they are not status changes. Search/status remain available under Filter.
Task edit exposes existing name/description/outcome/criteria/status/importance,
dates/schedule and optional estimate with explicit Save and version conflicts.
Related work displays existing contribution links; Resources in Task Notes is a
focused view of URLs written in that note, not a second storage system.

Goals offers a main-Goal preview (highest importance, stable order), Areas and
deadline Timeline views, Expand/collapse all and Add area in Manage areas.
Area progress averages its unarchived root Goal percentages and states that meaning.
Timeline only uses actual deadlines, marking unscheduled Goals separately.
Creation dialogs allow contextual Goal/Milestone selection and optional template
text suggestions without forcing more decisions at capture time.

Habits shows the aggregate streak and seven recent days plus per-Habit current
period progress. Daily has target 1; weekly 1–7. Check-in today/Undo stays primary;
past-day dots permit explicitly backdating/undoing with each Habit's timezone,
never future dates. Reviews shows selected snapshot actions, completion, wins,
and factual daily bars, with previous/next existing-period navigation.

Appearance selects one of five bundled themes (Mountain journey, Forest, Ocean,
Pisces, Starry sky), separate Light/Dark, three visibility switches, and an
optional personal quote with explicit Save/Restore preset. Theme selection is
account-persisted. Settings sections use the existing tab convention so unrelated
settings do not become one long canvas. Notes/AI/auth retain their functional
contracts and adopt the shared visual system. Update the walkthrough to reflect
the shipped controls and explain each metric rather than copy reference numbers.

### Reference fidelity correction — 2026-10-07

`Downloads/UI.png` is now the authoritative visual source (identical to the
previous `interface.png`). Preserve its graphic detail rather than substitute
another illustration style: landscape header, flagged summit, foreground hiker,
layered mountain foothills, quote plant, circular Goal anchor, colored milestone
icons, offset double frames, arrowed relationship paths, focus accent stripe,
and compact card rhythm. The reference shows six milestone cards per desktop
view; reuse existing roadmap pagination for additional milestones. Cards show
name, task counts and progress; the Task Overview has the reference’s three
columns with description/context/estimate, Checklist, and one shared Note editor
that also occupies the focused Notes tab. Outcome and raw criteria remain under
a labeled expandable section; completion Checklist/acknowledgements remain visible.
Normal Goals removes the redundant inner heading; its existing Retry control
is visible alongside a failed load. Planning sidebar matches the reference; Profile opens from the existing user
footer, with Account navigation retained in account settings. Selecting a
Milestone reveals its Task component. Bundle the supplied raster unchanged and use SVG
viewports to display its decoration-only regions; do not expose screenshot text
or fake UI as an interactive element. Normal text/actions/state remain semantic
HTML and use actual data. Mountain uses these original graphics; the other four
themes preserve the same decorative layout with their approved imagery. Existing
visibility preferences control the layers. Preserve all previously approved
behavior changes, including Edit/Complete instead of Start focus and the actual
Goal hierarchy (connector arrows signify membership, not invented prerequisites).
Review summary metrics remain on one horizontal row where the desktop content
width permits, with a compact, vertically resizable reflection editor. Short
Task-create viewports retain accessible form scrolling; the form uses the wider
reference proportions rather than an unnecessarily narrow desktop column.

### Illustrated walkthrough

Help (`?`) sits beside Appearance in the authenticated top bar on every page.
Use a native dialog with one illustrated step, a labeled topic selector grouped
by existing product area, step count, Back, Next, Skip/Close, and Finish. Cover
all existing browser features and their save/state semantics; do not advertise
API-only or deferred controls. Illustrations are bundled, visibly labeled
placeholders that can be replaced independently of the copy.

Accounts with no dismissal see the introduction on their first authenticated
visit after this feature is installed (including registration's automatic
sign-in). Await Notes initialization/recovery before opening. Defer automatic
opening when the user already interacted, has a recoverable Note, or another
dialog/navigation drawer is open. Do not stack dialogs or navigate away from
current work. Selecting topics and steps never changes user content.

Skip, Close, Escape, and Finish persist the same account-wide dismissal; the
Help button remains available afterward. Disable duplicate dismissal while
saving. On failure retain the guide, explain retry, and offer Close for now
without falsely claiming the state was saved. Restore focus to Help when closed.
The dialog uses the existing palette/type/control conventions, keyboard focus
containment and visible focus, a single content scroll surface only when needed,
and a full-screen mobile presentation with navigation controls kept available.

### Dashboard

Show a GitHub-style monthly Activity calendar, Today/Overdue Tasks, selected weekly Tasks, selected weekly Milestones, and Goal-related Habits. The calendar keeps the bounded monthly API but presents weeks as columns and Sunday through Saturday as rows, with month navigation, weekday labels, a contribution summary, an intensity legend, and factual hover/focus tooltips. Visual levels are derived from the day's active completion count using the fixed thresholds 0, 1, 2–3, 4–6, and 7+; this is a display scale, not a productivity score. Each widget has loading, empty, failure/retry, and content states. Day cells are keyboard focusable and expose the full date, total, and per-type factual counts without relying on color alone. On narrow screens the calendar scrolls horizontally instead of shrinking cells below a usable visual size.

### Goals

Render Areas and a lazily expanded Goal tree. On first planning use, show the
three neutral placeholder Areas with inline rename guidance; never suggest that
their names are permanent categories. Use breadcrumbs on detail pages. Move is
an explicit destination picker; do not implement drag-only hierarchy. Detail
shows description, expected result, completion criteria, calculated progress
breakdown, direct Goals/Milestones/Tasks/Habits, Tags, contributions, and
archive/completion actions.

### Goal roadmap (2026-10-07)

Roadmap is the primary Goal detail surface. Selecting its named Goal head opens
one native Goal-information dialog, replacing the former Goal section tabs.
The dialog initially shows saved description, outcome, criteria, progress/state,
importance and deadline. Edit goal, Strategy and Related work use grouped native
disclosures, revealing one section at a time without clearing drafts. Closing
retains drafts and returns focus to the current Goal head. The dialog header
keeps the Goal context and Close action available during long-form scrolling; pending saves block
dismissal. A version-conflict dialog temporarily replaces the information dialog
and returns to the original form after reconciliation. Completed Goals remain
inspectable. Milestone focus, paging and the existing related-kind selector stay
available; no domain relationship or HTTP contract changes.

The approved fishbone follow-up replaces the radial connectors: a common spine
leads to a Goal head displaying the actual Goal name, progress and existing
status. Six Milestone cards attach by diagonal ribs above/below the horizontal
desktop spine. At narrower widths, the spine is vertical, paired cards attach
from either side and the named Goal head sits below them. Decoration, card
styling and paging remain; no horizontal page scrolling is required. The spine
and ribs express membership only, not prerequisites or a new causal model.
Task previews remain available in the selected Milestone component. Selecting a Milestone
switches to its focused Task component with a return-to-roadmap control.
Recurring Tasks are labeled separately from finite Tasks. Each Milestone can
create Tasks directly beneath itself. Direct Tasks and child Goals remain
available outside these branches. Dependencies are displayed as explicit
prerequisite explanations and never inferred from branch position.

A separate Strategy notes editor holds the method used throughout the roadmap,
with explicit Save, unsaved/saved feedback, conflict handling, and a leave
guard. Loading or refreshing the roadmap must not overwrite a dirty strategy
draft. Goal completion/reopen controls explain the affected ancestors before
requesting confirmation. Task completion acknowledgement is never sent unless
the user has confirmed unfinished Checklist Items.

### Milestones

Show checkpoint status, completion criteria, related Goal, Task progress, prerequisites, dependents, and completion availability. An unavailable Milestone explains each prerequisite while keeping Task controls enabled. Completion with open Tasks opens a confirmation dialog.

### Tasks

Separate status, Checklist, and completion criteria visually. Show parent, importance, dates/schedule, Tags, contributions, recurrence/occurrence marker, and Note area. Structured fields use explicit save/acknowledgement; the Task Note reuses the existing autosave editor.

### Habits

Daily items expose today's check-in. Weekly items show distinct completed days against target. Backdating uses an explicit date picker; future dates are disabled and rejected by the server.

### Reviews

Period/kind picker, generated-at timestamp, summarized facts, four reflection fields, Refresh, Finalize, and Reopen. Finalized snapshots are visually read-only until explicit reopen.

### AI

The user selects context and requested capability, previews what will be sent, and consents. The result screen renders an immutable proposed operation list with Apply/Reject. Never present generated suggestions as already saved.

## Shared interaction rules

- Group content for the user's current purpose. When components are not used for comparison, prefer separate sections or a menu that displays one component at a time, instead of a single canvas containing unrelated content.
- Keep each Milestone's unsaved Task creation draft bound to that Milestone when switching branches; successful creation clears only its own draft.
- Disable duplicate submission while a request is pending, but recover after failure.
- Preserve entered values and show field errors after 422.
- On 409, show current server state and require refresh/retry; never silently overwrite.
- On 401/419, preserve local drafts and offer reauthentication.
- Confirmation dialogs name the affected object, trap focus, support Escape, restore focus, and describe irreversible consequences.
- Archived items are absent from active lists and visibly marked in historical views.
- No fake controls for deferred features.

## Responsive/accessibility requirements

Support 360×800, 768×1024, and 1440×900 without significant horizontal overflow. Use minimum 44px touch targets where practical, visible focus, semantic headings/landmarks, labeled controls, `aria-live` for async status, and reduced-motion preferences. Do not convey status using color alone. Preserve literal user text; do not render Note/description HTML.
