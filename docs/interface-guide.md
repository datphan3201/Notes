# Using Planner

Start the application using [the hosting and startup runbook](hosting.md), then register or sign in with your own account. Authentication and all planning data stay on the same application origin.

## Find your way around

The sidebar contains Dashboard, Goals, Tasks, Habits, Notes, Reviews, and AI assistant. Your name in the sidebar footer opens Profile. Account settings then show Profile, Appearance, and Password; the top-right Appearance icon also opens theme settings. On a phone or tablet, use the menu button in the top bar. Escape closes the menu, and keyboard focus returns to the button. Detail pages keep the relevant sidebar section selected.

Use Appearance to switch between light and dark themes. This also controls note text size, the default color for new notes, and grid/list layout. The appearance icon in the top bar opens the same settings page.

## Open the illustrated guide

Choose **?** beside Appearance in the top bar to open the walkthrough from any
authenticated page. Its 33 steps cover every current browser feature, including
save behavior, completion rules, Notes recovery, recurrence, Reviews, and AI
approval. Use **Choose a topic** to jump directly to a subject, or **Back/Next**
to read in order. Images are explicitly labeled placeholders until the final
interface is agreed; the instructions describe the current app.

The introduction opens automatically for accounts that have not dismissed it,
including existing accounts on their first visit after this feature is installed.
**Skip guide**, **Close**, **Escape**, and **Finish** remember the same choice
across browsers/devices. **?** remains available afterward. If remembering the
choice fails, retry or use **Close for now**; only the latter can allow another
automatic introduction later. Notes recovery and already-started work take
priority, and the guide never stacks over an existing dialog.

The walkthrough does not navigate away from the current object or alter its
drafts. Tab/Shift+Tab stays inside the guide, and closing returns focus to **?**.
On mobile, navigation controls stay visible while only the selected step scrolls
when its content requires it.

## Plan your work

- **Goals:** choose **New goal** to capture a name in an Area. Optional outcome/criteria are available under **Add details**. Create a goal in an Area and describe the desired outcome and completion criteria. Open **Manage areas** to rename the defaults or **Add area**. Switch **Areas/Timeline**, use **Expand all**, or open the main Goal preview. Open a Goal to see its roadmap. Select the named Goal head to read its information and reveal **Edit goal**, **Strategy**, or **Related work** as needed.
- **Tasks:** capture a task in the Inbox or optionally choose an existing Goal/Milestone. Suggested text remains editable. **Today**, **Next**, **This week**, **Backlog**, and **All** filter existing dates/schedules/selections; **All** includes overdue work. **Filter and search** displays its current status filter and opens name/status controls; pages show eight tasks on desktop and four on mobile. Open a task and select **Overview** for its criteria/checklist/estimate and compact working Note, **Notes** for the same editor in a focused view, or **Related work** for contributing Goals. Notes switches **Write/Resources**; Resources recognizes HTTP links already in the note. **Edit task** saves versioned name/description/outcome/criteria, optional minutes (1–1440), importance/status, dates and UTC scheduling. A context link returns to its Goal or Milestone when assigned. **Select for week** adds it to the Dashboard's weekly selection. Completing a task does not automatically check its checklist items.
- **Habits:** choose daily (one target day) or weekly (1–7 target days). **Check in today/Undo today** is primary; dated dots also record or undo the preceding six days. Each Habit shows its own timezone and current-period count. The aggregate streak counts distinct consecutive recorded local dates across Habits, with yesterday grace. Choose **Check-ins** or **Recurring tasks**. Use **New habit** or **New recurring task** in the relevant section; preview recurring dates before creation.

**Roadmap** uses a fishbone diagram: six Milestone cards connect to a shared spine leading to a head labeled with the actual Goal name, progress and state. Desktop runs left to right; narrower screens use a vertical spine ending at the named Goal. Select the named Goal head to read its saved description, outcome, criteria, progress/state, importance and deadline. Cards show names, Task counts and progress. Select a Milestone to see its Tasks, add a Task beneath it, complete/reopen work, or select it for the week. **Back to roadmap** returns to the overview. Each Milestone keeps its own unsaved Task creation draft while you switch branches. Previous/Next milestones opens further pages without expanding the canvas. Branch positions express membership, not prerequisites.

Inside the Goal information dialog, use **Strategy** for learning methods and principles that apply throughout the roadmap. Save explicitly; these notes do not affect progress. **Edit goal** edits the desired outcome and completion criteria. **Related work** lets you choose child Goals, direct Tasks, recurring work, Habits, or contributions. Recurring Tasks appear separately and are excluded from finite progress.

Reopening a finite Task or Milestone beneath completed Goals asks you to confirm the affected Goals. Cancelling changes nothing; confirming reopens them together. Adding finite work beneath a completed Goal requires reopening it first. Active recurring series continue to generate Tasks without reopening Goals.

The Dashboard selects **Today**, **This week**, or **Activity**. Today shows due/start/occurrence dates and overlapping schedules, overdue work, a weekly summary, current focus, a Habit streak, and a compact roadmap. This week shows selected tasks/milestones and Goal-related Habits. Current focus uses ✎ Edit (20%) and ✓ Complete (80%), including normal checklist acknowledgement. Task rows open the task; milestone rows open their focused component in the parent goal. Empty states link to the relevant page so you can start planning.

## Read the activity calendar

The calendar covers one month. Weeks are columns and days run from Sunday to Saturday. Use the previous/next controls to browse; the next button stops at the current month. Hover over a day or focus it with the keyboard for its full date and completion breakdown.

The five colors mean 0, 1, 2–3, 4–6, or 7+ unreversed completions. Tasks, checklist items, habit check-ins, and milestones count. Creating an item or editing a note does not count. The total is a count of completions, not a productivity score. The Dashboard displays the account timezone used for its dates.

## Keep notes and reflect

**Notes** supports search, tags, colors, pinning, attachments, and grid/list views. Use **Manage tags** on mobile. Enter a title and content, then wait for **Saved** before treating the current revision as acknowledged. New note creation becomes available after the initial data and recovery check finish. If an older unsaved draft exists, choose whether to recover or discard it.

**Reviews** captures facts for a daily, weekly, or monthly period. Use **New review**, then open a review in its focused editor. Select a reflection section, expand facts when needed, and use **Back to reviews** to return without losing drafts. Save reflections before finalizing. Actions, completion, wins, and daily bars use the selected saved snapshot. Completion counts finite Tasks due in that period plus selected Tasks for Weekly Reviews, at fact capture. Old snapshots without the denominator show — until explicit **Refresh facts**. Arrows open existing reviews of the same kind, preserving drafts. Facts refresh preserves unsaved text; finalized reviews remain read-only until explicit Reopen.

**AI assistant** sends only the context you select after consent. Generated proposals remain suggestions until you review and apply them. Availability depends on the server's AI configuration; see the [AI contract](plan/13-ai-contract.md).

## When a request fails

Read the visible error before retrying. Dashboard **Refresh** retries the request and clears the error on success. Month controls are disabled while a Dashboard request is in progress. Notes has its own autosave/recovery behavior; do not discard a draft unless you intend to lose those unsaved edits.

Closing Goal information retains drafts and returns focus to the named head. Its title and Close action stay visible while a long form scrolls. Pending saves block dismissal. Goal **Refresh** preserves unsaved Strategy and Goal details. If another save changes the Goal version, choose **Use saved version** or **Keep my draft**. Keeping the draft requires another explicit Save. Text typed while a save is pending remains unsaved until its own acknowledgement. Leaving with pending or unsaved edits asks for confirmation.

Creation dialogs retain their fields when closed. Escape returns focus to the opener; dismissal waits for a pending creation. The optional details remain available without blocking a quick capture. Task Notes use explicit **Save note**, preserve newer typing when a save returns, and retain drafts across checklist changes. Task Note and Review version conflicts require an explicit saved-version/draft choice. Leaving the page with unsaved text asks for confirmation; drafts are not a promise of recovery after a browser crash.

Generated screenshots and comparison galleries were removed during repository cleanup. Bundled theme, reference and walkthrough images remain part of the application.

For installation, backups, migration, and deployment, see the [operations contract](plan/15-operations.md). For the relationships and completion rules, see the [domain contract](plan/10-domain-contract.md).

## Illustrated appearance

**Themes** offers Mountain journey, Forest, Ocean, Pisces · Song Ngư, and Starry sky, independently of Light/Dark. **Scenery and quote** independently toggles page background, card/roadmap illustrations, and the quote card. All scenery is supplied by Planner; theme upload is unavailable. Enter a private quote and choose **Save quote**, or **Restore preset** to use the selected theme’s text. Theme/toggle changes save immediately; quote typing waits for explicit Save. Saves are serialized and newer quote typing stays unsaved until acknowledged. **Note preferences** holds the existing text size, default color, and library layout controls.
