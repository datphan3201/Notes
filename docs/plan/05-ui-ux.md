# UI and Interaction Contract

## Design direction

The approved whole-application redesign uses the existing custom CSS, Noto Sans, PHP views, and JavaScript modules. The application language remains English throughout. Notes keeps its editor, autosave, filters, recovery, and attachment behavior while adopting the shared visual system.

### Workspace redesign (2026-09-18)

- Palette: paper `#ffffff`, mist `#f6f8fa`, ink `#22313d`, slate `#647480`, ocean `#216e80`, and pale ocean `#e8f2f5`. Dark mode uses the same semantic tokens with dark surfaces and accessible lighter foregrounds. GitHub Activity greens remain independent.
- Typography: Noto Sans throughout; 30px page titles, 16px section titles, 14px body, and 12px supporting text. Headings and content align left. Sentence case replaces decorative uppercase labels.
- Layout: a 224px sidebar and a slim persistent page bar frame a maximum 1200px workspace. Navigation uses consistent local SVG line icons. Active detail pages also highlight their parent section.
- Dashboard: today's work is the primary column; the compact monthly contribution calendar and Habits sit in a supporting column. Weekly Tasks and Milestones share a lower planning section. Counts come only from the existing response; empty states provide real destination links.
- Collection screens put the existing list before creation controls, with a narrower creation column. Goals keeps Areas configurable and its hierarchy visible. Detail screens separate outcomes, checklist, notes, and relationships. Settings and authentication use the same controls and type scale.
- Mobile navigation works on every authenticated page, not just Notes. Opening it moves focus inside, traps focus, makes the background inert, supports Escape, and returns focus to its trigger. Desktop resize clears mobile-only state.
- Dashboard refresh/month controls cannot issue overlapping requests. Loading and recoverable errors are explicit; stale errors clear after a successful retry. Activity day tooltips render outside the scrolling calendar so they are not clipped.
- No fabricated data, placeholder controls, remote fonts, extra frontend framework, or API/schema change is part of this visual redesign.

Desktop layout:

```text
Navigation | Page bar
           | Title + relevant actions
           | Today's work        | Monthly activity
           | Overdue             | Goal-related habits
           | This week's tasks   | This week's milestones
```

## Information architecture

Primary navigation:

- Dashboard
- Goals
- Tasks
- Habits
- Reviews
- Notes
- AI assistant
- Account settings

Areas appear inside Goals rather than as a separate application. Tags are managed from relevant filters/settings.

## Screen behavior

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

- Disable duplicate submission while a request is pending, but recover after failure.
- Preserve entered values and show field errors after 422.
- On 409, show current server state and require refresh/retry; never silently overwrite.
- On 401/419, preserve local drafts and offer reauthentication.
- Confirmation dialogs name the affected object, trap focus, support Escape, restore focus, and describe irreversible consequences.
- Archived items are absent from active lists and visibly marked in historical views.
- No fake controls for deferred features.

## Responsive/accessibility requirements

Support 360×800, 768×1024, and 1440×900 without significant horizontal overflow. Use minimum 44px touch targets where practical, visible focus, semantic headings/landmarks, labeled controls, `aria-live` for async status, and reduced-motion preferences. Do not convey status using color alone. Preserve literal user text; do not render Note/description HTML.
