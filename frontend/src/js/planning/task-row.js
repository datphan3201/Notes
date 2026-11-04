import { quickEditLink } from './quick-editor.js';
import { checkMark } from '../lib/check-mark.js';
import { t } from '../lib/i18n.js';

// The shared row structure keeps completion, the editor link and action alignment consistent.
// Callers own facts, planning controls, mutation/reload and focus restoration.
export function taskRowShell(
    task,
    { facts, overdue = false, context = null, tags = [], onToggle },
) {
    const done = task.status === 'Done';
    const article = document.createElement('article');
    article.className = `planning-list-item task-row${overdue ? ' is-overdue' : ''}${done ? ' is-done' : ''}`;
    const copy = document.createElement('div');
    copy.className = 'task-row-copy';
    if (context) {
        const chip = document.createElement('span');
        chip.className = 'context-chip';
        chip.textContent = context;
        copy.append(chip);
    }
    const name = document.createElement('a');
    name.href = `/tasks/${encodeURIComponent(task.id)}`;
    name.textContent = task.name;
    quickEditLink(name, 'task', task.id);
    const meta = document.createElement('small');
    meta.textContent = facts;
    copy.append(name, meta, ...tags);
    const completion = document.createElement('button');
    completion.type = 'button';
    completion.className = 'task-completion-button';
    completion.setAttribute('aria-label', `${done ? t('Reopen') : t('Complete')} ${task.name}`);
    completion.setAttribute('aria-pressed', String(done));
    if (done) completion.append(checkMark());
    completion.addEventListener('click', () => onToggle(completion));
    const actions = document.createElement('div');
    actions.className = 'action-row task-row-actions';
    article.append(completion, copy, actions);
    return { article, copy, completion, actions };
}
