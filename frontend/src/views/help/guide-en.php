<header class="guide-hero">
    <p class="eyebrow">User guide</p>
    <h1>Planner turns your goals into things you can do today</h1>
    <p>This page explains what Planner is, how its parts fit together and how to do each task step by step. You don't need to read it all at once: pick a topic from the contents, follow the steps and compare with the screenshots.</p>
    <p class="guide-tip">Tip: the <strong>?</strong> button at the top right opens a short tour; this page is the full guide.</p>
</header>

<div class="guide-layout">
    <nav class="guide-toc" aria-label="Contents">
        <p class="guide-toc-title">Contents</p>
        <ol>
            <li><a href="#overview">What is Planner?</a></li>
            <li><a href="#start">Get started in 5 minutes</a></li>
            <li><a href="#screen">Find your way around</a></li>
            <li><a href="#how-it-fits">How the pieces fit together</a></li>
            <li><a href="#daily">Start your day on the Dashboard</a></li>
            <li><a href="#goals">Set goals and roadmaps</a></li>
            <li><a href="#tasks">Manage tasks</a></li>
            <li><a href="#repeating">Repeating tasks</a></li>
            <li><a href="#calendar">Plan your time on the Calendar</a></li>
            <li><a href="#habits">Build habits</a></li>
            <li><a href="#notes">Notes</a></li>
            <li><a href="#note-passwords">Lock a note with a password</a></li>
            <li><a href="#sharing">Share and edit together</a></li>
            <li><a href="#ask-ai">Ask AI about your notes</a></li>
            <li><a href="#offline">Use Planner offline</a></li>
            <li><a href="#reviews">Look back with Reviews</a></li>
            <li><a href="#teamwork">Teamwork</a></li>
            <li><a href="#assistant">The AI assistant</a></li>
            <li><a href="#notifications">Notifications and reminders</a></li>
            <li><a href="#archive">Archive and restore</a></li>
            <li><a href="#settings">Account settings</a></li>
            <li><a href="#administrators">For administrators</a></li>
            <li><a href="#faq">Frequently asked questions</a></li>
        </ol>
    </nav>

    <div class="guide-body">
        <section id="overview">
            <h2>What is Planner?</h2>
            <p><strong>Planner</strong> is a personal planning notebook on the web. It brings together things that usually live in several apps: long-term goals, everyday tasks, habits, notes, a calendar and regular look-backs.</p>
            <p>The idea is simple: <strong>a big goal only happens when it is broken into small steps you can take today.</strong> Planner helps you:</p>
            <ul>
                <li><strong>Know what to do today</strong> – the Dashboard lists today's work, the habits to keep and anything overdue.</li>
                <li><strong>See the road to a goal</strong> – every goal has a roadmap of milestones and tasks, with a progress percentage.</li>
                <li><strong>Keep habits</strong> – check in each day, watch your streak and plan rest days.</li>
                <li><strong>Keep ideas safe</strong> – notes with colours, labels, tick boxes, attachments, passwords and sharing.</li>
                <li><strong>Look back and adjust</strong> – each day, week or month, Planner gathers what you did so you can write down what went well, what didn't and what you'll change.</li>
                <li><strong>Work with others</strong> – team goals with assignments, progress and chat.</li>
                <li><strong>Ask the AI assistant</strong> – ask about your plans, have it draft a roadmap or reschedule work; nothing changes until you confirm.</li>
            </ul>
            <p>Planner is for anyone who wants to live and work with a plan: students preparing for exams, people at work, someone building a new habit or a small project team. It is available in English and Vietnamese, on computers and phones.</p>
            <?= $shot('dashboard', 'The Dashboard with the goal roadmap, today\'s task list and habits', 'The Dashboard: your main goal\'s roadmap at the top, today\'s work on the left, habits on the right.') ?>
            <p><strong>Your data is yours.</strong> Other people only see notes you choose to share and team goals they belong to. System administrators cannot read your private plans or notes either.</p>
        </section>

        <section id="start">
            <h2>Get started in 5 minutes</h2>
            <ol class="guide-steps">
                <li><strong>Create an account.</strong> On the sign-in page choose <em>Create account</em> and enter your name, email and a password (at least 10 characters). Planner emails you a verification link; open it to activate your account. No email? Use <em>Resend email</em> on the banner at the top of the page.</li>
                <li><strong>Choose your language and look.</strong> In <em>Settings → Appearance</em> switch between English and Vietnamese, light and dark, and pick a scenery.</li>
                <li><strong>Create your first goal.</strong> Open <em>Goals</em>, click <em>New goal</em>, give it a name (for example “Pass the Spanish B2 exam”), an area and a deadline.</li>
                <li><strong>Break it into milestones and tasks.</strong> Open the goal, click <em>Add milestone</em>, then add tasks to each milestone. In a hurry? Ask the AI assistant to “draft a roadmap”.</li>
                <li><strong>Plan today.</strong> On the <em>Dashboard</em>, click <em>Add task</em> to pick today's work. When something is done, click the circle in front of it.</li>
            </ol>
            <p>That is enough to get going. The sections below explain each feature in more detail when you need it.</p>
        </section>

        <section id="screen">
            <h2>Find your way around</h2>
            <ul>
                <li><strong>The left sidebar</strong> opens the main pages: Dashboard, Goals, Tasks, Calendar, Habits, Notes, Reviews and Teamwork. At the bottom are your name, <em>Settings</em> (the gear) and sign out.</li>
                <li><strong>At the top right</strong> are the notification bell (a red number means unread items), the <strong>?</strong> tour and a quick light/dark switch.</li>
                <li><strong>The sparkle button at the bottom right</strong> opens the AI assistant on every page.</li>
                <li><em>New task</em> at the top of several pages captures a task immediately.</li>
                <li>Clicking the name of a task, milestone or goal opens a <strong>quick editor</strong> on the right without leaving the page. For everything, click <em>Open full page</em>.</li>
            </ul>
            <p><strong>On a phone</strong> the sidebar folds into the menu button (three lines) at the top left; every feature is still there.</p>
            <div class="guide-phones">
                <?= $phone('phone-dashboard', 'The Dashboard on a phone') ?>
                <?= $phone('phone-menu', 'The navigation menu open on a phone') ?>
            </div>
        </section>

        <section id="how-it-fits">
            <h2>How the pieces fit together</h2>
            <p>Knowing this helps you use Planner the way it is meant to work. Personal plans have four levels, from big to small:</p>
            <div class="guide-hierarchy" role="img" aria-label="Areas contain goals, goals contain milestones, milestones contain tasks">
                <span>Area</span><span aria-hidden="true">→</span><span>Goal</span><span aria-hidden="true">→</span><span>Milestone</span><span aria-hidden="true">→</span><span>Task</span>
            </div>
            <div class="guide-table-wrap">
                <table class="guide-table">
                    <thead>
                        <tr><th scope="col">Item</th><th scope="col">What it is</th><th scope="col">Where it lives</th><th scope="col">Rules to remember</th></tr>
                    </thead>
                    <tbody>
                        <tr><th scope="row">Area</th><td>A big part of life: Learning, Health, Work…</td><td>The top level</td><td>Up to 4 active areas. The last area, or an area that still has goals, cannot be archived.</td></tr>
                        <tr><th scope="row">Goal</th><td>An outcome you want, such as “Run a half marathon”.</td><td>In an area, or as a sub-goal of another goal</td><td>Progress is calculated from finished milestones, finished tasks directly in the goal and sub-goals. Reaching 100% does <em>not</em> complete it: click <em>Complete goal</em> when you have really got there.</td></tr>
                        <tr><th scope="row">Milestone</th><td>A stage on the way to a goal.</td><td>In exactly one goal</td><td>Can require an earlier milestone to be completed first. Its tasks can still be worked on.</td></tr>
                        <tr><th scope="row">Task</th><td>One concrete action, such as “Do two listening papers”.</td><td>In a milestone, directly in a goal, or in the <em>Inbox</em></td><td>Each task lives in <strong>one</strong> place. To change that, move it; there is no need to delete and recreate it.</td></tr>
                        <tr><th scope="row">Repeating task</th><td>A pattern that creates tasks on a schedule (daily, every Monday…).</td><td>Like an ordinary task</td><td>Each occurrence is a separate task; occurrences don't count towards goal progress.</td></tr>
                        <tr><th scope="row">Habit</th><td>Something you want to keep doing (reading, running).</td><td>On its own; can be linked to a goal as a reminder of why</td><td>At most one check-in per day; habits don't count towards goal progress.</td></tr>
                        <tr><th scope="row">Note</th><td>Free text: ideas, study material, lists.</td><td>On its own; can be linked to one goal <em>or</em> one task</td><td>Has labels, colours, its own password and can be shared. Deleting a note removes it for good.</td></tr>
                        <tr><th scope="row">Calendar</th><td>A day-by-day view, not a separate store.</td><td>Shows the dates of tasks, milestones and goals</td><td>Dragging an item to another day changes that item's own dates.</td></tr>
                        <tr><th scope="row">Review</th><td>A summary of a day, week or month with your reflections.</td><td>On its own</td><td>Figures are captured when it is created; click <em>Refresh facts</em> to update them.</td></tr>
                        <tr><th scope="row">Team goal</th><td>A goal shared by a few people, with assignments and chat.</td><td>The Teamwork page, separate from personal plans</td><td>Permissions follow roles: Admin, Editor, Viewer.</td></tr>
                    </tbody>
                </table>
            </div>
            <h3>What Planner promises</h3>
            <ul>
                <li><strong>Archiving is not deleting.</strong> Archived areas, goals, milestones, tasks and habits are only hidden from lists; their data stays and can be restored in <em>Settings → Archive</em>. Notes and reviews, on the other hand, are gone once deleted.</li>
                <li><strong>No silent overwrites.</strong> If the same item was changed somewhere else (another tab, for example), Planner tells you and lets you choose <em>Use saved version</em> or <em>Keep my draft</em>.</li>
                <li><strong>You decide when something is done.</strong> Planner calculates progress but never marks a goal or milestone complete by itself. Completing a task with unticked checklist items asks first.</li>
                <li><strong>Dates follow your time zone.</strong> “Today”, deadlines and reminders use the time zone of your account.</li>
                <li><strong>Private by default.</strong> Only people you invite see a shared note; password-protected notes never appear in search, previews or AI answers.</li>
            </ul>
        </section>

        <section id="daily">
            <h2>Start your day on the Dashboard</h2>
            <p><strong>When to use it:</strong> every morning, to see today's work and keep the week on track.</p>
            <h3>The Daily tab</h3>
            <ol class="guide-steps">
                <li>At the top is the <strong>roadmap of your main goal</strong>. Use the arrow next to its name to choose another goal; this choice is also the <em>Main goal</em> on the Goals page.</li>
                <li><strong>Daily tasks</strong> holds what you picked for today, anything due, starting or scheduled today and recent overdue work. The percentage ring shows how much is done.</li>
                <li>Click <em>Add task</em> to pick an existing task or type the name of a new one for today. This never changes a task's deadline.</li>
                <li>Click the circle in front of a task to complete it; click again to reopen it.</li>
                <li>In the <strong>Habits</strong> card on the right, tick a habit to check in for today. The flame shows how many days in a row you kept every daily habit.</li>
            </ol>
            <h3>The Weekly and Activity tabs</h3>
            <p><strong>Weekly</strong> is the plan for the week (Monday to Sunday): the tasks picked for the week, milestones in focus, weekly habit targets and an activity chart per day. Click <em>+</em> next to a task to bring it into today. To pick a task for the week, use the pin icon (<em>Select for this week</em>) on its row.</p>
            <?= $shot('dashboard-week', 'The Weekly tab with the week\'s tasks and activity chart') ?>
            <p><strong>Activity</strong> shows a heat map of the whole year: each square is a day, darker means more work completed. Click a day to see what happened. It is a record of facts, not a score.</p>
            <?= $shot('dashboard-activity', 'The Activity tab with the year heat map') ?>
        </section>

        <section id="goals">
            <h2>Set goals and roadmaps</h2>
            <p><strong>When to use it:</strong> when there is an outcome you want to reach over weeks or months.</p>
            <h3>Create a goal</h3>
            <ol class="guide-steps">
                <li>Open <em>Goals</em>. The tree on the left groups goals by area; the timeline on the right orders them by deadline.</li>
                <li>Click <em>New goal</em>, enter a name, choose an area, a deadline and an importance (1–5 stars). You can add a description, an expected result and completion criteria.</li>
                <li>To change the icon or colour, click the goal's icon. To rename or add areas, use <em>Manage areas</em>.</li>
            </ol>
            <?= $shot('goals', 'The Goals page with the goal tree by area and the main goal') ?>
            <h3>Build the roadmap</h3>
            <p>Click a goal's name to open its <strong>fishbone roadmap</strong>: each branch is a milestone showing how many tasks are done and which milestone comes first.</p>
            <ol class="guide-steps">
                <li>Click <em>Add milestone</em>, give it a name and a deadline. Add milestones in the order you will go through them.</li>
                <li>Click a milestone to open its task list, then click <em>Add task</em>.</li>
                <li>When a stage is finished, click <em>Complete milestone</em>. If it requires an earlier milestone that isn't completed yet, Planner waits for that one first.</li>
                <li>Click <em>Goal information</em> to see the description, write your <em>Strategy</em> (how you plan to do it), add tags and see linked notes.</li>
            </ol>
            <?= $shot('roadmap', 'The fishbone roadmap of a goal with four milestones') ?>
            <?= $shot('milestone', 'The task list inside a milestone', 'Click a milestone to see and work on its tasks.') ?>
            <?= $shot('goal-information', 'The Goal information dialog with description, strategy and linked notes') ?>
            <p class="guide-note"><strong>Note:</strong> the stages of a goal should be <em>milestones</em>, not sub-goals. Create a sub-goal only for a separate outcome with its own roadmap.</p>
        </section>

        <section id="tasks">
            <h2>Manage tasks</h2>
            <p><strong>When to use it:</strong> to capture everything you need to do and find it again by time.</p>
            <h3>Capture a task</h3>
            <ol class="guide-steps">
                <li>Click <em>New task</em> (on the Dashboard, Tasks and Calendar).</li>
                <li>Type the name first; everything else can wait. Choose where it lives: the <em>Inbox</em>, a goal or a milestone.</li>
                <li>Optionally set a due date, a reminder, a repeat, an importance, a work slot (scheduled start and end) and an estimate.</li>
                <li>Under <em>Plan for</em>, choose today, this week or <em>Decide later</em>, then click <em>Create task</em>.</li>
            </ol>
            <?= $shot('new-task', 'The New task dialog') ?>
            <h3>Find and sort</h3>
            <p>The <em>Tasks</em> page has time filters:</p>
            <ul>
                <li><strong>Today</strong> – what you picked for today, anything due, starting or scheduled today, and overdue work not yet in history.</li>
                <li><strong>Next</strong> – work with a future date.</li>
                <li><strong>This week</strong> – what you picked for the week.</li>
                <li><strong>Backlog</strong> – tasks with no date at all.</li>
                <li><strong>Overdue</strong> – unfinished work past its due date.</li>
                <li><strong>All</strong> and <strong>Repeating</strong> – every task and every repeating series.</li>
            </ul>
            <p>Search by name, filter by status (Not started, In progress, Blocked, Done), sort by importance or time, and group by goal. On each row: the pin selects the task for the week, the sun selects it for today, the stars change its importance and <em>⋯</em> opens more (due date, reminder, repeat, edit, archive). A red edge means overdue.</p>
            <?= $shot('tasks', 'The Tasks page grouped by goal, with an overdue task marked in red') ?>
            <h3>Edit and complete</h3>
            <p>Click a task's name to open the quick editor. Click <em>Save changes</em> when done, or <em>Complete</em>. Only the fields you changed are sent.</p>
            <?= $shot('task-editor', 'The quick task editor on the right side of the screen') ?>
            <p><em>Open full page</em> shows the whole task: a completion checklist (for example “Paper 1”, “Paper 2”), a working note just for this task and related items. The working note is saved with <em>Save</em>.</p>
            <?= $shot('task-detail', 'The task detail page with its checklist') ?>
            <p class="guide-note"><strong>Reopening overdue work:</strong> Planner asks for a new due date (not in the past) or to clear the old one, so the task isn't instantly overdue again.</p>
            <p><strong>Task history</strong> (button at the top of Tasks) keeps tasks completed more than 24 hours ago or overdue for more than 3 days, so your lists stay focused. Change these limits in <em>History rules</em>, and <em>Reopen</em> any task from there.</p>
            <?= $shot('history', 'The Task history page with search and Reopen buttons') ?>
        </section>

        <section id="repeating">
            <h2>Repeating tasks</h2>
            <p><strong>When to use it:</strong> for work on a fixed schedule, such as “Review vocabulary Monday, Wednesday, Friday” or “Clean the room every Saturday”.</p>
            <ol class="guide-steps">
                <li>In the <em>New task</em> dialog click <em>Repeat</em> and choose daily, weekly (pick the days), monthly or yearly, with a start date and time.</li>
                <li>Planner creates each occurrence as its own task, about four weeks ahead.</li>
                <li>Manage series under the <em>Repeating</em> tab on Tasks: <em>Pause</em> (keeps the tasks already created), <em>Resume</em> (skips the dates you missed) or <em>End</em> (can archive future occurrences not yet started).</li>
            </ol>
            <?= $shot('repeating', 'The Repeating tab with two series') ?>
            <p class="guide-note">An ended series cannot be restarted; create a new one instead. For something you simply want to keep doing without a list of tasks, use a <a href="#habits">habit</a>.</p>
        </section>

        <section id="calendar">
            <h2>Plan your time on the Calendar</h2>
            <p><strong>When to use it:</strong> to see a whole month or week and move work to a better day.</p>
            <ol class="guide-steps">
                <li>Open <em>Calendar</em>, choose <em>Month</em> or <em>Week</em>, use the arrows to move and <em>Today</em> to come back. You can show a single goal.</li>
                <li>Each day lists goal and milestone deadlines, timed work slots and task dates. Overdue items are red; completed items are struck through.</li>
                <li><strong>Move an item:</strong> drag it to another day; or hold <kbd>Alt</kbd> and press an arrow key; or use the calendar icon next to it in the selected day (<em>Move to another day</em>) – handy on a phone.</li>
                <li>Click a day to see its details on the right; click <em>Add task</em> or double-click the day to create a task due that day.</li>
                <li><em>Unscheduled</em> lists tasks without any date. Drag one onto a day to give it a due date.</li>
            </ol>
            <?= $shot('calendar', 'The month calendar with the selected day and the Unscheduled list') ?>
            <p><strong>How moving works:</strong> every date of the item on the old day moves by the same number of days; a work slot keeps its start and end times. Occurrences of a repeating task and completed items don't move. Habits aren't shown on the Calendar; see the Habits page.</p>
            <?= $shot('calendar-week', 'The week view of the Calendar') ?>
        </section>

        <section id="habits">
            <h2>Build habits</h2>
            <p><strong>When to use it:</strong> for something you want to do regularly, such as reading every evening or running three times a week.</p>
            <ol class="guide-steps">
                <li>Open <em>Habits</em> and click <em>New habit</em>. Choose <strong>daily</strong> (once a day) or <strong>weekly</strong> (1–7 days a week). You can link it to a goal.</li>
                <li>Each day, tick the circle in front of the habit to check in; click again to undo. You can also click a day on its strip to check in for a past day (not for the future).</li>
                <li>Busy one day? Open <em>More options</em> (<em>⋯</em>) and pick a <em>Rest day</em> for tomorrow or up to 3 days ahead. A rest day doesn't break the streak.</li>
            </ol>
            <p>Your <strong>streak</strong> grows when every daily habit is done or resting. Weekly habits count their streak in weeks. Habits don't count towards goal progress: they are a rhythm, not a destination.</p>
            <?= $shot('habits', 'The Habits page with three habits, day strips and the streak') ?>
            <p class="guide-note">After the first check-in, a habit's period (daily/weekly) and time zone are fixed so its history stays correct. To change them, archive the habit and create a new one.</p>
        </section>

        <section id="notes">
            <h2>Notes</h2>
            <p><strong>When to use it:</strong> ideas, study material, shopping lists, recipes…</p>
            <ol class="guide-steps">
                <li>Open <em>Notes</em>, click <em>New note</em> and type a title and content. Notes <strong>save automatically</strong> as you type; the status line says when it is saved. Click <em>Save and close</em> when finished.</li>
                <li>Use <em>Check box</em> in the toolbar for lines with tick boxes, handy for to-do lists.</li>
                <li>Pick a <em>Note color</em>, pin important notes to the top and add labels to filter quickly (manage labels in the left column).</li>
                <li>Use <em>Linked to</em> to attach the note to a goal or task, so it appears with them.</li>
                <li><em>Add files</em> attaches images, PDFs or documents (up to 20 MB each); an attached image can become the note's background.</li>
            </ol>
            <?= $shot('notes', 'The Notes page with a pinned note, labels and a share invitation') ?>
            <?= $shot('note-editor', 'The note editor with a checklist, colours and a link') ?>
            <p>The search box looks in titles and content. The button beside it switches between grid and list. Icons on a card show whether a note is pinned, password-protected or shared.</p>
            <p class="guide-note">Deleting a note is permanent and removes its attachments. The <em>Delete</em> button sits apart at the start of the button row to avoid accidents.</p>
        </section>

        <section id="note-passwords">
            <h2>Lock a note with a password</h2>
            <p><strong>When to use it:</strong> for sensitive information such as account numbers or a private journal.</p>
            <ol class="guide-steps">
                <li>Open the note, click <em>Password</em> and type a password twice (at least 4 characters). It belongs to this note only, not to your account.</li>
                <li>From then on, Planner asks for it before you open, edit, delete, share, attach files or use AI with the note. After unlocking you have 15 minutes of inactivity before it asks again.</li>
                <li>To change or remove it, click <em>Password</em> again and choose <em>Change password</em> or <em>Remove password</em> (the current password is required).</li>
            </ol>
            <?= $shot('note-locked', 'The unlock dialog of a password-protected note') ?>
            <p class="guide-note"><strong>Remember your note password.</strong> Planner cannot recover it. A locked note's text never appears in previews, search, AI answers or the offline copy.</p>
        </section>

        <section id="sharing">
            <h2>Share a note and edit it together</h2>
            <p><strong>When to use it:</strong> when friends or a team should read or write a note with you.</p>
            <ol class="guide-steps">
                <li>Open the note and click <em>Share</em>. Enter one or more emails (separated by commas), choose <em>View only</em> or <em>Can view and edit</em>, and click <em>Invite</em>. Only people who already have a Planner account can be invited.</li>
                <li>They see the invitation in the bell and at the top of Notes, and choose <em>Accept</em> or <em>Decline</em>.</li>
                <li>Accepted notes appear under <em>Shared with me</em>, with the owner and your permission.</li>
                <li>When several people have the same note open, changes appear as others type, with their names and cursors.</li>
                <li>The owner can change permissions or <em>Remove</em> someone at any time; a recipient can <em>Leave shared note</em>.</li>
            </ol>
            <?= $shot('note-share', 'The share dialog with the people who have access') ?>
            <?= $shot('notes-shared', 'The Shared with me list') ?>
            <p class="guide-note">Recipients edit the title and content only. Attachments, labels, colour, pin, password and deletion stay with the owner. If a shared note is inappropriate, you can <em>Report</em> it to the administrators.</p>
        </section>

        <section id="ask-ai">
            <h2>Ask AI about your notes</h2>
            <p><strong>When to use it:</strong> when you have many notes and want to find or summarise something quickly.</p>
            <ul>
                <li><strong>Summarise one note:</strong> in the editor click <em>Summarize</em> for 2–6 key points. When the content changes the summary is marked <em>Out of date</em>; click <em>Regenerate</em> to refresh it.</li>
                <li><strong>Ask about all your notes:</strong> click <em>Ask AI</em> at the top of Notes and type a question (for example “Which environment words did I write down?”). The answer is based on your notes and lists its <em>Sources</em>; click one to open that note.</li>
            </ul>
            <?= $shot('ask-ai', 'The Ask AI dialog with an answer and its source note') ?>
            <p class="guide-note">The AI only reads your unlocked notes and notes shared with you, and only to answer; it never edits them. There is an hourly limit on questions. Check important facts in the source notes.</p>
        </section>

        <section id="offline">
            <h2>Use Planner offline</h2>
            <ul>
                <li>You can <strong>install Planner as an app</strong>: on a computer use the install icon in the browser's address bar; on a phone choose “Add to Home screen”.</li>
                <li>Without a connection an <em>Offline</em> label appears at the top. The Notes page still opens, searches and edits from the copy on your device.</li>
                <li>Changes made offline show “Saved on this device · will sync” and are sent when you are back online. If the note changed elsewhere in the meantime, your version is kept as a new note whose title ends in “(offline copy)”, so nothing is lost.</li>
                <li>Password-protected notes, attachments, sharing and AI need a connection. Signing out deletes the copy on the device.</li>
            </ul>
        </section>

        <section id="reviews">
            <h2>Look back with Reviews</h2>
            <p><strong>When to use it:</strong> at the end of a day, week or month, to learn from what happened.</p>
            <ol class="guide-steps">
                <li>Open <em>Reviews</em>, click <em>New review</em>, choose Daily, Weekly or Monthly and the period to look back on.</li>
                <li>Planner gathers the period's figures: activity, completion, wins and a chart per day.</li>
                <li>Write your <em>Reflection</em>, <em>What went well</em>, <em>What went wrong</em> and <em>What to change next</em>, then click <em>Save reflections</em>.</li>
                <li>Click <em>Refresh facts</em> if you completed more work in the period (your reflections are kept). Click <em>Finalize</em> to close the review; <em>Reopen</em> it to edit again.</li>
            </ol>
            <?= $shot('reviews', 'A weekly review with its figures and reflections') ?>
            <p class="guide-note">Deleting a review is permanent.</p>
        </section>

        <section id="teamwork">
            <h2>Teamwork</h2>
            <p><strong>When to use it:</strong> a class project, a small project or shared chores with a few people.</p>
            <ol class="guide-steps">
                <li>Open <em>Teamwork</em>, click <em>Add goal</em> and give it a name, description and deadline.</li>
                <li>Click <em>Invite</em> to add members by email and choose a role: <strong>Admin</strong> (manages members), <strong>Editor</strong> (creates and edits tasks), <strong>Viewer</strong> (reads, and updates the status of tasks assigned to them).</li>
                <li>Click <em>Add task</em> to create work, assign it to a member and set a due date, reminder or repeat. The assignee moves it through To do, In progress and Completed.</li>
                <li>Use <em>Team chat</em> to talk; new messages appear within a few seconds.</li>
            </ol>
            <?= $shot('teamwork', 'A team goal with members, assigned tasks and team chat') ?>
            <p>Team tasks assigned to you also appear on the Dashboard's Daily tab. Team goals are separate from your personal plans and don't count towards your own goal progress.</p>
            <p class="guide-note">The person who created a team goal is protected: nobody else can demote them or remove them from the team.</p>
        </section>

        <section id="assistant">
            <h2>The AI assistant</h2>
            <p><strong>When to use it:</strong> for a quick question about your plans, or to create and rearrange several things at once.</p>
            <p>Click the sparkle button at the bottom right. The assistant can read your areas, goals, milestones, tasks, habits and unlocked notes. Things to try:</p>
            <ul>
                <li>“What should I focus on this week?”</li>
                <li>“Draft a three-month roadmap to learn basic Python.”</li>
                <li>“Move my reading tasks into the Reading practice milestone.”</li>
                <li>“Put vocabulary practice at 19:00–20:30 on Saturday and move my overdue tasks to tomorrow.”</li>
                <li>“Create a daily habit to drink water and check it in for today.”</li>
            </ul>
            <p><strong>Nothing changes until you confirm.</strong> When the assistant wants to create, edit, reschedule or delete, it shows an <em>Apply these changes?</em> card listing every change (old → new). Click <em>Apply</em> to go ahead or <em>Cancel</em> to drop it. If you changed one of the items in the meantime, Planner refuses to apply so nothing is overwritten; just ask again.</p>
            <?= $shot('assistant', 'The AI assistant with a confirmation card containing a schedule change and a reschedule') ?>
            <p class="guide-note">The assistant cannot read password-protected notes and does not change Reviews, Teamwork or Settings. AI can be wrong; read the confirmation card before you apply it.</p>
        </section>

        <section id="notifications">
            <h2>Notifications and reminders</h2>
            <ul>
                <li>The bell shows share invitations, team invitations, assigned tasks and reminders that are due. Click an item to go to the right place.</li>
                <li>Set a reminder on a task with <em>Remind me</em> in the <em>⋯</em> menu, or the <em>Reminder</em> field when editing.</li>
                <li>In <em>Settings → Notifications</em> choose whether you get in-app notifications and whether you also get emails.</li>
            </ul>
            <?= $shot('bell', 'The notification panel opened from the bell') ?>
        </section>

        <section id="archive">
            <h2>Archive and restore</h2>
            <p><strong>Archive</strong> (in the <em>⋯</em> or <em>More options</em> menu) tidies away what you no longer use without losing data. When you archive a goal or milestone that still has content, Planner asks whether to archive everything inside it too.</p>
            <ol class="guide-steps">
                <li>Open <em>Settings → Archive</em> to see every archived area, goal, milestone, task and habit. Filter by type or search by name.</li>
                <li>Click <em>Restore</em>. A goal or milestone comes back with everything that was archived together with it.</li>
                <li>If an item lives inside a parent that is still archived, its button is disabled and says which parent to restore first.</li>
            </ol>
            <?= $shot('archive', 'The Archive page with a goal that comes back with 3 items') ?>
            <p class="guide-note">An area can only be restored while fewer than 4 areas are active. Notes and reviews have no archive: deleting them is permanent.</p>
        </section>

        <section id="settings">
            <h2>Account settings</h2>
            <p>Open them with the gear at the bottom left:</p>
            <ul>
                <li><strong>Profile</strong> – display name, short bio and picture; change your email (needs your current password and a confirmation sent to the new address).</li>
                <li><strong>Appearance</strong> – light or dark, five sceneries (Summit trail, Forest path, Coastal cove, Pisces, Starlit lake), your own background image or colour, your own quote and the language.</li>
                <li><strong>Security</strong> – change your password (your other sessions are signed out) and turn on <em>Two-step verification</em> with emailed codes or an authenticator app.</li>
                <li><strong>Notifications</strong> – in-app and email notifications on or off.</li>
                <li><strong>Task history</strong> and <strong>Archive</strong> – see the sections above.</li>
                <li><strong>Report a user</strong> – tell the administrators about someone breaking the rules, with up to 3 images as evidence. The person reported never learns who reported them.</li>
                <li><strong>User guide</strong> – this page.</li>
            </ul>
            <?= $shot('appearance', 'The Appearance page with light and dark mode and sceneries') ?>
            <?= $shot('security', 'The Security page with password change and two-step verification') ?>
        </section>

        <section id="administrators">
            <h2>For administrators</h2>
            <p>Administrator accounts (granted by whoever runs the server) have an extra <em>Administration</em> page in the sidebar to:</p>
            <ul>
                <li>Handle reports about notes and users: stop sharing a note, warn, lock the account or dismiss, with a reply to the person who reported.</li>
                <li>Find users and lock or unlock accounts (a locked account cannot sign in).</li>
                <li>Decide who can register: anyone, only invited emails, or nobody for now, and manage the invitation list.</li>
                <li>Set the system's task history limit and read the log of every administrator action.</li>
            </ul>
            <p>Administrators only see a snapshot of a reported note; they cannot read users' private plans or notes.</p>
        </section>

        <section id="faq">
            <h2>Frequently asked questions</h2>
            <dl class="guide-faq">
                <dt>I forgot my password.</dt>
                <dd>On the sign-in page choose <em>Forgot password?</em> and enter your email. Planner sends a link and a 6-digit code (valid for 30 minutes); use the link, or enter the code under <em>Have a code from the email?</em>, to set a new password.</dd>
                <dt>I forgot the password of a note.</dt>
                <dd>Unfortunately note passwords cannot be recovered, not even by an administrator. That is what keeps the content private.</dd>
                <dt>A task disappeared from my list.</dt>
                <dd>It may have moved to <em>Task history</em> (completed more than 24 hours ago or overdue for more than 3 days) or been archived. Check <em>Tasks → Task history</em> and <em>Settings → Archive</em>, and the filter and search currently selected.</dd>
                <dt>Planner says the item “has changed” when I save.</dt>
                <dd>It was just changed somewhere else (another tab, device or the AI assistant). Choose <em>Use saved version</em> to take the latest one, or <em>Keep my draft</em> to put your edits on top of it.</dd>
                <dt>Why is my goal at 100% but not “Completed”?</dt>
                <dd>Progress is only a calculation. Click <em>Complete goal</em> yourself when you have really reached the outcome.</dd>
                <dt>I can't complete a milestone.</dt>
                <dd>It requires an earlier milestone to be completed first. Complete that one, or open <em>Prerequisites and related goals</em> to see what it depends on.</dd>
                <dt>The assistant or Ask AI says it is unavailable.</dt>
                <dd>AI is switched on by the administrator on the server and has an hourly limit. Try again later or contact your administrator.</dd>
                <dt>I can't invite someone to a note or a team.</dt>
                <dd>They need a Planner account with exactly the email you entered. Ask them to register first.</dd>
                <dt>I archived a goal by mistake.</dt>
                <dd>Open <em>Settings → Archive</em> and click <em>Restore</em>. Everything archived together with the goal comes back.</dd>
            </dl>
        </section>
    </div>
</div>
