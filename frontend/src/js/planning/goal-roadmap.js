import { get, patch, post } from '../lib/http.js';
import { DraftBuffer } from './draft-buffer.js';
import { transitionEntity } from './transitions.js';
import { reportWorkspaceError } from '../lib/workspace-ui.js';
import { referenceDecoration } from '../settings/reference-decoration.js';

const detailFields = [
    'name',
    'description',
    'expected_result',
    'completion_criteria',
    'importance',
    'deadline',
];
const svgNamespace = 'http://www.w3.org/2000/svg';

function element(tag, text, className) {
    const node = document.createElement(tag);
    if (text !== undefined) node.textContent = text;
    if (className) node.className = className;
    return node;
}

export function initGoalDetail(root) {
    const id = root.dataset.goalId;
    const find = (selector) => root.querySelector(selector);
    const errorOutput = find('[data-planning-error]');
    const map = find('[data-roadmap-map]');
    const overview = find('[data-roadmap-overview]');
    const focus = find('[data-milestone-focus]');
    const strategyForm = find('[data-goal-strategy-form]');
    const detailsForm = find('[data-goal-details-form]');
    const informationDialog = find('#goal-information-dialog');
    const conflictDialog = find('[data-goal-conflict]');
    let conflictReturnControl = null;
    const strategy = new DraftBuffer();
    const details = new DraftBuffer();
    const milestoneTaskDrafts = new Map();
    const milestoneTaskForm = find('[data-milestone-task-create-form]');
    let draftMilestone = null;
    root.querySelectorAll('[data-capture-suggestions] button').forEach((button) =>
        button.addEventListener('click', () => {
            const control =
                milestoneTaskForm.elements[button.parentElement.dataset.captureSuggestions];
            control.value = control.value
                ? `${control.value}${control.tagName === 'TEXTAREA' ? '\n' : ' · '}${button.textContent}`
                : button.textContent;
            control.dispatchEvent(new Event('input', { bubbles: true }));
            control.focus();
        }),
    );
    for (const control of detailsForm.elements) control.disabled = true;
    const strategyValues = (goal) => ({ strategy_notes: goal.strategy_notes });
    const detailsValues = (goal) =>
        Object.fromEntries(detailFields.map((field) => [field, goal[field]]));
    let data = null;
    let selected = null;
    let page = 0;
    let pending = false;
    let loading = false;
    let conflict = null;

    function report(error) {
        reportWorkspaceError(root, error);
    }
    function clearError() {
        for (const output of [
            errorOutput,
            informationDialog.querySelector('[data-dialog-error]'),
        ]) {
            output.classList.add('is-hidden');
            output.textContent = '';
        }
    }
    function dirty() {
        return (
            strategy.dirty ||
            details.dirty ||
            [...milestoneTaskDrafts.values()].some((draft) =>
                Object.values(draft).some((value) => value.trim() !== ''),
            ) ||
            [
                ...root.querySelectorAll(
                    '[data-milestone-create-form] input, [data-milestone-create-form] textarea, [data-milestone-task-create-form] input, [data-milestone-task-create-form] textarea, [data-goal-task-create-form] input',
                ),
            ].some((control) => control.value.trim() !== '')
        );
    }
    function status() {
        find('[data-strategy-state]').textContent = strategy.dirty
            ? 'Unsaved changes'
            : strategy.version
              ? 'Saved'
              : '';
        find('[data-details-state]').textContent = details.dirty
            ? 'Unsaved changes'
            : details.version
              ? 'Saved'
              : '';
    }
    function writeForm(form, values) {
        for (const [field, value] of Object.entries(values))
            form.elements[field].value = value ?? '';
    }
    function receiveGoal(goal) {
        data.goal = goal;
        find('[data-goal-name]').textContent = goal.name;
        find('[data-goal-meta]').textContent =
            `${goal.status} · ${goal.progress ?? data.progress ?? 0}% progress`;
        const headName = map.querySelector('[data-roadmap-goal-name]');
        const headState = map.querySelector('[data-roadmap-goal-state]');
        if (headName) headName.textContent = goal.name;
        map.querySelector('[data-open-goal-information]')?.setAttribute(
            'aria-label',
            `View goal information: ${goal.name}`,
        );
        find('[data-goal-information-name]').textContent = goal.name;
        find('[data-goal-information-meta]').textContent =
            `${goal.status} · ${goal.progress ?? data.progress ?? 0}% progress · Importance ${goal.importance}/5${goal.deadline ? ` · Due ${goal.deadline}` : ''}`;
        find('[data-goal-information-description]').textContent =
            goal.description || 'No description yet. Open Edit goal to add one.';
        for (const [key, value] of [
            ['outcome', goal.expected_result],
            ['criteria', goal.completion_criteria],
        ]) {
            find(`[data-goal-information-${key}]`).textContent = value || '';
            find(`[data-goal-information-${key}-row]`).hidden = !value;
        }
        if (headState)
            headState.textContent = `${goal.progress ?? data.progress ?? 0}% · ${goal.status}`;
        requestAnimationFrame(drawConnections);
        if (strategy.receive(strategyValues(goal), goal.version))
            writeForm(strategyForm, strategy.values);
        if (details.receive(detailsValues(goal), goal.version))
            writeForm(detailsForm, details.values);
        strategyForm.elements.strategy_notes.disabled = false;
        for (const control of detailsForm.elements) control.disabled = false;
        find('[data-goal-transition]').textContent =
            goal.status === 'Completed' ? 'Reopen goal' : 'Complete goal';
        status();
    }
    function updateControls() {
        const busy = pending || loading || !data;
        for (const button of root.querySelectorAll(
            'button[type="submit"], [data-goal-transition], [data-milestone-transition], [data-milestone-week], [data-task-transition], [data-open-milestone-create], [data-open-dialog]',
        )) {
            button.disabled = busy;
        }
        if (data?.goal.status === 'Completed') {
            for (const form of root.querySelectorAll(
                '[data-milestone-create-form], [data-milestone-task-create-form], [data-goal-task-create-form]',
            ))
                form.querySelector('button[type="submit"]').disabled = true;
            for (const button of root.querySelectorAll(
                '[data-open-dialog]:not([data-open-goal-information])',
            ))
                button.disabled = true;
        }
        for (const form of root.querySelectorAll(
            '[data-milestone-create-form], [data-milestone-task-create-form], [data-goal-task-create-form]',
        )) {
            form.setAttribute('aria-busy', String(pending || loading));
            for (const control of form.elements)
                control.disabled = busy || data?.goal.status === 'Completed';
        }
        for (const form of [strategyForm, detailsForm])
            form.setAttribute('aria-busy', String(pending || loading));
        const goalTransition = find('[data-goal-transition]');
        const hasFiniteSteps =
            data && (data.child_goals.length || data.milestones.length || data.direct_tasks.length);
        const awaitingSteps =
            data?.goal.status === 'Active' && hasFiniteSteps && data.goal.progress < 100;
        if (awaitingSteps) goalTransition.disabled = true;
        goalTransition.title = awaitingSteps
            ? 'Complete the finite goal steps before completing this goal.'
            : '';
        const milestone = data?.milestones.find((item) => item.id === selected);
        const taskDialogTitle = find('#new-milestone-task-title');
        if (milestone && taskDialogTitle) {
            taskDialogTitle.textContent = 'Create new task';
            find('[data-milestone-task-context]').textContent =
                `${data.goal.name} › ${milestone.name} · ${milestone.progress.completed}/${milestone.progress.total} tasks completed`;
        }
        if (milestone?.completion_locked && milestone.status !== 'Completed')
            find('[data-milestone-transition]').disabled = true;
        find('[data-goal-refresh]').disabled = busy;
    }
    async function mutation(operation) {
        if (pending || loading || !data) return;
        pending = true;
        clearError();
        updateControls();
        try {
            await operation();
        } catch (error) {
            report(error);
        } finally {
            pending = false;
            updateControls();
            status();
        }
    }

    function switchTabs(tabSelector, panelSelector, attribute, key) {
        for (const tab of root.querySelectorAll(tabSelector)) {
            const active = tab.dataset[attribute] === key;
            tab.setAttribute('aria-selected', String(active));
            tab.tabIndex = active ? 0 : -1;
        }
        for (const panel of root.querySelectorAll(panelSelector))
            panel.hidden = panel.dataset[attribute.replace('Tab', 'Panel')] !== key;
    }
    function setupTabs(tabSelector, panelSelector, attribute, after = () => {}) {
        const tabs = [...root.querySelectorAll(tabSelector)];
        const select = (tab) => {
            switchTabs(tabSelector, panelSelector, attribute, tab.dataset[attribute]);
            after();
        };
        for (const tab of tabs) {
            tab.addEventListener('click', () => select(tab));
            tab.addEventListener('keydown', (event) => {
                let index = tabs.indexOf(tab);
                if (event.key === 'ArrowRight') index = (index + 1) % tabs.length;
                else if (event.key === 'ArrowLeft') index = (index + tabs.length - 1) % tabs.length;
                else if (event.key === 'Home') index = 0;
                else if (event.key === 'End') index = tabs.length - 1;
                else return;
                event.preventDefault();
                select(tabs[index]);
                tabs[index].focus();
            });
        }
    }
    setupTabs('[data-milestone-task-tab]', '[data-milestone-task-panel]', 'milestoneTaskTab');

    function drawConnections() {
        const svg = map.querySelector('.roadmap-connections');
        const center = map.querySelector('[data-roadmap-center]');
        if (!svg || !center || !map.getClientRects().length) return;
        const box = map.getBoundingClientRect();
        const origin = center.getBoundingClientRect();
        const branches = [...map.querySelectorAll('[data-roadmap-branch]')];
        const vertical = window.matchMedia('(max-width: 1000px)').matches;
        map.dataset.roadmapOrientation = vertical ? 'vertical' : 'horizontal';
        svg.replaceChildren();
        svg.setAttribute('viewBox', `0 0 ${box.width} ${box.height}`);
        if (!branches.length) return;
        const definitions = document.createElementNS(svgNamespace, 'defs');
        const arrow = document.createElementNS(svgNamespace, 'marker');
        arrow.id = 'roadmap-goal-arrow';
        arrow.setAttribute('viewBox', '0 0 10 10');
        arrow.setAttribute('refX', '9');
        arrow.setAttribute('refY', '5');
        arrow.setAttribute('markerWidth', '5');
        arrow.setAttribute('markerHeight', '5');
        arrow.setAttribute('orient', 'auto');
        const tip = document.createElementNS(svgNamespace, 'path');
        tip.setAttribute('d', 'M 1 1 L 9 5 L 1 9');
        tip.classList.add('roadmap-arrow-tip');
        arrow.append(tip);
        definitions.append(arrow);
        svg.append(definitions);
        const bounds = branches.map((branch) => branch.getBoundingClientRect());
        const spineX = origin.left + origin.width / 2 - box.left;
        const spineY = origin.top + origin.height / 2 - box.top;
        const spine = document.createElementNS(svgNamespace, 'path');
        spine.classList.add('roadmap-spine');
        spine.setAttribute(
            'd',
            vertical
                ? `M ${spineX} ${Math.min(...bounds.map((rect) => rect.top)) - box.top - 12} V ${origin.top - box.top}`
                : `M ${Math.min(...bounds.map((rect) => rect.left)) - box.left - 12} ${spineY} H ${origin.left - box.left}`,
        );
        spine.setAttribute('marker-end', 'url(#roadmap-goal-arrow)');
        svg.append(spine);
        // Ribs group Milestones under this Goal; they never imply prerequisites.
        for (const [index, branch] of branches.entries()) {
            const rect = bounds[index];
            let x1, y1, x2, y2;
            if (vertical) {
                const left = rect.left + rect.width / 2 < origin.left + origin.width / 2;
                x1 = (left ? rect.right : rect.left) - box.left;
                y1 = rect.top + rect.height / 2 - box.top;
                x2 = spineX;
                y2 = y1 + 28;
            } else {
                const above = rect.top + rect.height / 2 < origin.top + origin.height / 2;
                x1 = rect.left + rect.width / 2 - box.left;
                y1 = (above ? rect.bottom : rect.top) - box.top;
                x2 = x1 + Math.min(72, rect.width * 0.32);
                y2 = spineY;
            }
            const path = document.createElementNS(svgNamespace, 'path');
            path.classList.add('roadmap-rib');
            path.dataset.milestoneId = branch.dataset.roadmapBranch;
            path.setAttribute('d', `M ${x1} ${y1} L ${x2} ${y2}`);
            svg.append(path);
        }
    }
    new ResizeObserver(() => requestAnimationFrame(drawConnections)).observe(map);

    function renderMap() {
        map.replaceChildren();
        map.dataset.roadmapLayout = 'fishbone';
        map.setAttribute('aria-busy', 'false');
        const svg = document.createElementNS(svgNamespace, 'svg');
        svg.classList.add('roadmap-connections');
        svg.setAttribute('aria-hidden', 'true');
        const center = element('button', undefined, 'roadmap-center');
        center.type = 'button';
        center.dataset.openDialog = 'goal-information-dialog';
        center.dataset.openGoalInformation = '';
        center.setAttribute('aria-haspopup', 'dialog');
        center.setAttribute('aria-controls', 'goal-information-dialog');
        center.setAttribute('aria-label', `View goal information: ${data.goal.name}`);
        center.dataset.roadmapCenter = '';
        center.append(referenceDecoration('anchor'));
        const headName = element('span', data.goal.name, 'roadmap-goal-name');
        headName.dataset.roadmapGoalName = '';
        const headState = element(
            'span',
            `${data.goal.progress}% · ${data.goal.status}`,
            'roadmap-goal-state',
        );
        headState.dataset.roadmapGoalState = '';
        center.append(headName, headState);
        map.append(svg, center);
        map.append(
            referenceDecoration('sky'),
            referenceDecoration('roadmap'),
            referenceDecoration('hiker'),
        );
        page = Math.min(page, Math.max(0, Math.ceil(data.milestones.length / 6) - 1));
        const visibleMilestones = data.milestones.slice(page * 6, page * 6 + 6);
        map.dataset.roadmapEmpty = String(visibleMilestones.length === 0);
        const pairs = Math.max(1, Math.ceil(visibleMilestones.length / 2));
        map.style.setProperty('--fishbone-pairs', pairs);
        map.style.setProperty('--fishbone-head-row', pairs + 1);
        map.style.setProperty('--fishbone-page-row', pairs + 2);
        for (const [index, milestone] of visibleMilestones.entries()) {
            const branch = element('button', undefined, 'roadmap-branch');
            branch.type = 'button';
            branch.dataset.roadmapBranch = milestone.id;
            branch.style.setProperty('--branch-column', Math.floor(index / 2) + 1);
            branch.style.setProperty('--branch-row', index % 2 === 0 ? 1 : 3);
            branch.style.setProperty('--mobile-column', (index % 2) + 1);
            branch.style.setProperty('--mobile-row', Math.floor(index / 2) + 1);
            branch.style.setProperty(
                '--branch-hue',
                [37, 270, 195, 17, 0, 171, 218, 293][index % 8],
            );
            const icon = document.createElementNS(svgNamespace, 'svg');
            icon.classList.add('ui-icon', 'milestone-icon');
            icon.setAttribute('aria-hidden', 'true');
            const use = document.createElementNS(svgNamespace, 'use');
            use.setAttribute('href', `#icon-${['goals', 'habits', 'tasks', 'reviews'][index % 4]}`);
            icon.append(use);
            branch.append(icon);
            branch.append(
                element('strong', milestone.name),
                element(
                    'small',
                    `${milestone.progress.completed}/${milestone.progress.total} tasks · ${milestone.status.replace(/([a-z])([A-Z])/g, '$1 $2')}`,
                ),
            );
            if (milestone.completion_locked)
                branch.append(element('small', 'Prerequisites unfinished', 'roadmap-locked'));
            const preview = element('ul', undefined, 'roadmap-task-preview');
            for (const task of (milestone.tasks.some((task) => task.status !== 'Done')
                ? milestone.tasks.filter((task) => task.status !== 'Done')
                : milestone.tasks
            ).slice(0, 2))
                preview.append(element('li', `${task.status === 'Done' ? '✓ ' : ''}${task.name}`));
            if (!milestone.tasks.length) preview.append(element('li', 'Add your first task'));
            const track = element('span', undefined, 'progress-track');
            const fill = element('i');
            fill.style.setProperty('--progress', `${milestone.progress.percentage}%`);
            track.append(fill);
            branch.append(track, preview);
            branch.addEventListener('click', () => openMilestone(milestone.id));
            map.append(branch);
        }
        if (!data.milestones.length)
            map.append(
                element(
                    'p',
                    'Add milestones to turn this goal into a roadmap.',
                    'roadmap-empty subtle-copy',
                ),
            );
        if (data.milestones.length > 6) {
            const pages = element('div', undefined, 'roadmap-pagination action-row');
            const previous = element('button', 'Previous milestones', 'button button-quiet');
            previous.type = 'button';
            previous.disabled = page === 0;
            const next = element('button', 'Next milestones', 'button button-quiet');
            next.type = 'button';
            next.disabled = (page + 1) * 6 >= data.milestones.length;
            previous.addEventListener('click', () => {
                page--;
                renderMap();
            });
            next.addEventListener('click', () => {
                page++;
                renderMap();
            });
            pages.append(
                previous,
                element('span', `Page ${page + 1} of ${Math.ceil(data.milestones.length / 6)}`),
                next,
            );
            map.append(pages);
        }
        requestAnimationFrame(drawConnections);
    }
    function taskRows(container, tasks, withActions = true) {
        container.replaceChildren();
        if (!tasks.length) container.append(element('p', 'No tasks here yet.', 'subtle-copy'));
        for (const task of tasks) {
            const row = element('article', undefined, 'planning-list-item');
            const copy = element('div');
            const link = element('a', task.name);
            link.href = `/tasks/${encodeURIComponent(task.id)}`;
            copy.append(link, element('small', task.status.replace(/([a-z])([A-Z])/g, '$1 $2')));
            row.append(copy);
            if (withActions) {
                const button = element(
                    'button',
                    task.status === 'Done' ? 'Reopen' : 'Complete',
                    'button button-quiet',
                );
                button.type = 'button';
                button.dataset.taskTransition = '';
                button.addEventListener('click', () =>
                    mutation(async () => {
                        if (
                            await transitionEntity(
                                'task',
                                task,
                                task.status === 'Done' ? 'reopen' : 'complete',
                            )
                        )
                            await load();
                    }),
                );
                row.append(button);
            }
            container.append(row);
        }
    }
    function renderMilestone() {
        const milestone = data.milestones.find((item) => item.id === selected);
        if (!milestone) {
            selected = null;
            focus.hidden = true;
            overview.hidden = false;
            return;
        }
        overview.hidden = true;
        focus.hidden = false;
        find('[data-milestone-title]').textContent = milestone.name;
        const unfinished = milestone.prerequisites.filter((item) => item.status !== 'Completed');
        find('[data-milestone-meta]').textContent = unfinished.length
            ? `Completion requires: ${unfinished.map((item) => item.name).join(', ')}. Tasks remain available.`
            : `${milestone.status} · ${milestone.progress.completed}/${milestone.progress.total} finite tasks complete`;
        find('[data-milestone-criteria]').textContent =
            milestone.completion_criteria ||
            'Define success by completing the finite tasks or explicitly acknowledging unfinished work.';
        find('[data-milestone-transition]').textContent =
            milestone.status === 'Completed' ? 'Reopen milestone' : 'Complete milestone';
        find('[data-milestone-week]').textContent = 'Select for week';
        taskRows(find('[data-milestone-tasks]'), milestone.tasks);
        taskRows(find('[data-milestone-recurring]'), milestone.recurring_tasks);
        updateControls();
    }
    function openMilestone(milestoneId) {
        selected = milestoneId;
        draftMilestone = milestoneId;
        writeForm(
            milestoneTaskForm,
            milestoneTaskDrafts.get(milestoneId) || { name: '', completion_criteria: '' },
        );
        switchTabs(
            '[data-milestone-task-tab]',
            '[data-milestone-task-panel]',
            'milestoneTaskTab',
            'finite',
        );
        renderMilestone();
        find('[data-milestone-title]').focus();
    }
    milestoneTaskForm.addEventListener('input', () => {
        if (draftMilestone)
            milestoneTaskDrafts.set(draftMilestone, {
                name: milestoneTaskForm.elements.name.value,
                completion_criteria: milestoneTaskForm.elements.completion_criteria.value,
            });
    });
    find('[data-roadmap-back]').addEventListener('click', () => {
        const previous = selected;
        selected = null;
        focus.hidden = true;
        overview.hidden = false;
        requestAnimationFrame(() => {
            drawConnections();
            map.querySelector(`[data-roadmap-branch="${previous}"]`)?.focus();
        });
    });
    function renderRelated() {
        if (!data) return;
        const kind = find('[data-goal-related-kind]').value;
        const list = find('[data-goal-related-list]');
        find('[data-goal-task-create-form]').hidden = kind !== 'direct_tasks';
        if (kind === 'direct_tasks' || kind === 'recurring_tasks') taskRows(list, data[kind]);
        else {
            list.replaceChildren();
            for (const item of data[kind]) {
                const link = element('a', item.name, 'planning-item-link');
                link.href = kind === 'habits' ? '/habits' : `/goals/${encodeURIComponent(item.id)}`;
                list.append(link);
            }
            if (!data[kind].length)
                list.append(element('p', 'No related items in this section.', 'subtle-copy'));
        }
    }
    find('[data-goal-related-kind]').addEventListener('change', () => {
        renderRelated();
        updateControls();
    });

    async function load() {
        if (loading) return;
        loading = true;
        updateControls();
        clearError();
        try {
            const response = await get(`/api/v1/goals/${encodeURIComponent(id)}/roadmap`);
            data = response.payload.data;
            receiveGoal(data.goal);
            renderMap();
            renderMilestone();
            renderRelated();
        } catch (error) {
            report(error);
        } finally {
            loading = false;
            updateControls();
        }
    }
    find('[data-goal-refresh]').addEventListener('click', load);
    find('[data-goal-transition]').addEventListener('click', () =>
        mutation(async () => {
            if (
                await transitionEntity(
                    'goal',
                    data.goal,
                    data.goal.status === 'Completed' ? 'reopen' : 'complete',
                )
            )
                await load();
        }),
    );
    find('[data-milestone-transition]').addEventListener('click', () =>
        mutation(async () => {
            const milestone = data.milestones.find((item) => item.id === selected);
            if (
                await transitionEntity(
                    'milestone',
                    milestone,
                    milestone.status === 'Completed' ? 'reopen' : 'complete',
                )
            )
                await load();
        }),
    );
    find('[data-milestone-week]').addEventListener('click', () =>
        mutation(async () => {
            await post('/api/v1/weekly-selections/milestone', { id: selected, position: 0 });
            find('[data-milestone-week]').textContent = 'Selected for week';
        }),
    );
    const milestoneForm = find('[data-milestone-create-form]');
    milestoneForm.addEventListener('submit', (event) => {
        event.preventDefault();
        const fields = new FormData(milestoneForm);
        mutation(async () => {
            const response = await post('/api/v1/milestones', {
                goal_id: id,
                name: fields.get('name'),
                completion_criteria: fields.get('completion_criteria'),
                position: data.milestones.length,
            });
            milestoneForm.reset();
            milestoneForm.closest('dialog').close();
            await load();
            openMilestone(response.payload.data.id);
        });
    });
    for (const [selector, parent] of [
        ['[data-milestone-task-create-form]', 'milestone'],
        ['[data-goal-task-create-form]', 'goal'],
    ]) {
        const form = find(selector);
        form.addEventListener('submit', (event) => {
            event.preventDefault();
            const fields = new FormData(form);
            const parentId = parent === 'goal' ? id : selected;
            mutation(async () => {
                const taskCount =
                    parent === 'goal'
                        ? data.direct_tasks.length
                        : data.milestones.find((item) => item.id === parentId).tasks.length;
                await post('/api/v1/tasks', {
                    name: fields.get('name'),
                    completion_criteria: fields.get('completion_criteria') || '',
                    goal_id: parent === 'goal' ? id : null,
                    milestone_id: parent === 'milestone' ? parentId : null,
                    position: taskCount,
                });
                if (parent === 'milestone') milestoneTaskDrafts.delete(parentId);
                if (parent === 'goal' || draftMilestone === parentId) form.reset();
                form.closest('dialog')?.close();
                await load();
            });
        });
    }
    for (const [form, buffer, extract, marker] of [
        [strategyForm, strategy, strategyValues, '[data-strategy-state]'],
        [detailsForm, details, detailsValues, '[data-details-state]'],
    ]) {
        form.addEventListener('input', () => {
            const values = new FormData(form);
            buffer.values = Object.fromEntries(
                Object.keys(extract(data?.goal || {})).map((field) => [
                    field,
                    field === 'importance'
                        ? Number(values.get(field))
                        : field === 'deadline'
                          ? values.get(field) || null
                          : values.get(field),
                ]),
            );
            status();
        });
        form.addEventListener('submit', (event) => {
            event.preventDefault();
            mutation(async () => {
                const submitted = { ...buffer.values };
                find(marker).textContent = 'Saving…';
                try {
                    const response = await patch(`/api/v1/goals/${id}`, buffer.freeze());
                    buffer.acknowledge(
                        extract(response.payload.data),
                        response.payload.data.version,
                        submitted,
                    );
                    receiveGoal({ ...data.goal, ...response.payload.data });
                    writeForm(form, buffer.values);
                    await load();
                } catch (error) {
                    if (error.status === 409 && error.payload?.current) {
                        conflict = { form, buffer, extract, current: error.payload.current };
                        const saved = find('[data-goal-conflict-server]');
                        saved.replaceChildren();
                        for (const [field, value] of Object.entries(extract(conflict.current))) {
                            const entry = element('div');
                            entry.append(
                                element('dt', field.replaceAll('_', ' ')),
                                element('dd', String(value ?? '—')),
                            );
                            saved.append(entry);
                        }
                        conflictReturnControl = form.querySelector('input, textarea');
                        informationDialog.close();
                        conflictDialog.showModal();
                        find('[data-conflict-draft]').focus();
                    }
                    throw error;
                }
            });
        });
    }
    for (const [selector, keepDraft] of [
        ['[data-conflict-server]', false],
        ['[data-conflict-draft]', true],
    ]) {
        find(selector).addEventListener('click', () => {
            if (!conflict) return;
            const { form, buffer, extract, current } = conflict;
            if (!keepDraft) buffer.values = { ...buffer.saved };
            buffer.receive(extract(current), current.version, { keepDraft });
            writeForm(form, buffer.values);
            conflictReturnControl = form.querySelector('input, textarea');
            conflictDialog.close();
            conflict = null;
            clearError();
            status();
        });
    }
    informationDialog.addEventListener('close', () => {
        if (!conflictDialog.open && !conflictReturnControl)
            map.querySelector('[data-open-goal-information]')?.focus();
    });
    conflictDialog.addEventListener('close', () => {
        if (!conflictReturnControl) return;
        const control = conflictReturnControl;
        conflictReturnControl = null;
        informationDialog.showModal();
        control.closest('details').open = true;
        control.focus();
    });
    let leaveAccepted = false;
    const allowLeave = () => {
        if (!dirty() && !pending) return true;
        leaveAccepted = window.confirm(
            'Leave this goal? Unsaved edits will be lost. A save already sent may still complete.',
        );
        return leaveAccepted;
    };
    document.addEventListener(
        'click',
        (event) => {
            if (
                event.defaultPrevented ||
                event.button !== 0 ||
                event.ctrlKey ||
                event.metaKey ||
                event.shiftKey ||
                event.altKey
            )
                return;
            const link = event.target.closest('a[href]');
            if (link && !link.getAttribute('href').startsWith('#') && !allowLeave()) {
                event.preventDefault();
                event.stopImmediatePropagation();
            }
        },
        true,
    );
    document.addEventListener(
        'submit',
        (event) => {
            if (event.target.matches('[data-leave-guard-form]') && !allowLeave()) {
                event.preventDefault();
                event.stopImmediatePropagation();
            }
        },
        true,
    );
    window.addEventListener('beforeunload', (event) => {
        if (leaveAccepted) {
            leaveAccepted = false;
            return;
        }
        if (dirty() || pending) {
            event.preventDefault();
            event.returnValue = '';
        }
    });
    function openHashInformation() {
        const target = document.getElementById(location.hash.slice(1));
        if (data && target && informationDialog.contains(target)) {
            const section = target.closest('details');
            if (section) section.open = true;
            if (!document.querySelector('dialog[open]')) {
                informationDialog.showModal();
                target.focus();
            }
        }
    }
    window.addEventListener('hashchange', openHashInformation);
    load().then(() => {
        openHashInformation();
        const milestoneId = new URLSearchParams(location.hash.slice(1)).get('milestone');
        if (milestoneId && data?.milestones.some((item) => item.id === milestoneId))
            openMilestone(milestoneId);
    });
}
