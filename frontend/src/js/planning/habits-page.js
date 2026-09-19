import { get, post, put, remove } from '../lib/http.js';
import { renderEmptyState } from '../lib/empty-state.js';

function showError(root, error) {
    const output = root.querySelector('[data-planning-error]');
    output.textContent = Object.values(error.payload?.errors || {}).flat()[0] || error.message;
    output.classList.remove('is-hidden');
}

export function initHabitsPage(root) {
    const habitList = root.querySelector('[data-habit-list]');
    const seriesList = root.querySelector('[data-series-list]');
    const today = new Date().toLocaleDateString('en-CA');
    const seriesForm = root.querySelector('[data-series-create-form]');
    const seriesStart = seriesForm.querySelector('[name="start_date"]');
    const frequency = seriesForm.querySelector('[name="frequency"]');
    const weekdayFieldset = seriesForm.querySelector('[data-series-weekdays]');
    const previewOutput = seriesForm.querySelector('[data-series-preview-output]');
    seriesStart.value = today;
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
        try {
            const [habits, series] = await Promise.all([
                get('/api/v1/habits'),
                get('/api/v1/task-series'),
            ]);
            habitList.replaceChildren();
            const histories = await Promise.all(
                habits.payload.data.map((habit) => get(`/api/v1/habits/${habit.id}/history`)),
            );
            for (const [index, habit] of habits.payload.data.entries()) {
                const row = document.createElement('article');
                row.className = 'planning-list-item';
                const name = document.createElement('strong');
                name.textContent = `${habit.name} · ${habit.target_frequency}/${habit.period === 'daily' ? 'day' : 'week'}`;
                const button = document.createElement('button');
                button.type = 'button';
                button.className = 'button button-quiet';
                let completed = histories[index].payload.data.some((entry) => entry.date === today);
                button.textContent = completed ? 'Undo today' : 'Check in today';
                button.addEventListener('click', async () => {
                    button.disabled = true;
                    try {
                        if (completed) {
                            await remove(`/api/v1/habits/${habit.id}/check-ins/${today}`);
                        } else {
                            await put(`/api/v1/habits/${habit.id}/check-ins/${today}`);
                        }
                        completed = !completed;
                        button.textContent = completed ? 'Undo today' : 'Check in today';
                    } catch (error) {
                        showError(root, error);
                    } finally {
                        button.disabled = false;
                    }
                });
                row.append(name, button);
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
            showError(root, error);
        }
    };

    root.querySelector('[data-habit-create-form]').addEventListener('submit', async (event) => {
        event.preventDefault();
        const form = event.currentTarget;
        const data = new FormData(form);
        try {
            await post('/api/v1/habits', {
                name: data.get('name'),
                period: data.get('period'),
                target_frequency: Number(data.get('target_frequency')),
                timezone: Intl.DateTimeFormat().resolvedOptions().timeZone,
            });
            form.reset();
            form.querySelector('[name="target_frequency"]').value = '1';
            await load();
        } catch (error) {
            showError(root, error);
        }
    });
    seriesForm.addEventListener('submit', async (event) => {
        event.preventDefault();
        const form = event.currentTarget;
        const submit = form.querySelector('button[type="submit"]');
        submit.disabled = true;
        try {
            await post('/api/v1/task-series', seriesPayload());
            form.reset();
            frequency.dispatchEvent(new Event('change'));
            seriesStart.value = today;
            form.querySelector('[name="interval_count"]').value = '1';
            previewOutput.textContent = '';
            await load();
        } catch (error) {
            showError(root, error);
        } finally {
            submit.disabled = false;
        }
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
