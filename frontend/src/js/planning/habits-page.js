import { get, post, put, remove } from '../lib/http.js';
import { renderEmptyState } from '../lib/empty-state.js';
import { renderStreak } from './insights-ui.js';
import { localDate } from './task-views.js';
import { LatestRequest } from '../lib/read-coordinator.js';
import {
    creationState,
    createWithForm,
    finishCreation,
    reportWorkspaceError,
} from '../lib/workspace-ui.js';

function showError(root, error) {
    reportWorkspaceError(root, error);
}

export function initHabitsPage(root) {
    const reads = new LatestRequest();
    const habitList = root.querySelector('[data-habit-list]');

    const load = async () => {
        const ticket = reads.begin();
        root.setAttribute('aria-busy', 'true');
        root.querySelector('[data-planning-error]').classList.add('is-hidden');
        try {
            const [habits, dashboard] = await Promise.all([
                get('/api/v1/habits', { signal: ticket.signal }),
                get('/api/v1/dashboard', { signal: ticket.signal }),
            ]);
            const histories = await Promise.all(
                habits.payload.data.map((habit) =>
                    get(`/api/v1/habits/${habit.id}/history`, { signal: ticket.signal }),
                ),
            );
            if (!reads.isCurrent(ticket)) return;
            renderStreak(
                root.querySelector('[data-habit-streak]'),
                dashboard.payload.data.habit_streak,
                dashboard.payload.data.today,
            );
            habitList.replaceChildren();
            for (const [index, habit] of habits.payload.data.entries()) {
                const row = document.createElement('article');
                row.className = 'planning-list-item planning-list-item-wrap';
                const name = document.createElement('strong');
                name.textContent = habit.name;
                const habitToday = localDate(new Date().toISOString(), habit.timezone);
                const checkedDates = new Set(
                    histories[index].payload.data.map((entry) => entry.date),
                );
                const weekStart = new Date(`${habitToday}T00:00:00Z`);
                weekStart.setUTCDate(weekStart.getUTCDate() - ((weekStart.getUTCDay() + 6) % 7));
                const periodStart =
                    habit.period === 'daily' ? habitToday : weekStart.toISOString().slice(0, 10);
                const count = [...checkedDates].filter(
                    (date) => date >= periodStart && date <= habitToday,
                ).length;
                const progress = document.createElement('small');
                progress.textContent = `${count}/${habit.target_frequency} days completed ${habit.period === 'daily' ? 'today' : 'this week'}`;
                const days = document.createElement('div');
                days.className = 'habit-checkin-days';
                days.setAttribute('role', 'group');
                days.setAttribute(
                    'aria-label',
                    `${habit.name}: recent check-ins in ${habit.timezone}`,
                );
                for (let offset = 6; offset >= 0; offset--) {
                    const cursor = new Date(`${habitToday}T00:00:00Z`);
                    cursor.setUTCDate(cursor.getUTCDate() - offset);
                    const date = cursor.toISOString().slice(0, 10);
                    const checked = checkedDates.has(date);
                    const button = document.createElement('button');
                    button.type = 'button';
                    button.classList.toggle('is-checked', checked);
                    button.setAttribute('aria-pressed', String(checked));
                    button.title = `${date} · ${habit.timezone}`;
                    button.setAttribute(
                        'aria-label',
                        `${checked ? 'Undo' : 'Check in'} ${habit.name} on ${date}`,
                    );
                    const dot = document.createElement('span');
                    dot.textContent = checked ? '✓' : '○';
                    const weekday = document.createElement('small');
                    weekday.textContent = cursor.toLocaleDateString('en-US', {
                        weekday: 'narrow',
                        timeZone: 'UTC',
                    });
                    button.append(dot, weekday);
                    button.addEventListener('click', async () => {
                        button.disabled = true;
                        try {
                            if (checked)
                                await remove(`/api/v1/habits/${habit.id}/check-ins/${date}`);
                            else await put(`/api/v1/habits/${habit.id}/check-ins/${date}`);
                            await load();
                        } catch (error) {
                            showError(root, error);
                        } finally {
                            button.disabled = false;
                        }
                    });
                    days.append(button);
                }
                const copy = document.createElement('div');
                const marker = document.createElement('span');
                marker.className = 'habit-row-marker';
                marker.setAttribute('aria-hidden', 'true');
                marker.textContent = checkedDates.has(habitToday) ? '✓' : '';
                marker.classList.toggle('is-checked', checkedDates.has(habitToday));
                copy.append(marker, name);
                if (habit.description) {
                    const description = document.createElement('p');
                    description.className = 'subtle-copy';
                    description.textContent = habit.description;
                    copy.append(description);
                }
                const timezone = document.createElement('small');
                timezone.textContent = `${habit.timezone} · today ${habitToday}`;
                copy.append(progress, timezone);
                const todayButton = document.createElement('button');
                todayButton.type = 'button';
                todayButton.className = 'button button-quiet habit-today-action';
                todayButton.dataset.checked = String(checkedDates.has(habitToday));
                todayButton.textContent = checkedDates.has(habitToday)
                    ? 'Undo today'
                    : 'Check in today';
                todayButton.setAttribute('aria-label', todayButton.textContent);
                todayButton.title = `${todayButton.textContent} · ${habit.name}`;
                todayButton.addEventListener('click', async () => {
                    todayButton.disabled = true;
                    try {
                        if (checkedDates.has(habitToday))
                            await remove(`/api/v1/habits/${habit.id}/check-ins/${habitToday}`);
                        else await put(`/api/v1/habits/${habit.id}/check-ins/${habitToday}`);
                        await load();
                    } catch (error) {
                        showError(root, error);
                    } finally {
                        todayButton.disabled = false;
                    }
                });
                row.append(copy, days, todayButton);
                habitList.append(row);
            }
            if (!habits.payload.data.length)
                renderEmptyState(habitList, {
                    title: 'A fresh start, every day.',
                    description: 'Create a habit and start checking in. Small steps add up.',
                    icon: 'habits',
                    href: '#habit-name',
                    action: 'Create your first habit',
                });
        } catch (error) {
            if (reads.shouldIgnore(ticket, error)) return;
            showError(root, error);
        } finally {
            if (reads.isCurrent(ticket)) root.setAttribute('aria-busy', 'false');
        }
    };

    const habitForm = root.querySelector('[data-habit-create-form]');
    const setHabitTarget = () => {
        const daily = habitForm.elements.period.value === 'daily';
        habitForm.elements.target_frequency.disabled = daily;
        if (daily) habitForm.elements.target_frequency.value = '1';
    };
    habitForm.elements.period.addEventListener('change', setHabitTarget);
    setHabitTarget();
    creationState(habitForm).markSaved();
    root.querySelector('[data-habit-create-form]').addEventListener('submit', (event) => {
        event.preventDefault();
        const form = event.currentTarget;
        const data = new FormData(form);
        createWithForm(form, async () => {
            try {
                await post('/api/v1/habits', {
                    name: data.get('name'),
                    period: data.get('period'),
                    target_frequency:
                        data.get('period') === 'daily' ? 1 : Number(data.get('target_frequency')),
                    description: data.get('description') || '',
                    timezone: Intl.DateTimeFormat().resolvedOptions().timeZone,
                });
                form.reset();
                setHabitTarget();
                finishCreation(form);
                load();
            } catch (error) {
                showError(root, error);
            }
        });
    });
    root.querySelector('[data-planning-retry]').addEventListener('click', load);
    load();
}
