import { post } from '../lib/http.js';
import { localDate } from './task-views.js';
export function taskCaptureValues(data) {
    return {
        description: data.get('description') || '',
        reminder_at: data.get('reminder_at')
            ? new Date(data.get('reminder_at')).toISOString()
            : null,
        start_date: data.get('start_date') || null,
        deadline: data.get('deadline') || null,
        estimated_minutes: data.get('estimated_minutes')
            ? Number(data.get('estimated_minutes'))
            : null,
        importance: Number(data.get('importance') || 3),
    };
}

export async function createCapturedTask(data, input) {
    const repeat = data.get('repeat_frequency');
    if (!repeat) return post('/api/v1/tasks', input);
    if (input.reminder_at)
        throw new Error(
            'Set a reminder on the generated task after creating the repeating series.',
        );
    const timezone = window.notesBootstrap.preferences.timezone;
    const start = input.start_date || localDate(new Date().toISOString(), timezone);
    const day = new Date(`${start}T00:00:00Z`).getUTCDay() || 7;
    if (input.deadline && input.deadline < start)
        throw new Error('The due date cannot be before the repeating start date.');
    const customDays = String(data.get('repeat_days') || '')
        .split(',')
        .filter(Boolean)
        .map(Number);
    if (repeat === 'custom' && !customDays.length)
        throw new Error('Choose at least one custom weekly day.');
    const response = await post('/api/v1/task-series', {
        name: input.name,
        description: input.description,
        completion_criteria: input.completion_criteria,
        importance: input.importance,
        goal_id: input.goal_id,
        milestone_id: input.milestone_id,
        frequency: ['weekdays', 'custom'].includes(repeat) ? 'weekly' : repeat,
        interval_count: Number(data.get('repeat_interval') || 1),
        weekdays:
            repeat === 'custom'
                ? customDays
                : repeat === 'weekdays'
                  ? [1, 2, 3, 4, 5]
                  : repeat === 'weekly'
                    ? [day]
                    : [],
        start_date: start,
        end_date: data.get('repeat_end') || null,
        timezone,
        deadline_offset_days: input.deadline
            ? Math.max(
                  0,
                  Math.round(
                      (new Date(`${input.deadline}T00:00:00Z`) - new Date(`${start}T00:00:00Z`)) /
                          86400000,
                  ),
              )
            : null,
        checklist: [],
        tag_ids: [],
        contribution_goal_ids: [],
    });
    return {
        ...response,
        payload: { ...response.payload, data: { ...response.payload.data, id: null } },
    };
}

export function initTaskCapturePresets(root = document) {
    root.querySelectorAll('[data-deadline-preset]').forEach((button) =>
        button.addEventListener('click', () => {
            const date = new Date(
                `${localDate(new Date().toISOString(), window.notesBootstrap.preferences.timezone)}T00:00:00Z`,
            );
            const offset =
                button.dataset.deadlinePreset === 'week'
                    ? 8 - (date.getUTCDay() || 7)
                    : Number(button.dataset.deadlinePreset);
            date.setUTCDate(date.getUTCDate() + offset);
            const input = button.closest('form').elements.deadline;
            input.value = date.toISOString().slice(0, 10);
            input.dispatchEvent(new Event('input', { bubbles: true }));
        }),
    );
    root.querySelectorAll('[data-reminder-preset]').forEach((button) =>
        button.addEventListener('click', () => {
            const date = new Date();
            if (button.dataset.reminderPreset === 'later') date.setHours(date.getHours() + 3);
            else {
                date.setDate(
                    date.getDate() +
                        (button.dataset.reminderPreset === 'week' ? 8 - (date.getDay() || 7) : 1),
                );
                date.setHours(9, 0, 0, 0);
            }
            const pad = (value) => String(value).padStart(2, '0');
            const input = button.closest('form').elements.reminder_at;
            input.value = `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}T${pad(date.getHours())}:${pad(date.getMinutes())}`;
            input.dispatchEvent(new Event('input', { bubbles: true }));
        }),
    );
}
