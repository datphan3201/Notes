import { get, patch, post } from '../lib/http.js';
import { t } from '../lib/i18n.js';
import { addDays, shiftMonth } from '../lib/calendar.js';
import { entityIcon } from '../lib/entity-icons.js';
import { lineIcon } from '../lib/line-icons.js';
import { intlLocale } from '../lib/format.js';
import { LatestRequest } from '../lib/read-coordinator.js';
import {
    creationState,
    createWithForm,
    finishCreation,
    reportWorkspaceError,
} from '../lib/workspace-ui.js';
import { localDate } from './task-views.js';
import { timeOfDay } from './task-capture.js';
import {
    calendarEntries,
    canMove,
    entriesOn,
    monthWeeks,
    moveChanges,
    unscheduledTasks,
    weekDays,
} from './calendar-model.js';

const VIEW_KEY = 'planner.calendar.view';
const MONTH_LIMIT = 3;
const KIND_LABELS = {
    scheduled: 'Scheduled',
    due: 'Due',
    start: 'Starts',
    occurrence: 'Repeats',
    deadline: 'Deadline',
};

const dayLabel = (date, options) =>
    new Intl.DateTimeFormat(intlLocale(), { timeZone: 'UTC', ...options }).format(
        new Date(`${date}T00:00:00Z`),
    );

/**
 * Calendar: Task, Milestone and Goal dates by month or week. Items move by drag and drop, by
 * Alt + arrow keys or with Move to… (a date picker), through the ordinary versioned PATCH.
 */
export function initCalendarPage(root) {
    const timezone = window.notesBootstrap.preferences.timezone;
    const today = () => localDate(new Date().toISOString(), timezone);
    const find = (selector) => root.querySelector(selector);
    const grid = find('[data-calendar-grid]');
    const status = find('[data-calendar-status]');
    const goalFilter = find('[data-calendar-goal]');
    const dialog = find('#calendar-task-dialog');
    const form = find('[data-calendar-task-form]');
    const parentSelect = find('[data-calendar-parent]');
    const reads = new LatestRequest();
    const query = new URLSearchParams(location.search);
    const validDate = (value) => (/^\d{4}-\d{2}-\d{2}$/.test(value || '') ? value : null);
    let view = query.get('view') || localStorage.getItem(VIEW_KEY);
    if (!['month', 'week'].includes(view)) view = 'month';
    let selected = validDate(query.get('date')) || today();
    let anchor = selected;
    let data = { tasks: [], milestones: [], goals: [] };
    let entries = [];
    let dragged = null;
    let pending = false;
    let restoreFocus = null;

    const goalsById = () => new Map(data.goals.map((goal) => [goal.id, goal]));
    const milestonesById = () => new Map(data.milestones.map((item) => [item.id, item]));
    const goalOf = (type, item) => {
        if (type === 'goal') return item.id;
        if (type === 'milestone') return item.goal_id;
        return item.goal_id || milestonesById().get(item.milestone_id)?.goal_id || null;
    };
    const visible = (type, item) => {
        const filter = goalFilter.value;
        if (!filter) return true;
        const goal = goalOf(type, item);
        return filter === 'inbox' ? !goal : goal === filter;
    };
    const href = (type, item) =>
        type === 'task'
            ? `/tasks/${encodeURIComponent(item.id)}`
            : `/goals/${encodeURIComponent(type === 'goal' ? item.id : item.goal_id)}`;
    const keyOf = (entry) => `${entry.type}:${entry.item.id}`;

    function syncAddress() {
        const params = new URLSearchParams({ view, date: selected });
        history.replaceState(null, '', `${location.pathname}?${params}`);
    }

    function announce(message) {
        status.textContent = '';
        status.textContent = message;
    }

    function kindText(entry) {
        if (entry.kind === 'scheduled') {
            const start = timeOfDay(entry.item.scheduled_start, timezone);
            if (entry.continued) return t('Continues');
            return entry.item.scheduled_end
                ? `${start}–${timeOfDay(entry.item.scheduled_end, timezone)}`
                : start;
        }
        return t(KIND_LABELS[entry.kind]);
    }

    function marker(entry) {
        if (entry.type !== 'task') return entityIcon(entry.item, { size: 'sm' });
        const icon = lineIcon(
            { scheduled: 'clock', occurrence: 'repeat', start: 'calendar', due: 'calendar' }[
                entry.kind
            ],
        );
        icon.classList.add('calendar-item-icon');
        return icon;
    }

    function itemLink(entry, { compact = false } = {}) {
        const link = document.createElement('a');
        link.className = `calendar-item is-${entry.type} is-${entry.kind}`;
        link.href = href(entry.type, entry.item);
        link.dataset.calendarKey = keyOf(entry);
        link.dataset.calendarDate = entry.date;
        const overdue =
            !entry.done && ['due', 'deadline'].includes(entry.kind) && entry.date < today();
        link.classList.toggle('is-done', entry.done);
        link.classList.toggle('is-overdue', overdue);
        const kind = kindText(entry);
        const name = document.createElement('span');
        name.className = 'calendar-item-name';
        name.textContent = entry.item.name;
        if (compact && entry.kind === 'scheduled' && !entry.continued) {
            const time = document.createElement('span');
            time.className = 'calendar-item-time';
            time.textContent = timeOfDay(entry.item.scheduled_start, timezone);
            link.append(marker(entry), time, name);
        } else link.append(marker(entry), name);
        const facts = [kind, entry.done ? t('Done') : '', overdue ? t('Overdue') : ''];
        link.title = `${entry.item.name} · ${facts.filter(Boolean).join(' · ')}`;
        link.setAttribute('aria-label', link.title);
        if (canMove(entry, timezone)) {
            link.draggable = true;
            link.addEventListener('dragstart', (event) => {
                dragged = entry;
                event.dataTransfer.effectAllowed = 'move';
                event.dataTransfer.setData('text/plain', entry.item.name);
                link.classList.add('is-dragging');
            });
            link.addEventListener('dragend', () => {
                dragged = null;
                link.classList.remove('is-dragging');
                grid.querySelectorAll('.is-drop-target').forEach((cell) =>
                    cell.classList.remove('is-drop-target'),
                );
            });
            link.addEventListener('keydown', (event) => {
                if (!event.altKey) return;
                const step = { ArrowLeft: -1, ArrowRight: 1, ArrowUp: -7, ArrowDown: 7 }[event.key];
                if (!step) return;
                event.preventDefault();
                move(entry, addDays(entry.date, step), { focus: true });
            });
        }
        return link;
    }

    // `dateOf` is read at drop time, so a long-lived target (the day panel) follows the selection.
    function acceptDrops(target, dateOf) {
        target.addEventListener('dragover', (event) => {
            if (!dragged) return;
            event.preventDefault();
            event.dataTransfer.dropEffect = 'move';
            target.classList.add('is-drop-target');
        });
        target.addEventListener('dragleave', (event) => {
            if (!target.contains(event.relatedTarget)) target.classList.remove('is-drop-target');
        });
        target.addEventListener('drop', (event) => {
            event.preventDefault();
            target.classList.remove('is-drop-target');
            const entry = dragged;
            dragged = null;
            if (entry) move(entry, dateOf());
        });
    }

    async function move(entry, to, { focus = false } = {}) {
        if (pending) return;
        const changes = moveChanges(entry.type, entry.item, entry.date, to, timezone);
        if (!changes) return;
        pending = true;
        grid.setAttribute('aria-busy', 'true');
        try {
            await patch(`/api/v1/${entry.type}s/${entry.item.id}`, {
                base_version: entry.item.version,
                ...changes,
            });
            announce(`${t('Moved')} ${entry.item.name} → ${dayLabel(to, { dateStyle: 'full' })}`);
            selected = to;
            if (
                view === 'week' ||
                !monthWeeks(...ym(anchor))
                    .flat()
                    .includes(to)
            )
                anchor = to;
            if (focus) restoreFocus = { key: keyOf(entry), date: to };
        } catch (error) {
            reportWorkspaceError(root, error);
        } finally {
            pending = false;
            await load();
        }
    }

    const ym = (date) => [Number(date.slice(0, 4)), Number(date.slice(5, 7))];

    function dayCell(date, { inMonth = true, week = false } = {}) {
        const cell = document.createElement('div');
        cell.className = 'calendar-day-cell';
        cell.classList.toggle('is-outside', !inMonth);
        cell.classList.toggle('is-today', date === today());
        cell.classList.toggle('is-selected', date === selected);
        cell.dataset.date = date;
        const label = dayLabel(date, { weekday: 'long', day: 'numeric', month: 'long' });
        cell.setAttribute('role', 'group');
        cell.setAttribute('aria-label', label);
        const head = document.createElement('button');
        head.type = 'button';
        head.className = 'calendar-day-number';
        head.setAttribute('aria-label', label);
        head.setAttribute('aria-pressed', String(date === selected));
        head.textContent = week
            ? dayLabel(date, { weekday: 'short', day: 'numeric' })
            : dayLabel(date, { day: 'numeric' });
        head.addEventListener('click', () => select(date));
        const items = entriesOn(entries, date);
        const list = document.createElement('div');
        list.className = 'calendar-day-items';
        const shown = week ? items : items.slice(0, MONTH_LIMIT);
        list.append(...shown.map((entry) => itemLink(entry, { compact: true })));
        if (items.length > shown.length) {
            const more = document.createElement('button');
            more.type = 'button';
            more.className = 'calendar-more';
            more.textContent = `+${items.length - shown.length} ${t('more')}`;
            more.addEventListener('click', () => select(date));
            list.append(more);
        }
        // Phones show one dot per item; the selected day's agenda carries the detail.
        const dots = document.createElement('span');
        dots.className = 'calendar-dots';
        dots.setAttribute('aria-hidden', 'true');
        for (const entry of items.slice(0, 4)) {
            const dot = document.createElement('i');
            dot.className = `is-${entry.type}${entry.done ? ' is-done' : ''}`;
            dots.append(dot);
        }
        head.append(dots);
        cell.append(head, list);
        cell.addEventListener('click', (event) => {
            if (event.target === cell || event.target === list) select(date);
        });
        cell.addEventListener('dblclick', (event) => {
            if (event.target.closest('a, button:not(.calendar-day-number)')) return;
            openCreate(date);
        });
        acceptDrops(cell, () => date);
        return cell;
    }

    function renderGrid() {
        const weekdays = find('[data-calendar-weekdays]');
        weekdays.replaceChildren(
            ...weekDays(anchor).map((date) => {
                const name = document.createElement('span');
                name.textContent = dayLabel(date, { weekday: 'short' });
                return name;
            }),
        );
        weekdays.hidden = view === 'week';
        grid.dataset.view = view;
        if (view === 'month') {
            const [year, month] = ym(anchor);
            find('[data-calendar-period]').textContent = dayLabel(`${anchor.slice(0, 7)}-01`, {
                month: 'long',
                year: 'numeric',
            });
            grid.replaceChildren(
                ...monthWeeks(year, month)
                    .flat()
                    .map((date) => dayCell(date, { inMonth: Number(date.slice(5, 7)) === month })),
            );
        } else {
            const days = weekDays(anchor);
            find('[data-calendar-period]').textContent =
                `${dayLabel(days[0], { day: 'numeric', month: 'short' })} – ${dayLabel(days[6], {
                    day: 'numeric',
                    month: 'short',
                    year: 'numeric',
                })}`;
            grid.replaceChildren(...days.map((date) => dayCell(date, { week: true })));
        }
        for (const button of root.querySelectorAll('[data-calendar-view]'))
            button.setAttribute('aria-pressed', String(button.dataset.calendarView === view));
    }

    function agendaRow(entry) {
        const row = document.createElement('li');
        row.className = 'calendar-agenda-row';
        const link = itemLink(entry);
        const meta = document.createElement('small');
        const goal = goalsById().get(goalOf(entry.type, entry.item));
        const milestone = milestonesById().get(entry.item.milestone_id);
        meta.textContent = [
            entry.date ? kindText(entry) : '',
            entry.type === 'goal' ? t('Goal') : '',
            entry.type === 'milestone' ? `${t('Milestone')} · ${goal?.name || ''}` : '',
            entry.type === 'task' ? milestone?.name || goal?.name || t('Inbox') : '',
        ]
            .filter(Boolean)
            .join(' · ');
        const copy = document.createElement('div');
        copy.className = 'calendar-agenda-copy';
        copy.append(link, meta);
        row.append(copy);
        if (entry.date == null || canMove(entry, timezone)) {
            // Move to… is the touch and pointer-free path: a native date picker.
            const picker = document.createElement('input');
            picker.type = 'date';
            picker.className = 'calendar-move-input';
            picker.value = entry.date || selected;
            picker.tabIndex = -1;
            picker.setAttribute('aria-hidden', 'true');
            const button = document.createElement('button');
            button.type = 'button';
            button.className = 'icon-button calendar-move';
            const label = entry.date ? t('Move to another day') : t('Set due date');
            button.setAttribute('aria-label', `${label}: ${entry.item.name}`);
            button.title = label;
            button.append(lineIcon('calendar'));
            button.addEventListener('click', () => {
                picker.value = entry.date || selected;
                if (picker.showPicker) picker.showPicker();
                else picker.focus();
            });
            picker.addEventListener('change', () => {
                if (validDate(picker.value)) move(entry, picker.value);
            });
            row.append(button, picker);
        }
        return row;
    }

    function renderSide() {
        find('[data-calendar-day-title]').textContent = dayLabel(selected, {
            weekday: 'long',
            day: 'numeric',
            month: 'long',
        });
        const dayItems = entriesOn(entries, selected);
        const list = find('[data-calendar-day-list]');
        if (dayItems.length) list.replaceChildren(...dayItems.map(agendaRow));
        else {
            const empty = document.createElement('li');
            empty.className = 'subtle-copy calendar-empty';
            empty.textContent = t('Nothing planned for this day.');
            list.replaceChildren(empty);
        }
        const loose = unscheduledTasks(data.tasks).filter((task) => visible('task', task));
        find('[data-calendar-unscheduled-count]').textContent = String(loose.length);
        const tray = find('[data-calendar-unscheduled-list]');
        if (loose.length)
            tray.replaceChildren(
                ...loose.map((task) =>
                    agendaRow({ type: 'task', item: task, date: null, kind: 'due', done: false }),
                ),
            );
        else {
            const empty = document.createElement('li');
            empty.className = 'subtle-copy calendar-empty';
            empty.textContent = t('Every open task has a date.');
            tray.replaceChildren(empty);
        }
    }

    function render() {
        entries = calendarEntries(
            {
                tasks: data.tasks.filter((item) => visible('task', item)),
                milestones: data.milestones.filter((item) => visible('milestone', item)),
                goals: data.goals.filter((item) => visible('goal', item)),
            },
            timezone,
        );
        renderGrid();
        renderSide();
        syncAddress();
        if (restoreFocus) {
            const { key, date } = restoreFocus;
            restoreFocus = null;
            grid.querySelector(
                `[data-calendar-key="${CSS.escape(key)}"][data-calendar-date="${date}"]`,
            )?.focus();
        }
    }

    function select(date) {
        selected = date;
        const [year, month] = ym(anchor);
        const shown =
            view === 'week' ? weekDays(anchor) : monthWeeks(year, month).flat().slice(0, 42);
        if (!shown.includes(date)) anchor = date;
        render();
    }

    function fillFilters() {
        const choose = (select, options) => {
            const current = select.value;
            select
                .querySelectorAll('option:not(:first-child), optgroup')
                .forEach((node) => node.remove());
            select.append(...options);
            if ([...select.options].some((option) => option.value === current))
                select.value = current;
        };
        const active = data.goals.filter((goal) => goal.status !== 'Completed');
        const option = (value, label) => new Option(label, value);
        choose(goalFilter, [
            ...active.map((goal) => option(goal.id, goal.name)),
            option('inbox', t('Inbox')),
        ]);
        choose(
            parentSelect,
            active.map((goal) => {
                const group = document.createElement('optgroup');
                group.label = goal.name;
                group.append(
                    option(`goal:${goal.id}`, goal.name),
                    ...data.milestones
                        .filter((item) => item.goal_id === goal.id && item.status !== 'Completed')
                        .sort((a, b) => a.position - b.position)
                        .map((item) => option(`milestone:${item.id}`, `↳ ${item.name}`)),
                );
                return group;
            }),
        );
    }

    async function load() {
        const ticket = reads.begin();
        grid.setAttribute('aria-busy', 'true');
        try {
            const [tasks, milestones, goals] = await Promise.all(
                ['tasks', 'milestones', 'goals'].map((path) =>
                    get(`/api/v1/${path}`, { signal: ticket.signal }),
                ),
            );
            if (!reads.isCurrent(ticket)) return;
            data = {
                tasks: tasks.payload.data,
                milestones: milestones.payload.data,
                goals: goals.payload.data.filter((goal) => goal.status !== 'Archived'),
            };
            find('[data-planning-error]').classList.add('is-hidden');
            fillFilters();
            render();
        } catch (error) {
            if (!reads.shouldIgnore(ticket, error)) reportWorkspaceError(root, error);
        } finally {
            if (reads.isCurrent(ticket)) grid.setAttribute('aria-busy', 'false');
        }
    }

    function openCreate(date = selected) {
        if (document.querySelector('dialog[open]')) return;
        form.reset();
        form.elements.deadline.value = date;
        const filter = goalFilter.value;
        if (filter && filter !== 'inbox') form.elements.parent.value = `goal:${filter}`;
        creationState(form).markSaved();
        dialog.querySelector('[data-dialog-error]').classList.add('is-hidden');
        dialog.showModal();
        form.elements.name.focus();
    }

    form.addEventListener('submit', (event) => {
        event.preventDefault();
        const values = new FormData(form);
        const [kind, id] = String(values.get('parent') || '').split(':');
        createWithForm(form, async () => {
            try {
                await post('/api/v1/tasks', {
                    name: values.get('name'),
                    deadline: values.get('deadline'),
                    goal_id: kind === 'goal' ? id : null,
                    milestone_id: kind === 'milestone' ? id : null,
                    importance: 3,
                });
                finishCreation(form);
                announce(`${t('Task created')}: ${values.get('name')}`);
                selected = values.get('deadline');
                await load();
            } catch (error) {
                reportWorkspaceError(root, error);
            }
        });
    });

    root.querySelectorAll('[data-calendar-step]').forEach((button) =>
        button.addEventListener('click', () => {
            const step = Number(button.dataset.calendarStep);
            if (view === 'week') {
                anchor = addDays(anchor, step * 7);
                selected = addDays(selected, step * 7);
            } else {
                const [year, month] = ym(anchor);
                const next = shiftMonth(year, month, step);
                anchor = `${next.year}-${String(next.month).padStart(2, '0')}-01`;
                const day = Math.min(Number(selected.slice(8)), 28);
                selected = `${anchor.slice(0, 7)}-${String(day).padStart(2, '0')}`;
            }
            render();
        }),
    );
    find('[data-calendar-today]').addEventListener('click', () => {
        anchor = today();
        select(today());
    });
    root.querySelectorAll('[data-calendar-view]').forEach((button) =>
        button.addEventListener('click', () => {
            view = button.dataset.calendarView;
            localStorage.setItem(VIEW_KEY, view);
            anchor = selected;
            render();
        }),
    );
    acceptDrops(find('[data-calendar-day]'), () => selected);
    goalFilter.addEventListener('change', render);
    find('[data-calendar-add]').addEventListener('click', () => openCreate());
    find('[data-calendar-day-add]').addEventListener('click', () => openCreate());
    find('[data-planning-retry]').addEventListener('click', load);
    load();
}
