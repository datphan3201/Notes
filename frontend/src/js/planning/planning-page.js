import { get, patch, post } from '../lib/http.js';
import { renderEmptyState } from '../lib/empty-state.js';

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

function errorMessage(error) {
    const errors = error.payload?.errors;
    if (errors) {
        const first = Object.values(errors).flat()[0];
        if (first) return first;
    }
    return error.message || 'Unable to complete the request.';
}

function showError(root, error) {
    const output = root.querySelector('[data-planning-error]');
    if (!output) return;
    output.textContent = errorMessage(error);
    output.classList.remove('is-hidden');
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

    for (const area of areas) {
        const section = document.createElement('section');
        section.className = 'goal-area-group';
        const heading = document.createElement('h3');
        heading.textContent = area.name;
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
                item.append(childList);
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

    const load = async () => {
        try {
            const [areaResponse, goalResponse] = await Promise.all([
                get('/api/v1/areas'),
                get('/api/v1/goals'),
            ]);
            areas = areaResponse.payload.data;
            areaList.replaceChildren();
            areaSelect.replaceChildren();
            for (const area of areas) {
                const row = document.createElement('form');
                row.className = 'area-rename-row';
                const input = document.createElement('input');
                input.value = area.name;
                input.maxLength = 80;
                input.setAttribute('aria-label', `Rename ${area.name}`);
                const button = document.createElement('button');
                button.type = 'submit';
                button.className = 'button button-quiet';
                button.textContent = 'Save name';
                row.append(input, button);
                row.addEventListener('submit', async (event) => {
                    event.preventDefault();
                    button.disabled = true;
                    try {
                        await patch(`/api/v1/areas/${area.id}`, {
                            name: input.value,
                            base_version: area.version,
                        });
                        await load();
                    } catch (error) {
                        showError(root, error);
                    } finally {
                        button.disabled = false;
                    }
                });
                areaList.append(row);
                const option = document.createElement('option');
                option.value = area.id;
                option.textContent = area.name;
                areaSelect.append(option);
            }
            renderGoalTree(tree, areas, goalResponse.payload.data);
        } catch (error) {
            showError(root, error);
            tree.textContent = 'Unable to load the Goal hierarchy.';
        }
    };

    form.addEventListener('submit', async (event) => {
        event.preventDefault();
        const submit = form.querySelector('button[type="submit"]');
        submit.disabled = true;
        const data = new FormData(form);
        try {
            await post('/api/v1/goals', {
                area_id: data.get('area_id'),
                parent_goal_id: null,
                name: data.get('name'),
                expected_result: data.get('expected_result'),
                completion_criteria: data.get('completion_criteria'),
            });
            form.reset();
            await load();
        } catch (error) {
            showError(root, error);
        } finally {
            submit.disabled = false;
        }
    });
    root.querySelector('[data-planning-retry]')?.addEventListener('click', load);
    load();
}

export function initGoalDetail(root) {
    const id = root.dataset.goalId;
    const load = async () => {
        try {
            const [goal, children, milestones, tasks, habits, contributions] = await Promise.all([
                get(`/api/v1/goals/${encodeURIComponent(id)}`),
                get(`/api/v1/goals/${encodeURIComponent(id)}/children`),
                get('/api/v1/milestones'),
                get('/api/v1/tasks'),
                get('/api/v1/habits'),
                get(`/api/v1/goals/${encodeURIComponent(id)}/contributions`),
            ]);
            const data = goal.payload.data;
            root.querySelector('[data-goal-name]').textContent = data.name;
            root.querySelector('[data-goal-description]').textContent = data.description || '—';
            root.querySelector('[data-goal-result]').textContent = data.expected_result || '—';
            root.querySelector('[data-goal-criteria]').textContent =
                data.completion_criteria || '—';
            root.querySelector('[data-goal-importance]').textContent = `${data.importance}/5`;
            root.querySelector('[data-goal-progress]').textContent = data.progress;
            const list = root.querySelector('[data-goal-children]');
            list.replaceChildren();
            if (!children.payload.data.length) {
                list.textContent = 'No child goals yet.';
            }
            for (const child of children.payload.data) list.append(linkForGoal(child));

            const milestoneList = root.querySelector('[data-goal-milestones]');
            milestoneList.replaceChildren();
            const directMilestones = milestones.payload.data.filter(
                (milestone) => milestone.goal_id === id,
            );
            const prerequisiteResponses = await Promise.all(
                directMilestones.map((milestone) =>
                    get(`/api/v1/milestones/${encodeURIComponent(milestone.id)}/prerequisites`),
                ),
            );
            for (const [index, milestone] of directMilestones.entries()) {
                const row = document.createElement('article');
                row.className = 'planning-list-item planning-list-item-wrap';
                const copy = document.createElement('div');
                const name = document.createElement('strong');
                name.textContent = milestone.name;
                const meta = document.createElement('small');
                const openPrerequisites = prerequisiteResponses[index].payload.data.filter(
                    (item) => item.status !== 'Completed',
                );
                meta.textContent = openPrerequisites.length
                    ? `Completion is locked until ${openPrerequisites.map((item) => item.name).join(', ')}. Tasks remain available.`
                    : `${milestone.status} · ${milestone.progress.percentage}% of tasks complete`;
                copy.append(name, meta);
                const actions = document.createElement('div');
                actions.className = 'action-row';
                const week = document.createElement('button');
                week.type = 'button';
                week.className = 'button button-quiet';
                week.textContent = 'Select for week';
                week.addEventListener('click', async () => {
                    week.disabled = true;
                    try {
                        await post('/api/v1/weekly-selections/milestone', {
                            id: milestone.id,
                            position: 0,
                        });
                        week.textContent = 'Selected';
                    } catch (error) {
                        showError(root, error);
                    } finally {
                        week.disabled = false;
                    }
                });
                const transition = document.createElement('button');
                transition.type = 'button';
                transition.className = 'button button-quiet';
                transition.textContent = milestone.status === 'Completed' ? 'Reopen' : 'Complete';
                transition.disabled = openPrerequisites.length > 0;
                transition.addEventListener('click', async () => {
                    const completing = milestone.status !== 'Completed';
                    if (
                        completing &&
                        !window.confirm(
                            `Complete “${milestone.name}”? Unfinished Tasks will not change status automatically.`,
                        )
                    )
                        return;
                    transition.disabled = true;
                    try {
                        await post(
                            `/api/v1/milestones/${milestone.id}/${completing ? 'complete' : 'reopen'}`,
                            { base_version: milestone.version, acknowledge_open_tasks: true },
                        );
                        await load();
                    } catch (error) {
                        showError(root, error);
                    } finally {
                        transition.disabled = false;
                    }
                });
                actions.append(week, transition);
                row.append(copy, actions);
                milestoneList.append(row);
            }
            if (!directMilestones.length) milestoneList.textContent = 'No milestones yet.';

            const taskList = root.querySelector('[data-goal-tasks]');
            taskList.replaceChildren();
            const directTasks = tasks.payload.data.filter((task) => task.goal_id === id);
            for (const task of directTasks) {
                const link = document.createElement('a');
                link.className = 'planning-item-link';
                link.href = `/tasks/${encodeURIComponent(task.id)}`;
                link.textContent = `${task.name} · ${task.status}`;
                taskList.append(link);
            }
            if (!directTasks.length) taskList.textContent = 'No direct tasks yet.';

            const habitList = root.querySelector('[data-goal-habits]');
            const directHabits = habits.payload.data.filter(
                (habit) => habit.primary_goal_id === id,
            );
            habitList.textContent = directHabits.length
                ? directHabits.map((habit) => habit.name).join(' · ')
                : 'No Habits have this as their primary location.';
            root.querySelector('[data-goal-contributions]').textContent = contributions.payload.data
                .length
                ? contributions.payload.data.map((target) => target.name).join(' · ')
                : 'No contribution relationships yet.';
        } catch (error) {
            showError(root, error);
        }
    };

    root.querySelector('[data-milestone-create-form]').addEventListener('submit', async (event) => {
        event.preventDefault();
        const form = event.currentTarget;
        const data = new FormData(form);
        try {
            await post('/api/v1/milestones', { goal_id: id, name: data.get('name') });
            form.reset();
            await load();
        } catch (error) {
            showError(root, error);
        }
    });
    root.querySelector('[data-goal-task-create-form]').addEventListener('submit', async (event) => {
        event.preventDefault();
        const form = event.currentTarget;
        const data = new FormData(form);
        try {
            await post('/api/v1/tasks', {
                goal_id: id,
                milestone_id: null,
                name: data.get('name'),
            });
            form.reset();
            await load();
        } catch (error) {
            showError(root, error);
        }
    });
    load();
}

export function initTasksPage(root) {
    const list = root.querySelector('[data-task-list]');
    const form = root.querySelector('[data-task-create-form]');
    const load = async () => {
        try {
            const response = await get('/api/v1/tasks');
            list.replaceChildren();
            if (!response.payload.data.length)
                renderEmptyState(list, {
                    title: 'Start with one small step.',
                    description:
                        'Add a task to your inbox. You can give it a goal, a checklist, and working notes as it takes shape.',
                    href: '#task-name',
                    action: 'Add your first task',
                });
            for (const task of response.payload.data) {
                const article = document.createElement('article');
                article.className = 'planning-list-item';
                const copy = document.createElement('div');
                const name = document.createElement('a');
                name.href = `/tasks/${encodeURIComponent(task.id)}`;
                name.textContent = task.name;
                const status = document.createElement('small');
                status.textContent = `${task.status.replace(/([a-z])([A-Z])/g, '$1 $2')} · Importance ${task.importance}/5`;
                copy.append(name, status);
                const action = document.createElement('button');
                action.className = 'button button-quiet';
                action.type = 'button';
                action.textContent = task.status === 'Done' ? 'Reopen' : 'Complete';
                action.addEventListener('click', async () => {
                    action.disabled = true;
                    try {
                        await post(
                            `/api/v1/tasks/${task.id}/${task.status === 'Done' ? 'reopen' : 'complete'}`,
                            {
                                base_version: task.version,
                                acknowledge_unchecked_items: true,
                            },
                        );
                        await load();
                    } catch (error) {
                        showError(root, error);
                    } finally {
                        action.disabled = false;
                    }
                });
                const week = document.createElement('button');
                week.className = 'button button-quiet';
                week.type = 'button';
                week.textContent = 'Select for week';
                week.addEventListener('click', async () => {
                    week.disabled = true;
                    try {
                        await post('/api/v1/weekly-selections/task', { id: task.id, position: 0 });
                        week.textContent = 'Selected';
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
        } catch (error) {
            showError(root, error);
            list.textContent = 'Unable to load Tasks.';
        }
    };
    form.addEventListener('submit', async (event) => {
        event.preventDefault();
        const data = new FormData(form);
        const submit = form.querySelector('button[type="submit"]');
        submit.disabled = true;
        try {
            await post('/api/v1/tasks', {
                goal_id: null,
                milestone_id: null,
                name: data.get('name'),
                completion_criteria: data.get('completion_criteria'),
            });
            form.reset();
            await load();
        } catch (error) {
            showError(root, error);
        } finally {
            submit.disabled = false;
        }
    });
    root.querySelector('[data-planning-retry]')?.addEventListener('click', load);
    load();
}

export function initTaskDetail(root) {
    const id = root.dataset.taskId;
    let task = null;
    let note = null;
    let checklist = [];
    const error = (reason) => showError(root, reason);

    const load = async () => {
        try {
            const [taskResponse, checklistResponse, noteResponse] = await Promise.all([
                get(`/api/v1/tasks/${encodeURIComponent(id)}`),
                get(`/api/v1/tasks/${encodeURIComponent(id)}/checklist`),
                get(`/api/v1/tasks/${encodeURIComponent(id)}/note`),
            ]);
            task = taskResponse.payload.data;
            checklist = checklistResponse.payload.data;
            note = noteResponse.payload.data;
            root.querySelector('[data-task-name]').textContent = task.name;
            root.querySelector('[data-task-meta]').textContent =
                `${task.status} · Importance ${task.importance}/5${task.deadline ? ` · Due ${task.deadline}` : ''}`;
            root.querySelector('[data-task-description]').textContent = task.description || '—';
            root.querySelector('[data-task-result]').textContent = task.expected_result || '—';
            root.querySelector('[data-task-criteria]').textContent =
                task.completion_criteria || '—';
            const transition = root.querySelector('[data-task-transition]');
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
            root.querySelector('[name="body"]').value = note?.body || '';
            root.querySelector('[data-task-note-state]').textContent = note
                ? `Saved version ${note.version}`
                : 'No note yet';
        } catch (reason) {
            error(reason);
        }
    };

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
    root.querySelector('[data-task-note-form]').addEventListener('submit', async (event) => {
        event.preventDefault();
        const form = event.currentTarget;
        const button = form.querySelector('button');
        button.disabled = true;
        try {
            const response = await post(`/api/v1/tasks/${id}/note`, {
                body: new FormData(form).get('body'),
                base_version: note?.version || null,
            });
            note = response.payload.data;
            root.querySelector('[data-task-note-state]').textContent =
                `Saved version ${note.version}`;
        } catch (reason) {
            error(reason);
        } finally {
            button.disabled = false;
        }
    });
    root.querySelector('[data-task-transition]').addEventListener('click', async (event) => {
        const button = event.currentTarget;
        const completing = task.status !== 'Done';
        const hasUnchecked = checklist.some((item) => !item.checked);
        if (
            completing &&
            hasUnchecked &&
            !window.confirm('Complete this Task even though its Checklist has unfinished items?')
        )
            return;
        button.disabled = true;
        try {
            await post(`/api/v1/tasks/${id}/${completing ? 'complete' : 'reopen'}`, {
                base_version: task.version,
                acknowledge_unchecked_items: hasUnchecked,
            });
            await load();
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
