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
    const seriesList = root.querySelector('[data-series-list]');
    const today = localDate(new Date().toISOString(), window.notesBootstrap.preferences.timezone);
    const seriesForm = root.querySelector('[data-series-create-form]');
    const seriesStart = seriesForm.querySelector('[name="start_date"]');
    const frequency = seriesForm.querySelector('[name="frequency"]');
    const weekdayFieldset = seriesForm.querySelector('[data-series-weekdays]');
    const previewOutput = seriesForm.querySelector('[data-series-preview-output]');
    seriesStart.value = today;
    creationState(seriesForm).markSaved();
    const seriesPayload = () => {
        const data = new FormData(seriesForm);
        return {
            name: data.get('name'),
            frequency: data.get('frequency'),
            interval_count: Number(data.get('interval_count')),
            weekdays: data.getAll('weekdays').map(Number),
            start_date: data.get('start_date'),
            end_date: data.get('end_date') || null,
            timezone: Intl.DateTimeFormat().resolvedOptions().timeZone,
            local_time: data.get('local_time') || null,
            checklist: [],
            tag_ids: [],
            contribution_goal_ids: [],
        };
    };

    const load = async () => {
        const ticket = reads.begin();
        root.setAttribute('aria-busy', 'true');
        root.querySelector('[data-planning-error]').classList.add('is-hidden');
        try {
            const [habits, series, dashboard] = await Promise.all([
                get('/api/v1/habits', { signal: ticket.signal }),
                get('/api/v1/task-series', { signal: ticket.signal }),
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
            seriesList.replaceChildren();
            for (const item of series.payload.data) {
                const row = document.createElement('article');
                row.className = 'planning-list-item planning-list-item-wrap';
                const copy = document.createElement('div');
                const name = document.createElement('strong');
                name.textContent = item.name;
                const meta = document.createElement('small');
                meta.textContent = `${item.state} · ${item.frequency} · from ${item.start_date}${item.end_date ? ` to ${item.end_date}` : ''}`;
                copy.append(name, meta);
                const actions = document.createElement('div');
                actions.className = 'action-row';
                if (item.state !== 'Ended') {
                    const stateButton = document.createElement('button');
                    stateButton.type = 'button';
                    stateButton.className = 'button button-quiet';
                    const action = item.state === 'Paused' ? 'resume' : 'pause';
                    stateButton.textContent = action === 'resume' ? 'Resume' : 'Pause';
                    stateButton.addEventListener('click', async () => {
                        stateButton.disabled = true;
                        try {
                            await post(`/api/v1/task-series/${item.id}/${action}`, {
                                base_version: item.version,
                            });
                            await load();
                        } catch (error) {
                            showError(root, error);
                        } finally {
                            stateButton.disabled = false;
                        }
                    });
                    const endButton = document.createElement('button');
                    endButton.type = 'button';
                    endButton.className = 'button button-quiet';
                    endButton.textContent = 'End';
                    endButton.addEventListener('click', async () => {
                        if (
                            !window.confirm(
                                `End “${item.name}” today and archive future occurrences that have not started?`,
                            )
                        )
                            return;
                        endButton.disabled = true;
                        try {
                            await post(`/api/v1/task-series/${item.id}/end`, {
                                base_version: item.version,
                                end_date: today,
                                archive_future: true,
                            });
                            await load();
                        } catch (error) {
                            showError(root, error);
                        } finally {
                            endButton.disabled = false;
                        }
                    });
                    actions.append(stateButton, endButton);
                }
                row.append(copy, actions);
                seriesList.append(row);
            }
            if (!series.payload.data.length)
                renderEmptyState(seriesList, {
                    title: 'Make room for a routine.',
                    description: 'Schedule daily or weekly tasks to keep repeatable work on track.',
                    icon: 'calendar',
                    href: '#series-name',
                    action: 'Plan a recurring task',
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
    seriesForm.addEventListener('submit', (event) => {
        event.preventDefault();
        const payload = seriesPayload();
        createWithForm(seriesForm, async () => {
            try {
                await post('/api/v1/task-series', payload);
                seriesForm.reset();
                frequency.dispatchEvent(new Event('change'));
                seriesStart.value = today;
                previewOutput.textContent = '';
                finishCreation(seriesForm);
                load();
            } catch (error) {
                showError(root, error);
            }
        });
    });
    frequency.addEventListener('change', () => {
        weekdayFieldset.classList.toggle('is-hidden', frequency.value !== 'weekly');
        if (frequency.value === 'daily') {
            for (const checkbox of weekdayFieldset.querySelectorAll('input'))
                checkbox.checked = false;
        }
    });
    root.querySelector('[data-series-preview]').addEventListener('click', async (event) => {
        const button = event.currentTarget;
        button.disabled = true;
        try {
            const response = await post('/api/v1/task-series/preview', seriesPayload());
            const dates = response.payload.data;
            previewOutput.textContent = dates.length
                ? `Upcoming dates: ${dates.slice(0, 8).join(', ')}${dates.length > 8 ? '…' : ''}`
                : 'No matching dates in the preview range.';
        } catch (error) {
            showError(root, error);
        } finally {
            button.disabled = false;
        }
    });
    root.querySelector('[data-planning-retry]').addEventListener('click', load);
    load();
}
