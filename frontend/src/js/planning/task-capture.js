import { post } from '../lib/http.js';
import { t } from '../lib/i18n.js';
import { repeatRule } from '../lib/calendar.js';
import { localDate } from './task-views.js';
import { initScheduleToolbar } from './schedule-picker.js';

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

/** The repeat choice stored in a capture form's hidden fields. */
export function captureRepeatChoice(data) {
    const kind = data.get('repeat_frequency');
    if (!kind) return null;
    return {
        kind,
        unit: data.get('repeat_unit') || 'weekly',
        interval: Number(data.get('repeat_interval') || 1),
        weekdays: String(data.get('repeat_days') || '')
            .split(',')
            .filter(Boolean)
            .map(Number),
        end: data.get('repeat_end') || null,
    };
}

export function seriesPayload(input, choice, start) {
    if (input.deadline && input.deadline < start)
        throw new Error(t('The due date cannot be before the repeating start date.'));
    return {
        name: input.name,
        description: input.description,
        completion_criteria: input.completion_criteria,
        importance: input.importance,
        goal_id: input.goal_id,
        milestone_id: input.milestone_id,
        ...repeatRule(choice, start),
        start_date: start,
        end_date: choice.end || null,
        timezone: window.notesBootstrap.preferences.timezone,
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
    };
}

export async function createCapturedTask(data, input) {
    const choice = captureRepeatChoice(data);
    if (!choice) return post('/api/v1/tasks', input);
    if (input.reminder_at)
        throw new Error(
            t('Set a reminder on the generated task after creating the repeating series.'),
        );
    const start =
        input.start_date ||
        localDate(new Date().toISOString(), window.notesBootstrap.preferences.timezone);
    const response = await post('/api/v1/task-series', seriesPayload(input, choice, start));
    return {
        ...response,
        payload: { ...response.payload, data: { ...response.payload.data, id: null } },
    };
}

/** Binds every capture form's schedule toolbar (Tasks, Goal and Milestone dialogs). */
export function initTaskCapturePresets(root = document) {
    const today = () =>
        localDate(new Date().toISOString(), window.notesBootstrap?.preferences?.timezone || 'UTC');
    root.querySelectorAll('[data-schedule-toolbar]').forEach((toolbar) =>
        initScheduleToolbar(toolbar.closest('form'), today),
    );
}
