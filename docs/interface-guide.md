# Using Planner

Start the application using [Readme.txt](../Readme.txt), then register or sign in with your own account. Authentication and all planning data stay on the same application origin.

## Find your way around

The sidebar contains Dashboard, Goals, Tasks, Habits, Notes, Reviews, and AI assistant. Profile, Appearance, and Password are in the Account section. On a phone or tablet, use the menu button in the top bar. Escape closes the menu, and keyboard focus returns to the button. Detail pages keep the relevant sidebar section selected.

Use Appearance to switch between light and dark themes. This also controls note text size, the default color for new notes, and grid/list layout. The appearance icon in the top bar opens the same settings page.

## Plan your work

- **Goals:** create a goal in an Area and describe the desired outcome and completion criteria. Expand **Organize your areas** to rename the neutral defaults. Open a goal to see its child goals, milestones, tasks, habits, and contributions.
- **Tasks:** add an actionable item to the inbox. Open it to work with its checklist, completion criteria, and working notes. **Select for week** adds it to the Dashboard's weekly selection. Completing a task does not automatically check its checklist items.
- **Habits:** choose a daily or weekly frequency and check in for today. Undo reverses that check-in. Recurring task creation and existing task series are shown separately below the habit controls.

The Dashboard shows today's scheduled/due tasks, overdue work, selected weekly tasks and milestones, and habits linked to goals. Task rows open the task; milestone rows open their parent goal. Empty states link to the relevant page so you can start planning.

## Read the activity calendar

The calendar covers one month. Weeks are columns and days run from Sunday to Saturday. Use the previous/next controls to browse; the next button stops at the current month. Hover over a day or focus it with the keyboard for its full date and completion breakdown.

The five colors mean 0, 1, 2–3, 4–6, or 7+ unreversed completions. Tasks, checklist items, habit check-ins, and milestones count. Creating an item or editing a note does not count. The total is a count of completions, not a productivity score. The Dashboard displays the account timezone used for its dates.

## Keep notes and reflect

**Notes** supports search, tags, colors, pinning, attachments, and grid/list views. Use **Manage tags** on mobile. Enter a title and content, then wait for **Saved** before treating the current revision as acknowledged. New note creation becomes available after the initial data and recovery check finish. If an older unsaved draft exists, choose whether to recover or discard it.

**Reviews** captures facts for a daily, weekly, or monthly period. Write your reflections, save them, and finalize when ready. Reopen explicitly to edit a finalized review.

**AI assistant** sends only the context you select after consent. Generated proposals remain suggestions until you review and apply them. Availability depends on the server's AI configuration; see the [AI contract](plan/13-ai-contract.md).

## When a request fails

Read the visible error before retrying. Dashboard **Refresh** retries the request and clears the error on success. Month controls are disabled while a Dashboard request is in progress. Notes has its own autosave/recovery behavior; do not discard a draft unless you intend to lose those unsaved edits.

For installation, backups, migration, and deployment, see the [operations contract](plan/15-operations.md). For the relationships and completion rules, see the [domain contract](plan/10-domain-contract.md).
