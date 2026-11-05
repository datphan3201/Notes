import { get, post } from '../lib/http.js';
import { t } from '../lib/i18n.js';

// The assistant is a non-modal panel so the rest of Planner stays usable while
// it is open. Its open state and conversation survive page navigation within
// the browser tab through sessionStorage.
const STORAGE_KEY = 'planner.assistant';

function loadState() {
    try {
        const state = JSON.parse(sessionStorage.getItem(STORAGE_KEY));
        return {
            open: Boolean(state?.open),
            messages: Array.isArray(state?.messages) ? state.messages : [],
        };
    } catch {
        return { open: false, messages: [] };
    }
}

// Validation errors carry per-field details; show them instead of only the
// generic "The submitted data is invalid." message.
function errorText(error) {
    const details = Object.values(error?.payload?.errors || {})
        .flat()
        .filter(Boolean);
    const seconds = Number(error?.retryAfter);
    if (error?.status === 429 && seconds > 0) {
        details.push(
            t('Try again in :minutes minutes.').replace(':minutes', Math.ceil(seconds / 60)),
        );
    }
    return [error?.message || t('The assistant could not answer right now.'), ...details].join(
        '\n',
    );
}

// Models answer in Markdown. Render only **bold** and `code` as DOM nodes
// (never HTML strings), so AI text cannot inject markup; other markers stay text.
function inlineMarkdown(text) {
    return String(text)
        .split(/(\*\*[^*\n]+\*\*|`[^`\n]+`)/)
        .filter(Boolean)
        .map((part) => {
            if (part.startsWith('**') && part.endsWith('**') && part.length > 4) {
                return Object.assign(document.createElement('strong'), {
                    textContent: part.slice(2, -2),
                });
            }
            if (part.startsWith('`') && part.endsWith('`') && part.length > 2) {
                return Object.assign(document.createElement('code'), {
                    textContent: part.slice(1, -1),
                });
            }
            return document.createTextNode(part);
        });
}

const ACTION_LABELS = {
    create_task: 'New Task',
    update_task: 'Edit Task',
    complete_task: 'Complete Task',
    reopen_task: 'Reopen Task',
    delete_task: 'Delete Task',
    create_note: 'New Note',
    update_note: 'Edit Note',
    delete_note: 'Delete Note',
    create_goal: 'New Goal',
    update_goal: 'Edit Goal',
    complete_goal: 'Complete Goal',
    reopen_goal: 'Reopen Goal',
    delete_goal: 'Delete Goal',
    create_milestone: 'New Milestone',
    update_milestone: 'Edit Milestone',
    complete_milestone: 'Complete Milestone',
    reopen_milestone: 'Reopen Milestone',
    delete_milestone: 'Delete Milestone',
    order_milestones: 'Milestone order',
    move_task: 'Move Task',
    reschedule: 'Reschedule',
    create_habit: 'New Habit',
    update_habit: 'Edit Habit',
    delete_habit: 'Delete Habit',
    check_in_habit: 'Check in Habit',
};
const DESTRUCTIVE = [
    'delete_task',
    'delete_note',
    'delete_goal',
    'delete_milestone',
    'delete_habit',
];
const FIELD_LABELS = {
    name: 'Name',
    title: 'Title',
    description: 'Description',
    content: 'Content',
    deadline: 'Due date',
    start_date: 'Start date',
    scheduled_start: 'Scheduled start',
    scheduled_end: 'Scheduled end',
    importance: 'Importance',
    expected_result: 'Expected result',
    completion_criteria: 'Completion criteria',
    strategy_notes: 'Strategy notes',
    parent: 'Location',
    after: 'After',
    period: 'Period',
    target_frequency: 'Target frequency',
    date: 'Date',
};

// Cards saved before previews existed only had create_task operations.
function proposalItems(message) {
    if (Array.isArray(message.preview) && message.preview.length) return message.preview;
    return message.proposal.proposal.operations
        .filter((operation) => operation.op === 'create_task')
        .map(({ fields }) => ({ action: 'create_task', label: fields.name, changes: [] }));
}

function shorten(value) {
    if (value === null || value === undefined || value === '') return '';
    const text = String(value).replace(/\s+/g, ' ');
    return text.length > 120 ? `${text.slice(0, 117)}…` : text;
}

function saveState(state) {
    try {
        sessionStorage.setItem(STORAGE_KEY, JSON.stringify(state));
    } catch {
        // Storage can be unavailable (private mode, quota); the panel still works.
    }
}

export function initAssistant(doc = document) {
    const launcher = doc.querySelector('[data-assistant-open]');
    const dialog = doc.querySelector('[data-assistant-dialog]');
    if (!launcher || !dialog) return;
    const log = dialog.querySelector('[data-assistant-log]');
    const form = dialog.querySelector('[data-assistant-form]');
    const status = dialog.querySelector('[data-assistant-status]');
    const state = loadState();
    let checked = false;

    const render = (role, text) => {
        const bubble = document.createElement('p');
        bubble.className = `assistant-message is-${role}`;
        if (role === 'assistant') bubble.append(...inlineMarkdown(text));
        else bubble.textContent = text;
        log.append(bubble);
        log.scrollTop = log.scrollHeight;
    };
    // A proposal card asks before anything changes: Apply sends the exact
    // version and hash shown (the server rejects it if anything changed since),
    // Cancel rejects the proposal.
    const renderProposal = (message) => {
        const { proposal } = message;
        const card = document.createElement('div');
        card.className = 'assistant-message is-assistant assistant-proposal';
        const title = document.createElement('p');
        title.textContent = t('Apply these changes?');
        const list = document.createElement('ul');
        proposalItems(message).forEach(({ action, label, changes }) => {
            const item = document.createElement('li');
            item.classList.toggle('is-destructive', DESTRUCTIVE.includes(action));
            item.append(
                Object.assign(document.createElement('strong'), {
                    textContent: t(ACTION_LABELS[action] || action),
                }),
                ` ${label}`,
            );
            if (changes.length) {
                const details = document.createElement('ul');
                changes.forEach(({ field, from, to }) => {
                    const line = document.createElement('li');
                    const before = shorten(from);
                    // A cleared value (such as a removed time slot) reads as None, not a blank.
                    const after = shorten(to) || t('None');
                    line.textContent = before
                        ? `${t(FIELD_LABELS[field] || field)}: ${before} → ${after}`
                        : `${t(FIELD_LABELS[field] || field)}: ${after}`;
                    details.append(line);
                });
                item.append(details);
            }
            list.append(item);
        });
        const footer = document.createElement('div');
        footer.className = 'assistant-proposal-actions';
        card.append(title, list, footer);

        const settle = (outcome, text) => {
            message.outcome = outcome;
            message.text = text;
            saveState(state);
            footer.replaceChildren(
                Object.assign(document.createElement('small'), { textContent: text }),
            );
        };
        if (message.outcome) {
            settle(message.outcome, message.text);
        } else {
            const button = (label, className, handler) => {
                const element = Object.assign(document.createElement('button'), {
                    type: 'button',
                    className,
                    textContent: label,
                });
                element.addEventListener('click', async () => {
                    footer.querySelectorAll('button').forEach((b) => (b.disabled = true));
                    try {
                        await handler();
                    } catch (error) {
                        footer.querySelectorAll('button').forEach((b) => (b.disabled = false));
                        render('error', errorText(error));
                    }
                });
                return element;
            };
            footer.append(
                button(t('Apply'), 'button button-primary', async () => {
                    await post(`/api/v1/ai/actions/${proposal.id}/apply`, {
                        base_version: proposal.version,
                        proposal_hash: proposal.proposal_hash,
                    });
                    settle(
                        'applied',
                        t('Applied :count changes.').replace(
                            ':count',
                            proposalItems(message).length,
                        ),
                    );
                }),
                button(t('Cancel'), 'button', async () => {
                    await post(`/api/v1/ai/actions/${proposal.id}/reject`, {
                        base_version: proposal.version,
                    });
                    settle('rejected', t('Cancelled. Nothing was changed.'));
                }),
            );
        }
        log.append(card);
        log.scrollTop = log.scrollHeight;
    };
    const say = (role, text) => {
        render(role, text);
        if (role !== 'error') {
            state.messages.push({ role, text });
            saveState(state);
        }
    };
    const checkAvailability = async () => {
        if (checked) return;
        checked = true;
        try {
            if (!(await get('/api/v1/ai/chat')).payload.data.available) {
                status.textContent = t(
                    'The AI assistant is not enabled on this server. You can still use the rest of Planner.',
                );
                form.querySelector('[type="submit"]').disabled = true;
            }
        } catch {
            checked = false;
        }
    };
    const open = ({ focus = true } = {}) => {
        if (!dialog.open) dialog.show();
        launcher.setAttribute('aria-expanded', 'true');
        state.open = true;
        saveState(state);
        log.scrollTop = log.scrollHeight;
        if (focus) form.elements.question.focus();
        checkAvailability();
    };
    const close = () => {
        dialog.close();
        launcher.setAttribute('aria-expanded', 'false');
        state.open = false;
        saveState(state);
        launcher.focus();
    };

    state.messages.forEach((message) =>
        message.role === 'proposal' ? renderProposal(message) : render(message.role, message.text),
    );
    launcher.setAttribute('aria-expanded', 'false');
    if (state.open) open({ focus: false });

    launcher.addEventListener('click', () => (dialog.open ? close() : open()));
    dialog.querySelector('[data-assistant-close]').addEventListener('click', close);
    dialog.addEventListener('keydown', (event) => {
        if (event.key === 'Escape') {
            event.preventDefault();
            close();
        }
    });
    doc.querySelector('form[action="/logout"]')?.addEventListener('submit', () => {
        sessionStorage.removeItem(STORAGE_KEY);
    });
    form.elements.question.addEventListener('keydown', (event) => {
        if (event.key === 'Enter' && !event.shiftKey) {
            event.preventDefault();
            form.requestSubmit();
        }
    });
    form.addEventListener('submit', async (event) => {
        event.preventDefault();
        const question = form.elements.question.value.trim();
        if (!question) return;
        const submit = form.querySelector('[type="submit"]');
        submit.disabled = true;
        // Proposal cards go into the history as assistant turns with their
        // outcome, so the model knows a request was already handled and does
        // not queue the same changes again.
        const outcomes = { applied: 'applied by the user', rejected: 'cancelled by the user' };
        const history = state.messages
            .filter(({ role }) => ['user', 'assistant', 'proposal'].includes(role))
            .slice(-12)
            .map((message) => {
                if (message.role !== 'proposal') return { role: message.role, text: message.text };
                const changes = proposalItems(message)
                    .map(({ action, label }) => `${action} "${label}"`)
                    .join('; ');
                const outcome = outcomes[message.outcome] || 'waiting for confirmation';
                return {
                    role: 'assistant',
                    text: `[Proposed changes: ${changes}. Status: ${outcome}. This request is handled.]`,
                };
            });
        say('user', question);
        form.elements.question.value = '';
        try {
            const { answer, proposal, preview } = (
                await post('/api/v1/ai/chat', { question, history })
            ).payload.data;
            // A tool call (proposal) often arrives without text; the card speaks for it.
            if (answer) say('assistant', answer);
            else if (!proposal) say('error', t('The assistant could not answer right now.'));
            if (proposal) {
                const message = { role: 'proposal', proposal, preview };
                state.messages.push(message);
                saveState(state);
                renderProposal(message);
            }
        } catch (error) {
            say('error', errorText(error));
            form.elements.question.value = question;
        } finally {
            submit.disabled = false;
            form.elements.question.focus();
        }
    });
}
