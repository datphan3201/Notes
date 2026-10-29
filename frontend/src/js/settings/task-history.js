import { get, patch } from '../lib/http.js';
import { t, statusLabel } from '../lib/i18n.js';
import { taskInHistory, historyThresholds } from '../planning/task-views.js';
import { transitionEntity } from '../planning/transitions.js';

export function historyMatches(task, query) {
    const needle = query.trim().toLocaleLowerCase();
    if (!needle) return true;
    return `${task.name} ${task.description || ''}`.toLocaleLowerCase().includes(needle);
}

export function initTaskHistory(root) {
    const rules = root.querySelector('[data-history-rules]');
    const status = root.querySelector('[data-history-status]');
    const search = root.querySelector('[data-history-search]');
    const list = root.querySelector('[data-history-list]');
    let tasks = [];
    let today = null;

    const render = () => {
        const thresholds = historyThresholds();
        const items = tasks
            .filter((task) => taskInHistory(task, today, Date.now(), thresholds))
            .filter((task) => historyMatches(task, search.value));
        list.replaceChildren();
        if (!items.length) {
            list.textContent = t('No tasks in history.');
            return;
        }
        for (const task of items) {
            const row = document.createElement('article');
            row.className = 'planning-list-item';
            const copy = document.createElement('div');
            const name = document.createElement('a');
            name.href = `/tasks/${encodeURIComponent(task.id)}`;
            name.textContent = task.name;
            const facts = document.createElement('small');
            const when = task.completed_at
                ? `${t('Completed at')} ${new Date(task.completed_at).toLocaleString()}`
                : `${t('Due')} ${task.deadline}`;
            facts.textContent = `${statusLabel(task.status)} · ${when}`;
            copy.append(name, facts);
            if (task.description) {
                const description = document.createElement('p');
                description.className = 'subtle-copy';
                description.textContent = task.description;
                copy.append(description);
            }
            const reopen = document.createElement('button');
            reopen.type = 'button';
            reopen.className = 'button button-quiet';
            reopen.textContent = task.status === 'Done' ? t('Reopen') : t('Open task');
            reopen.addEventListener('click', async () => {
                if (task.status !== 'Done') {
                    window.location.assign(`/tasks/${encodeURIComponent(task.id)}#edit`);
                    return;
                }
                reopen.disabled = true;
                try {
                    if (await transitionEntity('task', task, 'reopen')) await load();
                } catch (error) {
                    status.textContent = error.message;
                } finally {
                    reopen.disabled = false;
                }
            });
            row.append(copy, reopen);
            list.append(row);
        }
    };
    const load = async () => {
        const [response, dashboard] = await Promise.all([
            get('/api/v1/tasks'),
            get('/api/v1/dashboard'),
        ]);
        tasks = response.payload.data;
        today = dashboard.payload.data.today;
        render();
    };
    rules.addEventListener('submit', async (event) => {
        event.preventDefault();
        const data = new FormData(rules);
        const retention = data.get('history_retention_days');
        try {
            const saved = (
                await patch('/api/v1/preferences', {
                    history_completed_hours: Number(data.get('history_completed_hours')),
                    history_overdue_days: Number(data.get('history_overdue_days')),
                    history_retention_days: retention ? Number(retention) : null,
                })
            ).payload.data;
            Object.assign(window.notesBootstrap.preferences, saved);
            status.textContent = t('Saved.');
            render();
        } catch (error) {
            status.textContent =
                Object.values(error.payload?.errors || {})[0]?.[0] || error.message;
        }
    });
    search.addEventListener('input', render);
    load().catch((error) => {
        list.textContent = error.message;
    });
}
