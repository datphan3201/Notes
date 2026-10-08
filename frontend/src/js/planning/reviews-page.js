import { get, patch, post } from '../lib/http.js';
import { renderEmptyState } from '../lib/empty-state.js';
import { renderRing, renderDayBars } from './insights-ui.js';
import { DraftBuffer } from './draft-buffer.js';
import { collectionPage, renderPagination } from './collection-page.js';
import {
    creationState,
    createWithForm,
    finishCreation,
    guardWorkspaceLeave,
    reportWorkspaceError,
} from '../lib/workspace-ui.js';

const fields = ['reflection', 'went_well', 'went_wrong', 'change_next'];
const valuesOf = (review) =>
    Object.fromEntries(fields.map((field) => [field, review[field] || '']));

export function initReviewsPage(root) {
    let current = null;
    let reviews = [];
    let page = 0;
    let pending = false;
    let conflict = null;
    let selectedButton = null;
    const drafts = new Map();
    const list = root.querySelector('[data-review-list]');
    const collection = root.querySelector('[data-review-collection]');
    const editor = root.querySelector('[data-review-editor]');
    const form = root.querySelector('[data-review-edit-form]');
    const createForm = root.querySelector('[data-review-create-form]');
    const filter = root.querySelector('[data-review-filter]');
    const state = root.querySelector('[data-review-state]');
    createForm.elements.date.value = new Date().toLocaleDateString('en-CA');
    creationState(createForm).markSaved();
    const buffer = () => current && drafts.get(current.id);
    guardWorkspaceLeave(() => pending || [...drafts.values()].some((draft) => draft.dirty));

    const updateControls = () => {
        const finalized = current?.status === 'Finalized';
        const dirty = buffer()?.dirty;
        state.textContent = pending
            ? 'Saving…'
            : dirty && finalized
              ? 'Finalized · your draft is preserved. Reopen to edit.'
              : dirty
                ? 'Unsaved changes · save before finalizing'
                : finalized
                  ? 'Finalized · read-only'
                  : 'Saved';
        for (const field of fields) form.elements[field].disabled = !current || finalized;
        form.querySelector('button[type="submit"]').disabled = pending || finalized || !!conflict;
        root.querySelector('[data-review-finalize]').disabled = pending || dirty || !!conflict;
        for (const action of ['refresh', 'reopen'])
            root.querySelector(`[data-review-${action}]`).disabled = pending || !!conflict;
        for (const action of ['finalize', 'refresh'])
            root.querySelector(`[data-review-${action}]`).classList.toggle('is-hidden', finalized);
        root.querySelector('[data-review-reopen]').classList.toggle('is-hidden', !finalized);
        root.querySelector('[data-review-back]').disabled = pending;
        const periods = reviews
            .filter((review) => review.kind === current?.kind)
            .sort((a, b) => a.period_start.localeCompare(b.period_start));
        const index = periods.findIndex((review) => review.id === current?.id);
        root.querySelector('[data-review-previous]').disabled = pending || !!conflict || index <= 0;
        root.querySelector('[data-review-next]').disabled =
            pending || !!conflict || index < 0 || index >= periods.length - 1;
    };
    const writeForm = () => {
        for (const field of fields) form.elements[field].value = buffer().values[field];
    };
    const display = (review) => {
        current = review;
        if (!drafts.has(review.id)) drafts.set(review.id, new DraftBuffer());
        buffer().receive(valuesOf(review), review.version);
        collection.hidden = true;
        editor.hidden = false;
        root.querySelector('[data-review-new]').hidden = true;
        root.querySelector('[data-review-heading]').textContent =
            `${review.kind} review · ${review.period_start} to ${review.period_end} · ${review.status}`;
        root.querySelector('[data-review-facts]').textContent =
            `${review.snapshot.activities.length} completed activities · Facts for this period`;
        root.querySelector('[data-review-period]').textContent =
            `${review.period_start} – ${review.period_end}`;
        const activities = review.snapshot.activities.filter((item) =>
            ['task', 'checklist', 'habit', 'milestone'].includes(item.source_type),
        );
        root.querySelector('[data-review-actions]').textContent = activities.length;
        const previous = review.snapshot.previous_activity_count;
        root.querySelector('[data-review-change]').textContent =
            previous == null
                ? 'Previous-period comparison unavailable'
                : `${activities.length - previous > 0 ? '+' : ''}${activities.length - previous} vs previous period`;
        const taskSummary = review.snapshot.task_summary;
        renderRing(
            root.querySelector('[data-review-ring]'),
            taskSummary?.total ? (taskSummary.completed / taskSummary.total) * 100 : null,
            'Finite tasks completed at fact capture',
        );
        root.querySelector('[data-review-task-denominator]').textContent = taskSummary
            ? taskSummary.total
                ? `${taskSummary.completed}/${taskSummary.total} finite tasks`
                : 'No tasks in period'
            : 'Snapshot unavailable';
        root.querySelector('[data-review-wins]').textContent = activities.filter((item) =>
            ['task', 'milestone'].includes(item.source_type),
        ).length;
        const counts = {};
        for (const activity of activities)
            counts[activity.effective_date] = (counts[activity.effective_date] || 0) + 1;
        renderDayBars(
            root.querySelector('[data-review-bars]'),
            review.period_start,
            review.period_end,
            counts,
        );
        const facts = root.querySelector('[data-review-fact-details]');
        facts.replaceChildren();
        const summary = document.createElement('p');
        summary.textContent = `Generated ${new Date(review.snapshot.generated_at).toLocaleString()} · ${review.timezone}. ${review.snapshot.overdue_tasks.length} overdue tasks. ${review.snapshot.goal_snapshots.length ? `${review.snapshot.goal_snapshots.length} goal snapshots available.` : 'Historical goal snapshots unavailable for this period.'}`;
        facts.append(summary);
        const entries = document.createElement('ul');
        for (const activity of review.snapshot.activities) {
            const item = document.createElement('li');
            const metadata =
                typeof activity.metadata === 'string'
                    ? JSON.parse(activity.metadata)
                    : activity.metadata;
            item.textContent = `${activity.effective_date} · ${metadata?.name || { task: 'Task', checklist: 'Checklist item', habit: 'Habit check-in', milestone: 'Milestone' }[activity.source_type] || 'Activity'} completed`;
            entries.append(item);
        }
        for (const task of review.snapshot.overdue_tasks) {
            const item = document.createElement('li');
            item.textContent = `${task.name} · due ${task.deadline} · ${task.status}`;
            entries.append(item);
        }
        facts.append(entries);
        writeForm();
        updateControls();
    };
    const render = () => {
        const items = reviews.filter(
            (review) => filter.value === 'all' || review.kind === filter.value,
        );
        const result = collectionPage(
            items.map((review) => ({ ...review, name: review.kind })),
            { page },
        );
        page = result.page;
        list.replaceChildren();
        renderPagination(root.querySelector('[data-review-pagination]'), result, (next) => {
            page = next;
            render();
        });
        for (const review of result.items) {
            const button = document.createElement('button');
            button.type = 'button';
            button.className = 'planning-list-item';
            const copy = document.createElement('strong');
            copy.textContent = `${review.kind} · ${review.period_start}`;
            const status = document.createElement('span');
            status.textContent = drafts.get(review.id)?.dirty
                ? `${review.status} · Unsaved changes`
                : review.status;
            button.append(copy, status);
            button.addEventListener('click', () => {
                selectedButton = review.id;
                display(review);
                root.querySelector('[data-review-heading]').focus();
            });
            button.dataset.reviewId = review.id;
            list.append(button);
        }
        if (!result.total)
            renderEmptyState(list, {
                title: 'Take a moment to look back.',
                description:
                    'Capture facts and reflections for a daily, weekly, or monthly period.',
                icon: 'reviews',
                href: '#review-kind',
                action: 'Start a review',
            });
    };
    const load = async () => {
        try {
            reviews = (await get('/api/v1/reviews')).payload.data;
            render();
            if (current) updateControls();
        } catch (error) {
            reportWorkspaceError(root, error);
        }
    };
    const showConflict = async (error) => {
        // The existing API checks finalized status before optimistic version on
        // edits. Reconcile that stale read explicitly rather than losing text.
        if (error.status === 422 && error.payload?.errors?.status) {
            try {
                const latest = (await get(`/api/v1/reviews/${current.id}`)).payload.data;
                if (latest.status === 'Finalized' && latest.version !== buffer().version) {
                    conflict = latest;
                    root.querySelector('[data-review-conflict]').classList.remove('is-hidden');
                }
            } catch {
                /* The original failure remains visible and the draft stays local. */
            }
        }
        if (error.status === 409 && error.payload?.current) {
            conflict = error.payload.current;
            root.querySelector('[data-review-conflict]').classList.remove('is-hidden');
        }
        reportWorkspaceError(root, error);
    };
    for (const [selector, offset] of [
        ['[data-review-previous]', -1],
        ['[data-review-next]', 1],
    ])
        root.querySelector(selector).addEventListener('click', () => {
            if (pending || conflict) return;
            const periods = reviews
                .filter((review) => review.kind === current.kind)
                .sort((a, b) => a.period_start.localeCompare(b.period_start));
            const next = periods[periods.findIndex((review) => review.id === current.id) + offset];
            if (next) display(next);
        });
    filter.addEventListener('change', () => {
        page = 0;
        render();
    });
    root.querySelector('[data-review-back]').addEventListener('click', () => {
        if (pending) return;
        editor.hidden = true;
        collection.hidden = false;
        root.querySelector('[data-review-new]').hidden = false;
        root.querySelector('[data-review-conflict]').classList.add('is-hidden');
        root.querySelector('[data-planning-error]').classList.add('is-hidden');
        conflict = null;
        render();
        const button = [...list.querySelectorAll('[data-review-id]')].find(
            (item) => item.dataset.reviewId === selectedButton,
        );
        (button || root.querySelector('[data-review-new]')).focus();
    });
    form.addEventListener('input', () => {
        if (!current) return;
        buffer().values = Object.fromEntries(
            fields.map((field) => [field, form.elements[field].value]),
        );
        updateControls();
    });
    createForm.addEventListener('submit', (event) => {
        event.preventDefault();
        const data = new FormData(createForm);
        createWithForm(createForm, async () => {
            try {
                const { payload } = await post('/api/v1/reviews', {
                    kind: data.get('kind'),
                    date: data.get('date'),
                });
                finishCreation(createForm);
                display(payload.data);
                root.querySelector('[data-review-heading]').focus();
                load();
            } catch (error) {
                reportWorkspaceError(root, error);
            }
        });
    });
    form.addEventListener('submit', async (event) => {
        event.preventDefault();
        if (!current || pending || conflict) return;
        pending = true;
        updateControls();
        const submitted = { ...buffer().values };
        try {
            const { payload } = await patch(`/api/v1/reviews/${current.id}`, buffer().freeze());
            buffer().acknowledge(valuesOf(payload.data), payload.data.version, submitted);
            display(payload.data);
            await load();
        } catch (error) {
            await showConflict(error);
        } finally {
            pending = false;
            updateControls();
        }
    });
    for (const action of ['refresh', 'finalize', 'reopen'])
        root.querySelector(`[data-review-${action}]`).addEventListener('click', async () => {
            if (!current || pending || conflict || (action === 'finalize' && buffer().dirty))
                return;
            pending = true;
            updateControls();
            if (action === 'finalize')
                for (const field of fields) form.elements[field].disabled = true;
            try {
                const { payload } = await post(`/api/v1/reviews/${current.id}/${action}`, {
                    base_version: buffer().version,
                });
                // Our facts-only mutation acknowledges a new base without replacing
                // text typed before or during the request.
                buffer().receive(valuesOf(payload.data), payload.data.version, { keepDraft: true });
                display(payload.data);
                await load();
            } catch (error) {
                await showConflict(error);
            } finally {
                pending = false;
                updateControls();
            }
        });
    for (const [selector, keepDraft] of [
        ['[data-review-use-saved]', false],
        ['[data-review-keep-draft]', true],
    ])
        root.querySelector(selector).addEventListener('click', () => {
            if (!conflict) return;
            if (!keepDraft) buffer().values = { ...buffer().saved };
            buffer().receive(valuesOf(conflict), conflict.version, { keepDraft });
            const latest = conflict;
            conflict = null;
            root.querySelector('[data-review-conflict]').classList.add('is-hidden');
            root.querySelector('[data-planning-error]').classList.add('is-hidden');
            display(latest);
        });
    load();
}
