import { get, patch, post, remove } from '../lib/http.js';
import { t } from '../lib/i18n.js';
import { repeatRule } from '../lib/calendar.js';
import { finishCreation } from '../lib/workspace-ui.js';
import { captureRepeatChoice, taskCaptureValues } from './task-capture.js';
import { localDate } from './task-views.js';
import { checkMark } from '../lib/check-mark.js';

const STATUS_LABELS = { todo: 'To do', in_progress: 'In progress', done: 'Completed' };
const CHAT_POLL_MS = 5000;

export function completionPercent(done, total) {
    return total ? Math.round((done / total) * 100) : 0;
}

/** Team goals whose name or description contains every word of the query. */
export function filterTeamGoals(goals, query) {
    const words = query.toLocaleLowerCase().split(/\s+/).filter(Boolean);
    return goals.filter((goal) => {
        const text = `${goal.name} ${goal.description || ''}`.toLocaleLowerCase();
        return words.every((word) => text.includes(word));
    });
}

/** The carousel shows 4 goals per page on wide screens, 2 on tablets and 1 on phones. */
export function goalsPerPage(width) {
    if (width < 560) return 1;
    if (width < 900) return 2;
    return 4;
}

export function carouselPages(total, perPage) {
    return Math.max(1, Math.ceil(total / perPage));
}

/** Short label for a stored team repeat rule, e.g. "Every 2 weeks". */
export function teamRepeatLabel(rule) {
    if (!rule) return '';
    const units = { daily: 'day', weekly: 'week', monthly: 'month', yearly: 'year' };
    if (rule.interval_count === 1)
        return t(
            { daily: 'Daily', weekly: 'Weekly', monthly: 'Monthly', yearly: 'Yearly' }[
                rule.frequency
            ],
        );
    return `${t('Every')} ${rule.interval_count} ${t(`${units[rule.frequency]}s`)}`;
}

/** The API payload for a team task built from the shared Tasks capture fields. */
export function teamTaskPayload(data, today) {
    const values = taskCaptureValues(data);
    const choice = captureRepeatChoice(data);
    const start = values.start_date || values.deadline || today;
    const rule = choice ? repeatRule(choice, start) : null;
    return {
        name: String(data.get('name') || ''),
        description: values.description,
        assignee_id: data.get('assignee_id') || null,
        due_date: values.deadline || (rule ? start : null),
        start_date: values.start_date,
        reminder_at: values.reminder_at,
        estimated_minutes: values.estimated_minutes,
        importance: values.importance,
        repeat: rule ? { ...rule, end_date: choice.end || null } : null,
    };
}

const element = (tag, className, text) => {
    const node = document.createElement(tag);
    if (className) node.className = className;
    if (text !== undefined) node.textContent = text;
    return node;
};

const avatar = (member) => {
    const node = element(
        'span',
        'avatar avatar-small',
        (member.display_name || '?').slice(0, 1).toUpperCase(),
    );
    node.title = member.display_name;
    return node;
};

const roleLabel = (role) => t(role[0].toUpperCase() + role.slice(1));

const errorText = (error) => Object.values(error.payload?.errors || {})[0]?.[0] || error.message;

export function initTeamworkPage(root) {
    const track = root.querySelector('[data-team-goal-grid]');
    const search = root.querySelector('[data-team-search]');
    const arrows = [...root.querySelectorAll('[data-team-page]')];
    const invitations = root.querySelector('[data-team-invitations]');
    const invitationList = root.querySelector('[data-team-invitation-list]');
    const detail = root.querySelector('[data-team-detail]');
    const errorBox = root.querySelector('[data-planning-error]');
    const dialog = root.querySelector('#team-goal-dialog');
    const goalForm = root.querySelector('[data-team-goal-form]');
    const memberList = root.querySelector('[data-team-member-list]');
    const chatLog = root.querySelector('[data-team-chat-log]');
    const chatForm = root.querySelector('[data-team-chat-form]');
    const taskForm = root.querySelector('[data-team-task-form]');
    const inviteForm = root.querySelector('[data-team-invite]');
    let selected = new URLSearchParams(window.location.search).get('goal');
    let current = null;
    let editing = false;
    let newMembers = [];
    let lastMessage = 0;
    let chatTimer = null;
    let goals = [];
    let page = 0;

    const today = () =>
        localDate(new Date().toISOString(), window.notesBootstrap?.preferences?.timezone || 'UTC');
    const showError = (error) => {
        errorBox.textContent = errorText(error);
        errorBox.classList.remove('is-hidden');
    };
    const clearError = () => errorBox.classList.add('is-hidden');
    const dialogError = (form, error) => {
        const box = form.closest('dialog').querySelector('[data-dialog-error]');
        box.textContent = errorText(error);
        box.classList.remove('is-hidden');
    };

    const renderMembersDraft = () => {
        memberList.replaceChildren();
        newMembers.forEach((member, index) => {
            const item = element('li', '', `${member.email} · ${roleLabel(member.role)}`);
            const drop = element('button', 'text-button', t('Remove'));
            drop.type = 'button';
            drop.addEventListener('click', () => {
                newMembers.splice(index, 1);
                renderMembersDraft();
            });
            item.append(drop);
            memberList.append(item);
        });
    };

    const goalCard = (goal) => {
        const card = element(
            'button',
            `team-goal-card${goal.id === selected ? ' is-selected' : ''}`,
        );
        card.type = 'button';
        card.setAttribute('aria-pressed', String(goal.id === selected));
        const percent = completionPercent(goal.progress.done, goal.progress.total);
        const bar = element('div', 'progress-track');
        const fill = element('span');
        fill.style.width = `${percent}%`;
        bar.append(fill);
        const avatars = element('span', 'avatar-stack');
        goal.members
            .filter((member) => member.status === 'accepted')
            .slice(0, 5)
            .forEach((member) => avatars.append(avatar(member)));
        card.append(
            element('strong', '', goal.name),
            element(
                'small',
                '',
                goal.due_date ? `${t('Due')}: ${goal.due_date}` : t('No due date'),
            ),
            bar,
            element(
                'small',
                '',
                `${percent}% ${t('complete')} · ${goal.progress.total} ${t('tasks')}`,
            ),
            avatars,
        );
        card.addEventListener('click', () => select(goal.id));
        return card;
    };

    // Slides the carousel so the requested page fills the viewport.
    const renderCarousel = () => {
        const perPage = goalsPerPage(track.parentElement.clientWidth || window.innerWidth);
        const visible = filterTeamGoals(goals, search.value);
        const pages = carouselPages(visible.length, perPage);
        page = Math.min(Math.max(page, 0), pages - 1);
        track.style.setProperty('--team-per-page', perPage);
        track.style.transform = `translateX(calc(${-page} * (100% + var(--team-carousel-gap))))`;
        track.replaceChildren(...visible.map(goalCard));
        if (!visible.length)
            track.append(
                element(
                    'p',
                    'subtle-copy',
                    goals.length
                        ? t('No team goals match your search.')
                        : t('No team goals yet. Add one and invite your teammates.'),
                ),
            );
        arrows[0].disabled = page === 0;
        arrows[1].disabled = page >= pages - 1;
    };

    const renderOverview = (data) => {
        invitations.hidden = !data.invitations.length;
        invitationList.replaceChildren();
        for (const goal of data.invitations) {
            const row = element('article', 'planning-list-item');
            row.append(element('strong', '', goal.name));
            const actions = element('div', 'action-row');
            for (const action of ['accept', 'decline']) {
                const button = element(
                    'button',
                    action === 'accept' ? 'button button-primary' : 'button button-quiet',
                    t(action === 'accept' ? 'Join' : 'Decline'),
                );
                button.type = 'button';
                button.addEventListener('click', async () => {
                    try {
                        renderOverview(
                            (await post(`/api/v1/team-goals/${goal.id}/invitation/${action}`, {}))
                                .payload.data,
                        );
                        if (action === 'accept') select(goal.id);
                    } catch (error) {
                        showError(error);
                    }
                });
                actions.append(button);
            }
            row.append(actions);
            invitationList.append(row);
        }
        goals = data.goals;
        renderCarousel();
    };

    const loadOverview = async () => {
        try {
            renderOverview((await get('/api/v1/team-goals')).payload.data);
        } catch (error) {
            showError(error);
        }
    };

    const memberRow = (goal, member, canManage) => {
        const row = element('div', 'team-member-row');
        const memberPercent = completionPercent(member.done, member.assigned);
        const bar = element('div', 'progress-track');
        const fill = element('span');
        fill.style.width = `${memberPercent}%`;
        bar.append(fill);
        const name = element('div', 'team-member-name');
        name.append(
            element(
                'strong',
                '',
                `${member.display_name}${member.status === 'pending' ? ` (${t('invited')})` : ''}`,
            ),
            element(
                'small',
                'subtle-copy',
                member.assigned ? `${member.done}/${member.assigned} · ${memberPercent}%` : '—',
            ),
        );
        // The member's own profile biography, so teammates know who they work with.
        if (member.biography) name.append(element('p', 'team-member-bio', member.biography));
        row.append(avatar(member), name, bar);
        if (canManage && String(member.id) !== String(window.notesBootstrap.user.id)) {
            const role = element('select');
            role.setAttribute('aria-label', `${t('Role')}: ${member.display_name}`);
            for (const value of ['viewer', 'editor', 'admin'])
                role.append(new Option(roleLabel(value), value, false, value === member.role));
            role.addEventListener('change', async () => {
                try {
                    renderDetail(
                        (
                            await patch(`/api/v1/team-goals/${goal.id}/members/${member.id}`, {
                                role: role.value,
                            })
                        ).payload.data,
                    );
                } catch (error) {
                    role.value = member.role;
                    showError(error);
                }
            });
            const kick = element('button', 'text-button is-danger', t('Remove'));
            kick.type = 'button';
            kick.addEventListener('click', async () => {
                if (!window.confirm(`${t('Remove')} ${member.display_name}?`)) return;
                try {
                    await remove(`/api/v1/team-goals/${goal.id}/members/${member.id}`);
                    select(goal.id);
                } catch (error) {
                    showError(error);
                }
            });
            row.append(role, kick);
        } else {
            row.append(element('small', 'context-chip', roleLabel(member.role)));
        }
        return row;
    };

    const updateTask = async (goal, task, changes) => {
        try {
            renderDetail(
                (
                    await patch(`/api/v1/team-goals/${goal.id}/tasks/${task.id}`, {
                        base_version: task.version,
                        ...changes,
                    })
                ).payload.data,
            );
            loadOverview();
        } catch (error) {
            showError(error);
            select(goal.id);
        }
    };

    const taskRow = (goal, task, canEditTasks) => {
        const mine = String(task.assignee?.id) === String(window.notesBootstrap.user.id);
        const done = task.status === 'done';
        const overdue = !done && task.due_date && task.due_date < today();
        const row = element(
            'article',
            `planning-list-item team-task${done ? ' is-done' : ''}${overdue ? ' is-overdue' : ''}`,
        );
        const tick = element('button', 'task-completion-button');
        if (done) tick.append(checkMark());
        tick.type = 'button';
        tick.disabled = !canEditTasks && !mine;
        tick.setAttribute('aria-pressed', String(done));
        tick.setAttribute('aria-label', `${done ? t('Reopen') : t('Complete')}: ${task.name}`);
        tick.addEventListener('click', () =>
            updateTask(goal, task, { status: done ? 'todo' : 'done' }),
        );

        const copy = element('div', 'team-task-copy');
        copy.append(element('strong', '', task.name));
        if (task.description) copy.append(element('p', 'subtle-copy', task.description));
        const meta = [`${t('Assigned')}: ${task.assignee?.display_name || t('Unassigned')}`];
        if (task.due_date) meta.push(`${overdue ? t('Overdue') : t('Due')}: ${task.due_date}`);
        if (task.reminder_at)
            meta.push(
                `${t('Reminder')}: ${new Date(task.reminder_at).toLocaleString([], { dateStyle: 'short', timeStyle: 'short' })}`,
            );
        if (task.repeat) meta.push(`↻ ${teamRepeatLabel(task.repeat)}`);
        if (task.estimated_minutes) meta.push(`${task.estimated_minutes} ${t('min')}`);
        copy.append(element('small', 'team-task-meta', meta.join(' · ')));

        const star = element(
            'span',
            `team-task-importance${task.importance >= 4 ? ' is-important' : ''}`,
        );
        star.textContent = task.importance >= 4 ? '★' : '☆';
        star.title = `${t('Importance')}: ${task.importance}/5`;

        const statusControl = element('select', `status-pill is-${task.status}`);
        statusControl.setAttribute('aria-label', `${t('Status')}: ${task.name}`);
        statusControl.disabled = !canEditTasks && !mine;
        for (const [value, label] of Object.entries(STATUS_LABELS))
            statusControl.append(new Option(t(label), value, false, value === task.status));
        statusControl.addEventListener('change', () =>
            updateTask(goal, task, { status: statusControl.value }),
        );
        row.append(tick, copy, star, statusControl);
        if (canEditTasks) {
            const archive = element('button', 'text-button is-danger', t('Remove'));
            archive.type = 'button';
            archive.addEventListener('click', async () => {
                if (!window.confirm(`${t('Remove')} “${task.name}”?`)) return;
                try {
                    renderDetail(
                        (await remove(`/api/v1/team-goals/${goal.id}/tasks/${task.id}`)).payload
                            .data,
                    );
                    loadOverview();
                } catch (error) {
                    showError(error);
                }
            });
            row.append(archive);
        }
        return row;
    };

    const renderDetail = (goal) => {
        current = goal;
        detail.hidden = false;
        const canManage = goal.my_role === 'admin';
        const canEditTasks = ['admin', 'editor'].includes(goal.my_role);
        root.querySelector('[data-team-name]').textContent = goal.name;
        root.querySelector('[data-team-description]').textContent =
            goal.description || t('No description.');
        root.querySelector('[data-team-due]').textContent = goal.due_date
            ? `${t('Due')}: ${goal.due_date}`
            : t('No due date');
        const percent = completionPercent(goal.progress.done, goal.progress.total);
        root.querySelector('[data-team-progress-bar]').style.width = `${percent}%`;
        root.querySelector('[data-team-progress]').textContent =
            `${goal.progress.done}/${goal.progress.total} ${t('tasks completed')} (${percent}%)`;
        root.querySelector('[data-team-edit]').hidden = !canManage;
        root.querySelector('[data-team-invite-open]').hidden = !canManage;
        root.querySelector('[data-team-task-open]').hidden = !canEditTasks;

        const members = root.querySelector('[data-team-members]');
        const assignee = root.querySelector('[data-team-assignee]');
        assignee.replaceChildren(new Option(t('Unassigned'), ''));
        members.replaceChildren(
            ...goal.members.map((member) => memberRow(goal, member, canManage)),
        );
        for (const member of goal.members)
            if (member.status === 'accepted')
                assignee.append(new Option(member.display_name, member.id));

        // Open tasks first, then the Completed list underneath, like the Tasks page.
        const tasks = root.querySelector('[data-team-tasks]');
        const open = goal.tasks.filter((task) => task.status !== 'done');
        const finished = goal.tasks.filter((task) => task.status === 'done');
        tasks.replaceChildren(...open.map((task) => taskRow(goal, task, canEditTasks)));
        if (!goal.tasks.length) tasks.append(element('p', 'subtle-copy', t('No tasks yet.')));
        if (finished.length) {
            tasks.append(
                element('h4', 'team-completed-heading', `${t('Completed')} (${finished.length})`),
            );
            tasks.append(...finished.map((task) => taskRow(goal, task, canEditTasks)));
        }
        track.querySelectorAll('.team-goal-card').forEach((card, index) => {
            const isSelected = filterTeamGoals(goals, search.value)[index]?.id === goal.id;
            card.classList.toggle('is-selected', isSelected);
            card.setAttribute('aria-pressed', String(isSelected));
        });
    };

    const appendMessages = (messages) => {
        for (const message of messages) {
            if (message.id <= lastMessage) continue;
            lastMessage = message.id;
            const bubble = element('div', `team-message${message.mine ? ' is-mine' : ''}`);
            bubble.append(
                element('strong', '', message.author?.display_name || t('Former member')),
                element('small', '', new Date(message.created_at).toLocaleString()),
                element('p', '', message.body),
            );
            chatLog.append(bubble);
        }
        chatLog.scrollTop = chatLog.scrollHeight;
    };
    const pollChat = async () => {
        if (!current || document.hidden) return;
        try {
            appendMessages(
                (await get(`/api/v1/team-goals/${current.id}/messages?after=${lastMessage}`))
                    .payload.data,
            );
        } catch {
            // The next poll retries; membership loss surfaces on reload.
        }
    };

    async function select(goalId) {
        clearError();
        selected = goalId;
        window.history.replaceState(null, '', `/teamwork?goal=${encodeURIComponent(goalId)}`);
        try {
            renderDetail((await get(`/api/v1/team-goals/${goalId}`)).payload.data);
            chatLog.replaceChildren();
            lastMessage = 0;
            await pollChat();
            window.clearInterval(chatTimer);
            chatTimer = window.setInterval(pollChat, CHAT_POLL_MS);
        } catch (error) {
            detail.hidden = true;
            current = null;
            showError(error);
        }
    }

    search.addEventListener('input', () => {
        page = 0;
        renderCarousel();
    });
    arrows.forEach((arrow) =>
        arrow.addEventListener('click', () => {
            page += Number(arrow.dataset.teamPage);
            renderCarousel();
        }),
    );
    window.addEventListener('resize', () => renderCarousel());

    root.querySelector('[data-team-member-add]').addEventListener('click', () => {
        const email = root.querySelector('[data-team-member-email]');
        if (!email.value || !email.checkValidity()) {
            email.reportValidity();
            return;
        }
        newMembers.push({
            email: email.value.trim(),
            role: root.querySelector('[data-team-member-role]').value,
        });
        email.value = '';
        renderMembersDraft();
    });
    root.querySelector('[data-open-dialog="team-goal-dialog"]').addEventListener('click', () => {
        editing = false;
        goalForm.reset();
        newMembers = [];
        renderMembersDraft();
        root.querySelector('[data-team-new-members]').hidden = false;
        root.querySelector('[data-team-dialog-title]').textContent = t('Add new goal');
    });
    root.querySelector('[data-team-edit]').addEventListener('click', () => {
        editing = true;
        goalForm.elements.name.value = current.name;
        goalForm.elements.description.value = current.description;
        goalForm.elements.due_date.value = current.due_date || '';
        root.querySelector('[data-team-new-members]').hidden = true;
        root.querySelector('[data-team-dialog-title]').textContent = t('Edit goal');
        dialog.showModal();
    });
    goalForm.addEventListener('submit', async (event) => {
        event.preventDefault();
        const fields = {
            name: goalForm.elements.name.value,
            description: goalForm.elements.description.value,
            due_date: goalForm.elements.due_date.value || null,
        };
        try {
            const goal = editing
                ? (
                      await patch(`/api/v1/team-goals/${current.id}`, {
                          ...fields,
                          base_version: current.version,
                      })
                  ).payload.data
                : (await post('/api/v1/team-goals', { ...fields, members: newMembers })).payload
                      .data;
            dialog.close();
            await loadOverview();
            select(goal.id);
        } catch (error) {
            dialogError(goalForm, error);
        }
    });
    root.querySelector('[data-team-leave]').addEventListener('click', async () => {
        if (!current || !window.confirm(t('Leave this team goal?'))) return;
        try {
            await remove(
                `/api/v1/team-goals/${current.id}/members/${window.notesBootstrap.user.id}`,
            );
            detail.hidden = true;
            current = null;
            window.clearInterval(chatTimer);
            window.history.replaceState(null, '', '/teamwork');
            loadOverview();
        } catch (error) {
            showError(error);
        }
    });
    inviteForm.addEventListener('submit', async (event) => {
        event.preventDefault();
        try {
            renderDetail(
                (
                    await post(`/api/v1/team-goals/${current.id}/members`, {
                        email: inviteForm.elements.email.value,
                        role: inviteForm.elements.role.value,
                    })
                ).payload.data,
            );
            inviteForm.reset();
            finishCreation(inviteForm);
        } catch (error) {
            dialogError(inviteForm, error);
        }
    });
    taskForm.addEventListener('submit', async (event) => {
        event.preventDefault();
        try {
            const payload = teamTaskPayload(new FormData(taskForm), today());
            renderDetail(
                (await post(`/api/v1/team-goals/${current.id}/tasks`, payload)).payload.data,
            );
            taskForm.reset();
            taskForm.dispatchEvent(new CustomEvent('schedule:refresh'));
            finishCreation(taskForm);
            loadOverview();
        } catch (error) {
            dialogError(taskForm, error);
        }
    });
    chatForm.addEventListener('submit', async (event) => {
        event.preventDefault();
        const body = chatForm.elements.body.value;
        try {
            appendMessages(
                (await post(`/api/v1/team-goals/${current.id}/messages`, { body })).payload.data,
            );
            chatForm.reset();
        } catch (error) {
            showError(error);
        }
    });
    get('/api/v1/contacts')
        .then((response) => {
            const list = root.querySelector('[data-team-contacts]');
            for (const contact of response.payload.data)
                list.append(new Option(contact.display_name, contact.email));
        })
        .catch(() => {});
    loadOverview().then(() => {
        if (!selected) return;
        // Open the carousel on the page that holds the linked goal.
        const index = goals.findIndex((goal) => goal.id === selected);
        if (index >= 0) {
            page = Math.floor(
                index / goalsPerPage(track.parentElement.clientWidth || window.innerWidth),
            );
            renderCarousel();
        }
        select(selected);
    });
}
