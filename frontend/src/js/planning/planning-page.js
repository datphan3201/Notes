import { referenceDecoration } from '../settings/reference-decoration.js';
import { get, patch, post } from '../lib/http.js';
import { renderEmptyState } from '../lib/empty-state.js';
import { LatestRequest } from '../lib/read-coordinator.js';
import { transitionEntity } from './transitions.js';
import { DraftBuffer } from './draft-buffer.js';
import { collectionPage, renderPagination } from './collection-page.js';
import { localDate, taskMatchesView, resourceLinks } from './task-views.js';
import {
    creationState,
    createWithForm,
    finishCreation,
    guardWorkspaceLeave,
    reportWorkspaceError,
} from '../lib/workspace-ui.js';
export { initGoalDetail } from './goal-roadmap.js';

export function buildGoalForest(goals) {
    const nodes = new Map(goals.map((goal) => [goal.id, { ...goal, children: [] }]));
    const roots = [];

    for (const node of nodes.values()) {
        if (node.parent_goal_id && nodes.has(node.parent_goal_id)) {
            nodes.get(node.parent_goal_id).children.push(node);
        } else {
            roots.push(node);
        }
    }

    return { roots, nodes };
}

function showError(root, error) {
    reportWorkspaceError(root, error);
}

function linkForGoal(goal) {
    const link = document.createElement('a');
    link.href = `/goals/${encodeURIComponent(goal.id)}`;
    link.className = 'planning-item-link';
    const name = document.createElement('strong');
    name.textContent = goal.name;
    const progress = document.createElement('span');
    progress.textContent = `${goal.progress ?? 0}%`;
    link.append(name, progress);
    return link;
}

function renderGoalTree(container, areas, goals) {
    container.replaceChildren();
    const { nodes } = buildGoalForest(goals);

    for (const [areaIndex, area] of areas.entries()) {
        const section = document.createElement('details');
        section.className = 'goal-area-group';
        const heading = document.createElement('summary');
        const badge = document.createElement('span');
        badge.className = 'area-icon';
        badge.style.setProperty('--area-hue', [168, 268, 41][areaIndex % 3]);
        const icon = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
        icon.classList.add('ui-icon');
        icon.setAttribute('aria-hidden', 'true');
        const use = document.createElementNS('http://www.w3.org/2000/svg', 'use');
        use.setAttribute('href', '#icon-goals');
        icon.append(use);
        badge.append(icon);
        const title = document.createElement('strong');
        title.textContent = area.name;
        title.className = 'area-title';
        heading.append(badge, title);
        const rootsForArea = goals.filter(
            (goal) => goal.area_id === area.id && !goal.parent_goal_id,
        );
        const progress = rootsForArea.length
            ? Math.round(
                  rootsForArea.reduce((sum, goal) => sum + (goal.progress || 0), 0) /
                      rootsForArea.length,
              )
            : 0;
        const count = document.createElement('span');
        count.className = 'subtle-copy';
        count.textContent = `${rootsForArea.length} goals · ${progress}% average goal progress`;
        const track = document.createElement('span');
        track.className = 'progress-track';
        const fill = document.createElement('i');
        fill.style.setProperty('--progress', `${progress}%`);
        track.append(fill);
        heading.append(count, track);
        const list = document.createElement('ul');
        list.className = 'goal-tree';
        section.append(heading, list);
        container.append(section);
        const roots = goals.filter((goal) => goal.area_id === area.id);
        if (!roots.length) {
            const empty = document.createElement('li');
            empty.className = 'goal-area-empty';
            empty.textContent = 'Room for a new goal.';
            list.append(empty);
        }
        const stack = roots
            .slice()
            .reverse()
            .map((goal) => ({ node: nodes.get(goal.id), list }));

        while (stack.length) {
            const { node, list: parentList } = stack.pop();
            const item = document.createElement('li');
            item.append(linkForGoal(node));
            parentList.append(item);
            if (node.children.length) {
                const childList = document.createElement('ul');
                const details = document.createElement('details');
                const summary = document.createElement('summary');
                summary.append(item.firstChild);
                details.append(summary, childList);
                item.append(details);
                for (const child of node.children.slice().reverse()) {
                    stack.push({ node: child, list: childList });
                }
            }
        }
    }
}

export function initGoalsPage(root) {
    const areaList = root.querySelector('[data-area-list]');
    const tree = root.querySelector('[data-goal-tree]');
    const areaSelect = root.querySelector('[data-goal-area]');
    const form = root.querySelector('[data-goal-create-form]');
    let areas = [];
    const areaDrafts = new Map();
    let renamingArea = false;
    guardWorkspaceLeave(() => areaDrafts.size > 0 || renamingArea);

    const load = async () => {
        try {
            const [areaResponse, goalResponse] = await Promise.all([
                get('/api/v1/areas'),
                get('/api/v1/goals'),
            ]);
            areas = areaResponse.payload.data;
            const selectedArea = areaSelect.value;
            const hadDraft = creationState(form).dirty;
            areaList.replaceChildren();
            areaSelect.replaceChildren();
            for (const area of areas) {
                const row = document.createElement('form');
                row.className = 'area-rename-row';
                const input = document.createElement('input');
                input.value = areaDrafts.get(area.id) ?? area.name;
                input.addEventListener('input', () => {
                    if (input.value === area.name) areaDrafts.delete(area.id);
                    else areaDrafts.set(area.id, input.value);
                });
                input.maxLength = 80;
                input.setAttribute('aria-label', `Rename ${area.name}`);
                const button = document.createElement('button');
                button.type = 'submit';
                button.className = 'button button-quiet';
                button.textContent = 'Save name';
                row.append(input, button);
                row.addEventListener('submit', async (event) => {
                    event.preventDefault();
                    if (renamingArea) return;
                    renamingArea = true;
                    row.setAttribute('aria-busy', 'true');
                    button.disabled = true;
                    const submittedName = input.value;
                    try {
                        await patch(`/api/v1/areas/${area.id}`, {
                            name: submittedName,
                            base_version: area.version,
                        });
                        if (areaDrafts.get(area.id) === submittedName) areaDrafts.delete(area.id);
                        await load();
                    } catch (error) {
                        showError(root, error);
                    } finally {
                        renamingArea = false;
                        row.setAttribute('aria-busy', 'false');
                        button.disabled = false;
                    }
                });
                areaList.append(row);
                const option = document.createElement('option');
                option.value = area.id;
                option.textContent = area.name;
                areaSelect.append(option);
            }
            if (areas.some((area) => area.id === selectedArea)) areaSelect.value = selectedArea;
            if (!hadDraft) creationState(form).markSaved();
            const goals = goalResponse.payload.data;
            renderGoalTree(tree, areas, goals);
            const main = root.querySelector('[data-main-goal]');
            main.replaceChildren();
            const primary = goals
                .filter((goal) => !goal.parent_goal_id && goal.status !== 'Completed')
                .sort((a, b) => b.importance - a.importance)[0];
            if (primary) {
                const card = document.createElement('a');
                card.className = 'main-goal-card scene-card';
                card.href = `/goals/${primary.id}`;
                card.append(referenceDecoration('summit'));
                const label = document.createElement('span');
                label.className = 'context-chip';
                label.textContent = '★ Main goal';
                const name = document.createElement('h2');
                name.textContent = primary.name;
                const description = document.createElement('p');
                description.textContent =
                    primary.expected_result ||
                    primary.description ||
                    'Turn knowledge into real-world impact.';
                const progress = document.createElement('strong');
                progress.textContent = `${primary.status} · ${primary.progress}%`;
                const track = document.createElement('span');
                track.className = 'progress-track';
                const fill = document.createElement('i');
                fill.style.setProperty('--progress', `${primary.progress}%`);
                track.append(fill);
                card.append(label, name, description, progress, track);
                main.append(card);
            }
            const timeline = root.querySelector('[data-goal-timeline]');
            timeline.replaceChildren();
            for (const goal of goals
                .slice()
                .sort((a, b) => (a.deadline || '9999').localeCompare(b.deadline || '9999'))) {
                const row = document.createElement('div');
                row.className = 'goal-timeline-item';
                const date = document.createElement('time');
                date.textContent = goal.deadline || 'Unplanned';
                if (goal.deadline) date.dateTime = goal.deadline;
                row.append(date, linkForGoal(goal));
                timeline.append(row);
            }
            if (!goals.length)
                timeline.textContent = 'Goals with and without deadlines appear here.';
            const errorOutput = root.querySelector('[data-planning-error]');
            errorOutput.textContent = '';
            errorOutput.classList.add('is-hidden');
        } catch (error) {
            showError(root, error);
            tree.textContent = 'Unable to load the Goal hierarchy.';
        }
    };

    form.addEventListener('submit', (event) => {
        event.preventDefault();
        const data = new FormData(form);
        createWithForm(form, async () => {
            try {
                await post('/api/v1/goals', {
                    area_id: data.get('area_id'),
                    parent_goal_id: null,
                    name: data.get('name'),
                    expected_result: data.get('expected_result'),
                    completion_criteria: data.get('completion_criteria'),
                });
                form.reset();
                areaSelect.value = data.get('area_id');
                finishCreation(form);
                load();
            } catch (error) {
                showError(root, error);
            }
        });
    });
    const areaForm = root.querySelector('[data-area-create-form]');
    areaForm.addEventListener('submit', (event) => {
        event.preventDefault();
        const name = areaForm.elements.name.value;
        createWithForm(areaForm, async () => {
            try {
                await post('/api/v1/areas', { name });
                areaForm.reset();
                creationState(areaForm).markSaved();
                await load();
            } catch (error) {
                showError(root, error);
            }
        });
    });
    root.querySelectorAll('[data-goals-view]').forEach((button) =>
        button.addEventListener('click', () => {
            const timeline = button.dataset.goalsView === 'timeline';
            root.querySelector('[data-goal-timeline]').hidden = !timeline;
            root.querySelector('[data-goal-areas-view]').hidden = timeline;
            root.querySelector('[data-goals-expand]').hidden = timeline;
            root.querySelectorAll('[data-goals-view]').forEach((item) =>
                item.setAttribute('aria-pressed', String(item === button)),
            );
        }),
    );
    root.querySelector('[data-goals-expand]').addEventListener('click', (event) => {
        const details = [...tree.querySelectorAll('details')];
        const expand = details.some((item) => !item.open);
        details.forEach((item) => {
            item.open = expand;
        });
        event.currentTarget.textContent = expand ? 'Collapse all' : 'Expand all';
    });
    root.querySelector('[data-planning-retry]')?.addEventListener('click', load);
    load();
}

export function initTasksPage(root) {
    const list = root.querySelector('[data-task-list]');
    const form = root.querySelector('[data-task-create-form]');
    let tasks = [];
    const requestedView = new URLSearchParams(location.search).get('view');
    let taskView = ['today', 'next', 'week', 'backlog', 'all'].includes(requestedView)
        ? requestedView
        : 'today';
    let today = localDate(new Date().toISOString(), window.notesBootstrap.preferences.timezone);
    let selectedIds = new Set();
    let parentOptions = new Map();
    const parent = root.querySelector('[data-task-parent]');
    let page = 0;
    let revealTaskId = null;
    const reads = new LatestRequest();
    const search = root.querySelector('[data-task-search]');
    const status = root.querySelector('[data-task-status]');
    const narrow = window.matchMedia('(max-width: 600px)');
    let size = narrow.matches ? 4 : 8;
    const render = () => {
        root.querySelector('.task-filter-details summary').textContent =
            `Filter and search · ${status.selectedOptions[0].textContent}${search.value.trim() ? ' · Search active' : ''}`;
        const timezone = window.notesBootstrap.preferences.timezone;
        for (const button of root.querySelectorAll('[data-task-view]')) {
            button.setAttribute('aria-pressed', String(button.dataset.taskView === taskView));
            const count = collectionPage(
                tasks.filter((task) =>
                    taskMatchesView(task, button.dataset.taskView, today, timezone, selectedIds),
                ),
                { query: search.value, status: status.value },
            ).total;
            button.querySelector('[data-task-view-count]').textContent = count;
        }
        const result = collectionPage(
            tasks.filter((task) => taskMatchesView(task, taskView, today, timezone, selectedIds)),
            {
                query: search.value,
                status: status.value,
                page,
                size,
            },
        );
        page = result.page;
        list.replaceChildren();
        renderPagination(root.querySelector('[data-task-pagination]'), result, (next) => {
            page = next;
            render();
        });
        if (!result.total)
            renderEmptyState(list, {
                title: tasks.length ? 'No matching tasks.' : 'Start with one small step.',
                description: tasks.length
                    ? 'Try another name or status.'
                    : 'Capture a task now and add details when you need them.',
                ...(tasks.length ? {} : { href: '#task-name', action: 'Add your first task' }),
            });
        for (const task of result.items) {
            const article = document.createElement('article');
            article.className = 'planning-list-item';
            const copy = document.createElement('div');
            const name = document.createElement('a');
            name.href = `/tasks/${encodeURIComponent(task.id)}`;
            name.textContent = task.name;
            const status = document.createElement('small');
            status.textContent = `${task.status.replace(/([a-z])([A-Z])/g, '$1 $2')}${task.deadline ? ` · Due ${task.deadline}` : ''}${task.estimated_minutes ? ` · ${task.estimated_minutes} min` : ''}`;
            const context =
                parentOptions.get(`milestone:${task.milestone_id}`) ||
                parentOptions.get(`goal:${task.goal_id}`);
            if (context) {
                const chip = document.createElement('span');
                chip.className = 'context-chip';
                chip.textContent = context.name;
                copy.append(chip);
            }
            copy.append(name, status);
            const action = document.createElement('button');
            action.className = 'button button-quiet';
            action.type = 'button';
            action.textContent = task.status === 'Done' ? 'Reopen' : 'Complete';
            action.addEventListener('click', async () => {
                action.disabled = true;
                try {
                    if (
                        await transitionEntity(
                            'task',
                            task,
                            task.status === 'Done' ? 'reopen' : 'complete',
                        )
                    ) {
                        await load();
                    }
                } catch (error) {
                    showError(root, error);
                } finally {
                    action.disabled = false;
                }
            });
            const week = document.createElement('button');
            week.className = 'button button-quiet';
            week.type = 'button';
            week.textContent = selectedIds.has(task.id) ? 'Selected this week' : 'Select for week';
            week.disabled = selectedIds.has(task.id);
            week.addEventListener('click', async () => {
                week.disabled = true;
                try {
                    await post('/api/v1/weekly-selections/task', { id: task.id, position: 0 });
                    selectedIds.add(task.id);
                    render();
                } catch (error) {
                    showError(root, error);
                } finally {
                    week.disabled = false;
                }
            });
            const actions = document.createElement('div');
            actions.className = 'action-row';
            actions.append(week, action);
            article.append(copy, actions);
            list.append(article);
        }
    };
    const load = async () => {
        const ticket = reads.begin();
        try {
            const [response, dashboard, goals, milestones] = await Promise.all([
                get('/api/v1/tasks', { signal: ticket.signal }),
                get('/api/v1/dashboard', { signal: ticket.signal }),
                get('/api/v1/goals', { signal: ticket.signal }),
                get('/api/v1/milestones', { signal: ticket.signal }),
            ]);
            if (!reads.isCurrent(ticket)) return;
            tasks = response.payload.data;
            today = dashboard.payload.data.today;
            selectedIds = new Set(dashboard.payload.data.selected_tasks.map((task) => task.id));
            const parentValue = parent.value;
            const previousParent = parentOptions.get(parentValue);
            parentOptions = new Map();
            parent.replaceChildren(new Option('Inbox · organize later', ''));
            for (const [type, items] of [
                ['goal', goals.payload.data],
                ['milestone', milestones.payload.data],
            ]) {
                for (const item of items) {
                    const key = `${type}:${item.id}`;
                    if (item.status === 'Completed' && key !== parentValue) continue;
                    parentOptions.set(key, item);
                    parent.add(
                        new Option(
                            `${item.status === 'Completed' ? 'Completed · ' : ''}${type === 'goal' ? 'Goal' : 'Milestone'} · ${item.name}`,
                            key,
                        ),
                    );
                }
            }
            if (previousParent && !parentOptions.has(parentValue)) {
                parentOptions.set(parentValue, { ...previousParent, unavailable: true });
                parent.add(
                    new Option(`Selected parent unavailable · ${previousParent.name}`, parentValue),
                );
            }
            parent.value = parentOptions.has(parentValue) ? parentValue : '';
            if (!creationState(form).dirty) creationState(form).markSaved();
            if (revealTaskId) {
                const index = tasks
                    .filter((task) => task.status !== 'Done')
                    .findIndex((task) => task.id === revealTaskId);
                if (index >= 0) {
                    page = Math.floor(index / size);
                    revealTaskId = null;
                }
            }
            render();
        } catch (error) {
            if (reads.shouldIgnore(ticket, error)) return;
            showError(root, error);
            list.textContent = 'Unable to load Tasks.';
        }
    };
    narrow.addEventListener('change', () => {
        const first = page * size;
        size = narrow.matches ? 4 : 8;
        page = Math.floor(first / size);
        render();
    });
    for (const button of root.querySelectorAll('[data-task-view]'))
        button.addEventListener('click', () => {
            taskView = button.dataset.taskView;
            page = 0;
            render();
        });
    parent.addEventListener('change', () => {
        const selected = parentOptions.get(parent.value);
        const output = root.querySelector('[data-task-parent-context]');
        if (selected?.unavailable) {
            output.textContent = `${selected.name} is unavailable. Choose another parent to create this task.`;
            return;
        }
        if (!selected) {
            output.textContent = 'Capture now; choose a home later.';
            return;
        }
        if (parent.value.startsWith('goal:'))
            output.textContent = `${selected.name} · ${selected.progress}% goal progress`;
        else {
            const goal = parentOptions.get(`goal:${selected.goal_id}`);
            output.textContent = `${goal ? `${goal.name} › ` : ''}${selected.name} · ${selected.progress.completed}/${selected.progress.total} finite tasks completed`;
        }
    });
    root.querySelectorAll('[data-capture-suggestions] button').forEach((button) =>
        button.addEventListener('click', () => {
            const control = form.elements[button.parentElement.dataset.captureSuggestions];
            control.value = control.value
                ? `${control.value}${control.tagName === 'TEXTAREA' ? '\n' : ' · '}${button.textContent}`
                : button.textContent;
            control.dispatchEvent(new Event('input', { bubbles: true }));
            control.focus();
        }),
    );
    search.addEventListener('input', () => {
        page = 0;
        render();
    });
    status.addEventListener('change', () => {
        page = 0;
        render();
    });
    form.addEventListener('submit', (event) => {
        event.preventDefault();
        const data = new FormData(form);
        createWithForm(form, async () => {
            try {
                const response = await post('/api/v1/tasks', {
                    goal_id: String(data.get('parent')).startsWith('goal:')
                        ? String(data.get('parent')).slice(5)
                        : null,
                    milestone_id: String(data.get('parent')).startsWith('milestone:')
                        ? String(data.get('parent')).slice(10)
                        : null,
                    name: data.get('name'),
                    completion_criteria: data.get('completion_criteria'),
                });
                revealTaskId = response.payload.data.id;
                form.reset();
                finishCreation(form);
                search.value = '';
                status.value = 'open';
                taskView = 'all';
                page = 0;
                load();
            } catch (error) {
                showError(root, error);
            }
        });
    });
    root.querySelector('[data-planning-retry]')?.addEventListener('click', load);
    load();
}

export function initTaskDetail(root) {
    const id = root.dataset.taskId;
    const reads = new LatestRequest();
    let task = null;
    let note = null;
    let checklist = [];
    const draft = new DraftBuffer();
    const editDraft = new DraftBuffer();
    let editConflict = null;
    let editDeepLinkPending = location.hash === '#edit';
    const noteCard = root.querySelector('[data-task-note-card]');
    const noteHome = root.querySelector('[data-note-overview-host]');
    const notePanel = root.querySelector('#task-panel-notes');
    if (noteCard && noteHome && notePanel) {
        const placeNote = () => {
            (notePanel.hidden ? noteHome : notePanel).append(noteCard);
            noteCard.querySelector('[data-task-note-heading]').textContent = notePanel.hidden
                ? 'Quick notes'
                : 'Working notes';
            noteCard.querySelector('textarea').rows = notePanel.hidden ? 4 : 8;
        };
        placeNote();
        new MutationObserver(placeNote).observe(notePanel, {
            attributes: true,
            attributeFilter: ['hidden'],
        });
    }
    const editForm = root.querySelector('[data-task-edit-form]');
    for (const control of editForm.elements) control.disabled = true;
    const editFields = [
        'name',
        'description',
        'completion_criteria',
        'expected_result',
        'importance',
        'estimated_minutes',
        'status',
        'start_date',
        'deadline',
        'scheduled_start',
        'scheduled_end',
    ];
    const editValues = (value) =>
        Object.fromEntries(
            editFields.map((field) => [
                field,
                ['scheduled_start', 'scheduled_end'].includes(field)
                    ? (value[field] || '').slice(0, 16)
                    : String(value[field] ?? ''),
            ]),
        );
    const writeEdit = () => {
        for (const field of editFields) editForm.elements[field].value = editDraft.values[field];
        creationState(editForm).markSaved();
    };
    editForm.addEventListener('input', () => {
        editDraft.values = Object.fromEntries(
            editFields.map((field) => [field, editForm.elements[field].value]),
        );
    });
    guardWorkspaceLeave(() => editDraft.dirty);
    const renderResources = () => {
        const list = root.querySelector('[data-task-resources]');
        list.replaceChildren();
        for (const url of resourceLinks(body.value)) {
            const link = document.createElement('a');
            link.href = url;
            link.textContent = url;
            link.target = '_blank';
            link.rel = 'noopener noreferrer';
            list.append(link);
        }
        if (!list.childNodes.length) list.textContent = 'Links in your working note appear here.';
    };
    let savingNote = false;
    let noteConflict = null;
    const noteForm = root.querySelector('[data-task-note-form]');
    const body = noteForm.elements.body;
    body.disabled = true;
    noteForm.querySelector('button').disabled = true;
    const noteState = root.querySelector('[data-task-note-state]');
    const updateNoteState = () => {
        noteState.textContent = savingNote
            ? 'Saving…'
            : draft.dirty
              ? 'Unsaved changes'
              : draft.version
                ? 'Saved'
                : 'No note yet';
    };
    body.addEventListener('input', () => {
        draft.values = { body: body.value };
        updateNoteState();
        renderResources();
    });
    guardWorkspaceLeave(() => draft.dirty || savingNote);
    const error = (reason) => showError(root, reason);

    const load = async () => {
        const ticket = reads.begin();
        try {
            const [taskResponse, checklistResponse, noteResponse, selectionsResponse] =
                await Promise.all([
                    get(`/api/v1/tasks/${encodeURIComponent(id)}`, { signal: ticket.signal }),
                    get(`/api/v1/tasks/${encodeURIComponent(id)}/checklist`, {
                        signal: ticket.signal,
                    }),
                    get(`/api/v1/tasks/${encodeURIComponent(id)}/note`, { signal: ticket.signal }),
                    get('/api/v1/weekly-selections/task', { signal: ticket.signal }),
                ]);
            if (!reads.isCurrent(ticket)) return;
            task = taskResponse.payload.data;
            checklist = checklistResponse.payload.data;
            if (editDraft.receive(editValues(task), task.version)) writeEdit();
            for (const control of editForm.elements)
                control.disabled = creationState(editForm).pending;
            editForm.querySelector('[type="submit"]').disabled =
                !!editConflict || creationState(editForm).pending;
            root.querySelector('[data-task-edit-open]').disabled = false;
            root.querySelector('[data-task-estimate]').textContent = task.estimated_minutes
                ? `${task.estimated_minutes} minutes`
                : 'Not estimated';
            if (editDeepLinkPending) {
                editDeepLinkPending = false;
                if (!editForm.closest('dialog').open)
                    root.querySelector('[data-task-edit-open]').click();
            }
            note = noteResponse.payload.data;
            root.querySelector('[data-task-name]').textContent = task.name;
            root.querySelector('[data-task-meta]').textContent =
                `${task.status.replace(/([a-z])([A-Z])/g, '$1 $2')} · Importance ${task.importance}/5${task.deadline ? ` · Due ${task.deadline}` : ''}`;
            root.querySelector('[data-task-description]').textContent = task.description || '—';
            root.querySelector('[data-task-result]').textContent = task.expected_result || '—';
            root.querySelector('[data-task-criteria]').textContent =
                task.completion_criteria || '—';
            const transition = root.querySelector('[data-task-transition]');
            transition.disabled = false;
            const selected = selectionsResponse.payload.data.some((item) => item.id === id);
            root.querySelector('[data-task-week]').disabled = selected;
            root.querySelector('[data-task-week]').textContent = selected
                ? '✓ Selected this week'
                : 'Select for this week';
            transition.textContent = task.status === 'Done' ? 'Reopen' : 'Complete';
            const list = root.querySelector('[data-task-checklist]');
            list.replaceChildren();
            for (const item of checklist) {
                const label = document.createElement('label');
                label.className = 'check-row checklist-row';
                const checkbox = document.createElement('input');
                checkbox.type = 'checkbox';
                checkbox.checked = item.checked;
                checkbox.addEventListener('change', async () => {
                    checkbox.disabled = true;
                    try {
                        await patch(`/api/v1/tasks/${id}/checklist/${item.id}`, {
                            base_version: item.version,
                            checked: checkbox.checked,
                        });
                        await load();
                    } catch (reason) {
                        checkbox.checked = !checkbox.checked;
                        error(reason);
                    } finally {
                        checkbox.disabled = false;
                    }
                });
                const title = document.createElement('span');
                title.textContent = item.title;
                label.append(checkbox, title);
                list.append(label);
            }
            if (!checklist.length) list.textContent = 'No checklist items yet.';
            if (draft.receive({ body: note?.body || '' }, note?.version || null))
                body.value = draft.values.body;
            body.disabled = false;
            noteForm.querySelector('button').disabled = !!noteConflict || savingNote;
            updateNoteState();
            renderResources();
            const context = root.querySelector('[data-task-context]');
            if (!context.childNodes.length) {
                try {
                    const milestone = task.milestone_id
                        ? (await get(`/api/v1/milestones/${task.milestone_id}`)).payload.data
                        : null;
                    const goalId = milestone?.goal_id || task.goal_id;
                    if (goalId) {
                        const goal = (await get(`/api/v1/goals/${goalId}`)).payload.data;
                        const link = document.createElement('a');
                        link.href = `/goals/${goalId}${milestone ? `#milestone=${milestone.id}` : ''}`;
                        link.textContent = `${goal.name}${milestone ? ` / ${milestone.name}` : ''}`;
                        context.append(link);
                    } else context.textContent = 'Inbox task';
                } catch {
                    context.textContent = 'Task context unavailable';
                }
            }
        } catch (reason) {
            if (reads.shouldIgnore(ticket, reason)) return;
            error(reason);
        }
    };

    editForm.addEventListener('submit', (event) => {
        event.preventDefault();
        if (!task || editConflict) return;
        const submitted = { ...editDraft.values };
        const input = {
            ...Object.fromEntries(
                editFields
                    .filter((field) => submitted[field] !== editDraft.saved[field])
                    .map((field) => [field, submitted[field]]),
            ),
            base_version: editDraft.version,
        };
        if ('importance' in input) input.importance = Number(input.importance);
        if ('estimated_minutes' in input)
            input.estimated_minutes = input.estimated_minutes
                ? Number(input.estimated_minutes)
                : null;
        for (const field of ['start_date', 'deadline'])
            if (field in input) input[field] = input[field] || null;
        for (const field of ['scheduled_start', 'scheduled_end'])
            if (field in input)
                input[field] = input[field] ? new Date(`${input[field]}Z`).toISOString() : null;
        if (input.status === 'Done') delete input.status;
        createWithForm(editForm, async () => {
            try {
                const result = await patch(`/api/v1/tasks/${id}`, input);
                editDraft.acknowledge(
                    editValues(result.payload.data),
                    result.payload.data.version,
                    submitted,
                );
                writeEdit();
                finishCreation(editForm);
                await load();
            } catch (reason) {
                if (reason.status === 409 && reason.payload?.current) {
                    editConflict = reason.payload.current;
                    root.querySelector('[data-task-edit-conflict]').classList.remove('is-hidden');
                }
                error(reason);
            }
        });
    });
    for (const [selector, keepDraft] of [
        ['[data-task-edit-use-saved]', false],
        ['[data-task-edit-keep-draft]', true],
    ])
        root.querySelector(selector).addEventListener('click', () => {
            if (!editConflict) return;
            if (!keepDraft) editDraft.values = { ...editDraft.saved };
            editDraft.receive(editValues(editConflict), editConflict.version, { keepDraft });
            task = editConflict;
            editConflict = null;
            writeEdit();
            root.querySelector('[data-task-edit-conflict]').classList.add('is-hidden');
            root.querySelector('[data-dialog-error]').classList.add('is-hidden');
            editForm.querySelector('[type="submit"]').disabled = false;
            load();
        });
    root.querySelector('[data-workspace-tab="related"]').addEventListener('click', async () => {
        renderResources();
        const container = root.querySelector('[data-task-related]');
        try {
            const related = (await get(`/api/v1/tasks/${id}/contributions`)).payload.data;
            container.replaceChildren();
            for (const goal of related) {
                const link = document.createElement('a');
                link.className = 'planning-item-link';
                link.href = `/goals/${goal.goal_id || goal.target_goal_id || goal.id}`;
                link.textContent = goal.name || goal.goal_name || 'Contributing goal';
                container.append(link);
            }
            if (!related.length)
                container.textContent =
                    'No additional goal contributions. Your task’s primary context is shown above.';
        } catch (reason) {
            error(reason);
        }
    });
    root.querySelector('[data-checklist-form]').addEventListener('submit', async (event) => {
        event.preventDefault();
        const form = event.currentTarget;
        const data = new FormData(form);
        try {
            await post(`/api/v1/tasks/${id}/checklist`, {
                title: data.get('title'),
                position: checklist.length,
            });
            form.reset();
            await load();
        } catch (reason) {
            error(reason);
        }
    });
    noteForm.addEventListener('submit', async (event) => {
        event.preventDefault();
        if (savingNote || noteConflict) return;
        savingNote = true;
        const button = noteForm.querySelector('button');
        const submitted = { ...draft.values };
        button.disabled = true;
        updateNoteState();
        try {
            const response = await post(`/api/v1/tasks/${id}/note`, draft.freeze());
            note = response.payload.data;
            draft.acknowledge({ body: note.body }, note.version, submitted);
            body.value = draft.values.body;
        } catch (reason) {
            if (reason.status === 409 && reason.payload?.current) {
                noteConflict = reason.payload.current;
                root.querySelector('[data-task-note-conflict]').classList.remove('is-hidden');
            }
            error(reason);
        } finally {
            savingNote = false;
            button.disabled = !!noteConflict;
            updateNoteState();
        }
    });
    for (const [selector, keepDraft] of [
        ['[data-note-use-saved]', false],
        ['[data-note-keep-draft]', true],
    ]) {
        root.querySelector(selector).addEventListener('click', () => {
            if (!noteConflict) return;
            if (!keepDraft) draft.values = { ...draft.saved };
            draft.receive({ body: noteConflict.body }, Number(noteConflict.version), { keepDraft });
            note = noteConflict;
            noteConflict = null;
            body.value = draft.values.body;
            root.querySelector('[data-task-note-conflict]').classList.add('is-hidden');
            root.querySelector('[data-planning-error]').classList.add('is-hidden');
            noteForm.querySelector('button').disabled = false;
            updateNoteState();
            body.focus();
        });
    }
    root.querySelector('[data-task-transition]').addEventListener('click', async (event) => {
        const button = event.currentTarget;
        const completing = task.status !== 'Done';
        button.disabled = true;
        try {
            if (await transitionEntity('task', task, completing ? 'complete' : 'reopen')) {
                await load();
            }
        } catch (reason) {
            error(reason);
        } finally {
            button.disabled = false;
        }
    });
    root.querySelector('[data-task-week]').addEventListener('click', async (event) => {
        const button = event.currentTarget;
        button.disabled = true;
        try {
            await post('/api/v1/weekly-selections/task', { id, position: 0 });
            button.textContent = 'Selected for this week';
        } catch (reason) {
            error(reason);
        } finally {
            button.disabled = false;
        }
    });
    load();
}
