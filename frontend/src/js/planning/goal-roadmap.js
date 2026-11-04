import { COLORS, cycleHue, entityIcon, iconButton } from '../lib/entity-icons.js';
import { starRating } from '../lib/star-rating.js';

import { renderLinkedNotes } from '../notes/linked-notes.js';
import { formatDay, formatPercent } from '../lib/format.js';
import { get, patch, post, remove } from '../lib/http.js';
import { t, statusLabel } from '../lib/i18n.js';
import { renderContributions } from './contributions-ui.js';
import { createTagPicker, sameTagIds } from './tag-picker.js';
import { DraftBuffer } from './draft-buffer.js';
import { transitionEntity } from './transitions.js';
import { reportWorkspaceError } from '../lib/workspace-ui.js';
import { referenceDecoration } from '../settings/reference-decoration.js';
import { checkMark } from '../lib/check-mark.js';
import { taskRowShell } from './task-row.js';
import { actionMenu, initActionMenus } from './action-menu.js';
import { lineIcon, spriteIcon } from '../lib/line-icons.js';
import { taskIsOverdue, localDate } from './task-views.js';
import { openQuickEditor, openQuickCreator } from './quick-editor.js';

const svgNamespace = 'http://www.w3.org/2000/svg';

function element(tag, text, className) {
    const node = document.createElement(tag);
    if (text !== undefined) node.textContent = text;
    if (className) node.className = className;
    return node;
}

export function initGoalDetail(root) {
    const id = root.dataset.goalId;
    renderLinkedNotes(root.querySelector('[data-linked-notes]'));
    const find = (selector) => root.querySelector(selector);
    const errorOutput = find('[data-planning-error]');
    const map = find('[data-roadmap-map]');
    const overview = find('[data-roadmap-overview]');
    const focus = find('[data-milestone-focus]');
    const strategyForm = find('[data-goal-strategy-form]');
    const informationDialog = find('#goal-information-dialog');
    const conflictDialog = find('[data-goal-conflict]');
    let conflictReturnControl = null;
    const strategy = new DraftBuffer();
    const strategyValues = (goal) => ({ strategy_notes: goal.strategy_notes });
    initActionMenus(root);
    let data = null;
    let selected = null;
    let page = 0;
    let pending = false;
    let loading = false;
    let conflict = null;
    let selectedMilestones = new Set();
    // Goal tags save immediately; Strategy keeps its independent draft.
    const goalTags = createTagPicker({
        onChange: (ids) =>
            mutation(async () => {
                if (sameTagIds(ids, data.goal.tag_ids)) return;
                await patch(`/api/v1/goals/${encodeURIComponent(id)}`, {
                    base_version: data.goal.version,
                    tag_ids: ids,
                });
                await load();
            }),
    });
    find('[data-goal-tags]').append(goalTags.element);

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
        return strategy.dirty;
    }
    function status() {
        find('[data-strategy-state]').textContent = strategy.dirty
            ? t('Unsaved changes')
            : strategy.version
              ? t('Saved')
              : '';
    }
    function writeForm(form, values) {
        for (const [field, value] of Object.entries(values))
            form.elements[field].value = value ?? '';
    }
    // Icon, accent and importance save immediately, like tags; other fields keep their drafts.
    const saveEntity = (type, entity, changes) =>
        mutation(async () => {
            await patch(`/api/v1/${type}/${encodeURIComponent(entity.id)}`, {
                base_version: entity.version,
                ...changes,
            });
            await load();
        });
    function receiveGoal(goal) {
        data.goal = goal;
        find('[data-goal-name]').textContent = goal.name;
        find('[data-goal-icon]').replaceChildren(
            iconButton(goal, {
                label: goal.name,
                size: 'lg',
                save: (choice) => saveEntity('goals', goal, choice),
            }),
        );
        find('[data-goal-stars]').replaceChildren(
            starRating(goal.importance, {
                label: `${t('Importance')}: ${goal.name}`,
                size: 'md',
                onChange: (importance) => saveEntity('goals', goal, { importance }),
            }),
        );
        find('[data-goal-meta]').textContent =
            `${statusLabel(goal.status)} · ${formatPercent(goal.progress ?? data.progress)} ${t('progress')}`;
        const headName = map.querySelector('[data-roadmap-goal-name]');
        const headState = map.querySelector('[data-roadmap-goal-state]');
        if (headName) headName.textContent = goal.name;
        map.querySelector('[data-open-goal-information]')?.setAttribute(
            'aria-label',
            `${t('View goal information')}: ${goal.name}`,
        );
        find('[data-goal-information-name]').textContent = goal.name;
        find('[data-goal-information-icon]').replaceChildren(entityIcon(goal));
        find('[data-goal-information-meta]').textContent =
            `${statusLabel(goal.status)} · ${formatPercent(goal.progress ?? data.progress)} ${t('progress')} · ${t('Importance')} ${'★'.repeat(goal.importance)}${'☆'.repeat(5 - goal.importance)}${goal.deadline ? ` · ${t('Due')} ${formatDay(goal.deadline)}` : ''}`;
        find('[data-goal-information-description]').textContent =
            goal.description || t('No description yet. Open Edit goal to add one.');
        for (const [key, value] of [
            ['outcome', goal.expected_result],
            ['criteria', goal.completion_criteria],
        ]) {
            find(`[data-goal-information-${key}]`).textContent = value || '';
            find(`[data-goal-information-${key}-row]`).hidden = !value;
        }
        if (headState)
            headState.textContent = `${formatPercent(goal.progress ?? data.progress)} · ${statusLabel(goal.status)}`;
        requestAnimationFrame(drawConnections);
        if (strategy.receive(strategyValues(goal), goal.version))
            writeForm(strategyForm, strategy.values);
        strategyForm.elements.strategy_notes.disabled = false;
        find('[data-goal-transition]').replaceChildren(
            spriteIcon(goal.status === 'Completed' ? 'refresh' : 'check'),
            document.createTextNode(
                goal.status === 'Completed' ? t('Reopen goal') : t('Complete goal'),
            ),
        );
        if (!sameTagIds(goalTags.value, goal.tag_ids)) goalTags.value = goal.tag_ids;
        status();
    }
    function updateControls() {
        const busy = pending || loading || !data;
        for (const button of root.querySelectorAll(
            'button[type="submit"], [data-goal-transition], [data-milestone-transition], [data-milestone-week], [data-task-transition], [data-open-milestone-create], [data-open-dialog]',
        )) {
            button.disabled = busy;
        }
        for (const button of root.querySelectorAll(
            '[data-goal-edit], [data-goal-child-new], [data-goal-task-new], [data-milestone-task-new], [data-milestone-menu] button',
        ))
            button.disabled = busy;
        for (const button of root.querySelectorAll(
            '[data-open-milestone-create], [data-goal-child-new], [data-goal-task-new], [data-milestone-task-new]',
        ))
            button.disabled = busy || data?.goal.status === 'Completed';
        strategyForm.setAttribute('aria-busy', String(pending || loading));
        const goalTransition = find('[data-goal-transition]');
        const hasFiniteSteps =
            data && (data.child_goals.length || data.milestones.length || data.direct_tasks.length);
        const awaitingSteps =
            data?.goal.status === 'Active' && hasFiniteSteps && data.goal.progress < 100;
        if (awaitingSteps) goalTransition.disabled = true;
        goalTransition.title = awaitingSteps
            ? t('Complete the finite goal steps before completing this goal.')
            : '';
        const milestone = data?.milestones.find((item) => item.id === selected);
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
        center.setAttribute('aria-label', `${t('View goal information')}: ${data.goal.name}`);
        center.dataset.roadmapCenter = '';
        center.append(entityIcon(data.goal, { size: 'lg' }));
        const headName = element('span', data.goal.name, 'roadmap-goal-name');
        headName.dataset.roadmapGoalName = '';
        const headState = element(
            'span',
            `${formatPercent(data.goal.progress)} · ${statusLabel(data.goal.status)}`,
            'roadmap-goal-state',
        );
        headState.dataset.roadmapGoalState = '';
        const headCta = element('span', `${t('Goal information')} →`, 'roadmap-goal-cta');
        center.append(headName, headState, headCta);
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
                COLORS[milestone.icon_color] ?? cycleHue(index),
            );
            // The chosen icon, or the automatic one that cycles with the roadmap position.
            branch.append(
                entityIcon(milestone, {
                    size: 'sm',
                    fallbackIcon: 'flag',
                    fallbackHue: cycleHue(index),
                }),
            );
            branch.append(
                element('strong', milestone.name),
                element(
                    'small',
                    `${milestone.progress.completed}/${milestone.progress.total} ${t('tasks')} · ${statusLabel(milestone.status)}`,
                ),
                starRating(milestone.importance),
            );
            // Waiting on an earlier Milestone is the normal order, not an error: name what comes first.
            if (milestone.completion_locked) {
                const waiting = milestone.prerequisites
                    .filter((prerequisite) => prerequisite.status !== 'Completed')
                    .map((prerequisite) => prerequisite.name);
                branch.append(
                    element(
                        'small',
                        waiting.length
                            ? `${t('After')} ${waiting.join(', ')}`
                            : t('Prerequisites unfinished'),
                        'roadmap-locked',
                    ),
                );
            }
            const preview = element('ul', undefined, 'roadmap-task-preview');
            for (const task of (milestone.tasks.some((task) => task.status !== 'Done')
                ? milestone.tasks.filter((task) => task.status !== 'Done')
                : milestone.tasks
            ).slice(0, 2)) {
                const item = element('li', task.name);
                if (task.status === 'Done') item.prepend(checkMark(), ' ');
                preview.append(item);
            }
            if (!milestone.tasks.length) preview.append(element('li', t('Add your first task')));
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
                    t('Add milestones to turn this goal into a roadmap.'),
                    'roadmap-empty subtle-copy',
                ),
            );
        if (data.milestones.length > 6) {
            const pages = element('div', undefined, 'roadmap-pagination action-row');
            const previous = element('button', t('Previous milestones'), 'button button-quiet');
            previous.type = 'button';
            previous.disabled = page === 0;
            const next = element('button', t('Next milestones'), 'button button-quiet');
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
                element(
                    'span',
                    `${t('Page')} ${page + 1} / ${Math.ceil(data.milestones.length / 6)}`,
                ),
                next,
            );
            map.append(pages);
        }
        requestAnimationFrame(drawConnections);
    }
    function taskRows(container, tasks) {
        const activeTask = container.contains(document.activeElement)
            ? document.activeElement.closest('[data-task-id]')?.dataset.taskId
            : null;
        const wasLink = document.activeElement?.matches('a[data-quick-edit]');
        container.replaceChildren();
        if (!tasks.length) container.append(element('p', t('No tasks here yet.'), 'subtle-copy'));
        const timezone = window.notesBootstrap.preferences.timezone;
        const today = localDate(new Date().toISOString(), timezone);
        for (const task of tasks) {
            const { article, actions, completion } = taskRowShell(task, {
                facts: [
                    statusLabel(task.status),
                    task.deadline ? `${t('Due')} ${formatDay(task.deadline)}` : '',
                    task.series_id ? t('Repeats') : '',
                ]
                    .filter(Boolean)
                    .join(' · '),
                overdue: taskIsOverdue(task, today),
                onToggle: () =>
                    mutation(async () => {
                        if (
                            await transitionEntity(
                                'task',
                                task,
                                task.status === 'Done' ? 'reopen' : 'complete',
                            )
                        ) {
                            await load();
                            container
                                .querySelector(`[data-task-id="${task.id}"] [data-task-transition]`)
                                ?.focus();
                        }
                    }),
            });
            article.dataset.taskId = task.id;
            completion.dataset.taskTransition = '';
            actions.append(starRating(task.importance));
            container.append(article);
        }
        if (activeTask)
            container
                .querySelector(
                    `[data-task-id="${activeTask}"] ${wasLink ? 'a[data-quick-edit]' : '[data-task-transition]'}`,
                )
                ?.focus();
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
        find('[data-milestone-icon]').replaceChildren(
            iconButton(milestone, {
                label: milestone.name,
                fallbackIcon: 'flag',
                fallbackHue: cycleHue(data.milestones.indexOf(milestone)),
                save: (choice) => saveEntity('milestones', milestone, choice),
            }),
        );
        find('[data-milestone-stars]').replaceChildren(
            starRating(milestone.importance, {
                label: `${t('Importance')}: ${milestone.name}`,
                onChange: (importance) => saveEntity('milestones', milestone, { importance }),
            }),
        );
        const unfinished = milestone.prerequisites.filter((item) => item.status !== 'Completed');
        find('[data-milestone-meta]').textContent = unfinished.length
            ? `${t('Completion requires')}: ${unfinished.map((item) => item.name).join(', ')}. ${t('Tasks remain available.')}`
            : `${statusLabel(milestone.status)} · ${milestone.progress.completed}/${milestone.progress.total} ${t('finite tasks complete')}${milestone.deadline ? ` · ${t('Due')} ${formatDay(milestone.deadline)}` : ''}`;
        find('[data-milestone-criteria]').textContent =
            milestone.completion_criteria ||
            t(
                'Define success by completing the finite tasks or explicitly acknowledging unfinished work.',
            );
        find('[data-milestone-transition]').replaceChildren(
            spriteIcon(milestone.status === 'Completed' ? 'refresh' : 'check'),
            document.createTextNode(
                milestone.status === 'Completed' ? t('Reopen milestone') : t('Complete milestone'),
            ),
        );
        const week = find('[data-milestone-week]');
        const weekLabel = selectedMilestones.has(milestone.id)
            ? t('Remove from this week')
            : t('Select for this week');
        week.replaceChildren(lineIcon('pin', { filled: selectedMilestones.has(milestone.id) }));
        week.title = weekLabel;
        week.setAttribute('aria-label', weekLabel);
        week.setAttribute('aria-pressed', String(selectedMilestones.has(milestone.id)));
        find('[data-milestone-menu]').replaceChildren(
            actionMenu(milestone.name, [
                {
                    label: t('Edit'),
                    icon: 'edit',
                    action: () =>
                        openQuickEditor('milestone', milestone.id, {
                            trigger: find('[data-milestone-title]'),
                        }),
                },
                {
                    label: t('Archive'),
                    icon: 'archive',
                    danger: true,
                    action: () => archiveMilestone(milestone),
                },
            ]),
        );
        taskRows(find('[data-milestone-tasks]'), milestone.tasks);
        taskRows(find('[data-milestone-recurring]'), milestone.recurring_tasks);
        renderPrerequisites(milestone);
        if (find('.milestone-links').open) renderMilestoneContributions(milestone);
        updateControls();
    }
    function openMilestone(milestoneId) {
        selected = milestoneId;
        switchTabs(
            '[data-milestone-task-tab]',
            '[data-milestone-task-panel]',
            'milestoneTaskTab',
            'finite',
        );
        renderMilestone();
        find('[data-milestone-title]').focus();
    }
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
    // Prerequisites only gate Milestone completion; the Milestone's Tasks stay usable.
    function renderPrerequisites(milestone) {
        const container = find('[data-milestone-prerequisites]');
        container.replaceChildren();
        for (const prerequisite of milestone.prerequisites) {
            const row = element('div', undefined, 'contribution-row');
            const name = element(
                'span',
                `${prerequisite.name} · ${statusLabel(prerequisite.status)}`,
            );
            const unlink = element('button', '×', 'icon-button');
            unlink.type = 'button';
            unlink.title = t('Remove prerequisite');
            unlink.setAttribute('aria-label', `${t('Remove prerequisite')} ${prerequisite.name}`);
            unlink.addEventListener('click', () =>
                mutation(async () => {
                    await remove(
                        `/api/v1/milestones/${encodeURIComponent(milestone.id)}/prerequisites/${encodeURIComponent(prerequisite.id)}`,
                        { base_version: milestone.version },
                    );
                    await load();
                }),
            );
            row.append(name, unlink);
            container.append(row);
        }
        if (!milestone.prerequisites.length)
            container.append(element('p', t('No prerequisites.'), 'subtle-copy'));
        const linked = new Set(milestone.prerequisites.map((item) => item.id));
        const options = data.milestones.filter(
            (item) => item.id !== milestone.id && !linked.has(item.id),
        );
        if (!options.length) return;
        const form = element('form', undefined, 'inline-form contribution-form');
        const select = element('select');
        select.setAttribute('aria-label', t('Prerequisite milestone'));
        select.append(new Option(t('Add a prerequisite…'), ''));
        for (const item of options) select.append(new Option(item.name, item.id));
        const add = element('button', t('Add'), 'button button-quiet');
        add.type = 'submit';
        form.append(select, add);
        form.addEventListener('submit', (event) => {
            event.preventDefault();
            if (!select.value) return;
            mutation(async () => {
                await post(`/api/v1/milestones/${encodeURIComponent(milestone.id)}/prerequisites`, {
                    prerequisite_id: select.value,
                    base_version: milestone.version,
                });
                await load();
            });
        });
        container.append(form);
    }
    function renderMilestoneContributions(milestone) {
        renderContributions(find('[data-milestone-contributions]'), {
            type: 'milestone',
            id: milestone.id,
            excludeGoalId: id,
            onError: report,
        });
    }
    find('.milestone-links').addEventListener('toggle', (event) => {
        const milestone = data?.milestones.find((item) => item.id === selected);
        if (event.currentTarget.open && milestone) renderMilestoneContributions(milestone);
    });
    function renderRelated() {
        if (!data) return;
        const kind = find('[data-goal-related-kind]').value;
        const list = find('[data-goal-related-list]');
        find('[data-goal-task-new]').hidden = kind !== 'direct_tasks';
        find('[data-goal-child-new]').hidden = kind !== 'child_goals';
        if (kind === 'direct_tasks' || kind === 'recurring_tasks') taskRows(list, data[kind]);
        else if (kind === 'contributions')
            renderContributions(list, { type: 'goal', id, onError: report });
        else {
            list.replaceChildren();
            for (const item of data[kind]) {
                const link = element('a', item.name, 'planning-item-link');
                link.href = kind === 'habits' ? '/habits' : `/goals/${encodeURIComponent(item.id)}`;
                list.append(link);
            }
            if (!data[kind].length)
                list.append(element('p', t('No related items in this section.'), 'subtle-copy'));
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
            const [response, weekly] = await Promise.all([
                get(`/api/v1/goals/${encodeURIComponent(id)}/roadmap`),
                get('/api/v1/weekly-selections/milestone'),
            ]);
            selectedMilestones = new Set(weekly.payload.data.map((item) => item.id));
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
            if (selectedMilestones.has(selected))
                await remove(`/api/v1/weekly-selections/milestone/${encodeURIComponent(selected)}`);
            else await post('/api/v1/weekly-selections/milestone', { id: selected, position: 0 });
            await load();
        }),
    );
    function archiveMilestone(milestone) {
        const count = milestone.tasks.length + milestone.recurring_tasks.length;
        if (
            !window.confirm(
                `${t('Archive milestone')} “${milestone.name}”?${count ? ` ${t('Its tasks are archived too:')} ${count}.` : ''}`,
            )
        )
            return;
        mutation(async () => {
            await remove(`/api/v1/milestones/${encodeURIComponent(milestone.id)}`, {
                base_version: milestone.version,
                include_contents: true,
            });
            selected = null;
            focus.hidden = true;
            overview.hidden = false;
            await load();
        });
    }
    find('[data-goal-archive]').addEventListener('click', () => {
        if (!data) return;
        const parts = [
            [data.child_goals.length, t('sub-goals')],
            [data.milestones.length, t('milestones')],
            [
                data.direct_tasks.length +
                    data.milestones.reduce((sum, item) => sum + item.tasks.length, 0),
                t('tasks'),
            ],
        ]
            .filter(([count]) => count)
            .map(([count, label]) => `${count} ${label}`);
        if (
            !window.confirm(
                `${t('Archive goal')} “${data.goal.name}”?${parts.length ? ` ${t('This also archives')} ${parts.join(', ')}.` : ''}`,
            )
        )
            return;
        mutation(async () => {
            await remove(`/api/v1/goals/${encodeURIComponent(id)}`, {
                base_version: data.goal.version,
                include_contents: true,
            });
            leaveAccepted = true;
            window.location.href = '/goals';
        });
    });
    find('[data-goal-edit]').addEventListener('click', () => openQuickEditor('goal', id));
    find('[data-open-milestone-create]').addEventListener('click', () =>
        openQuickCreator('milestone', { goal_id: id, position: data.milestones.length }),
    );
    find('[data-milestone-task-new]').addEventListener('click', () => {
        const milestone = data.milestones.find((item) => item.id === selected);
        if (milestone)
            openQuickCreator('task', { milestone_id: selected, position: milestone.tasks.length });
    });
    find('[data-goal-child-new]').addEventListener('click', () =>
        openQuickCreator('goal', { parent_goal_id: id }),
    );
    find('[data-goal-task-new]').addEventListener('click', () =>
        openQuickCreator('task', { goal_id: id, position: data.direct_tasks.length }),
    );
    for (const [form, buffer, extract, marker] of [
        [strategyForm, strategy, strategyValues, '[data-strategy-state]'],
    ]) {
        form.addEventListener('input', () => {
            const values = new FormData(form);
            buffer.values = Object.fromEntries(
                Object.keys(extract(data?.goal || {})).map((field) => [
                    field,
                    field === 'importance'
                        ? Number(values.get(field))
                        : field === 'deadline' ||
                            (values.get(field) === '' && buffer.saved[field] == null)
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
            t(
                'Leave this goal? Unsaved edits will be lost. A save already sent may still complete.',
            ),
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
    // Edits saved from the floating editor refresh the roadmap in place.
    document.addEventListener('planner:changed', async (event) => {
        const created =
            event.detail?.type === 'milestone' &&
            !data?.milestones.some((item) => item.id === event.detail.id);
        await load();
        if (created && data?.milestones.some((item) => item.id === event.detail.id))
            openMilestone(event.detail.id);
    });
    load().then(() => {
        openHashInformation();
        const milestoneId = new URLSearchParams(location.hash.slice(1)).get('milestone');
        if (milestoneId && data?.milestones.some((item) => item.id === milestoneId))
            openMilestone(milestoneId);
    });
}
