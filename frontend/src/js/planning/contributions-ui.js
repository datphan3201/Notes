import { get, post, remove } from '../lib/http.js';
import { t } from '../lib/i18n.js';

const paths = { goal: 'goals', milestone: 'milestones', task: 'tasks' };

function element(tag, text, className) {
    const node = document.createElement(tag);
    if (text !== undefined) node.textContent = text;
    if (className) node.className = className;
    return node;
}

/**
 * Shows the Goals an item also supports and lets the owner link or unlink
 * them. Each change re-reads the item first so it uses the current version.
 */
export async function renderContributions(container, { type, id, excludeGoalId = null, onError }) {
    const base = `/api/v1/${paths[type]}/${encodeURIComponent(id)}`;
    const report = onError || (() => {});
    container.replaceChildren(element('p', t('Loading…'), 'subtle-copy'));
    let linked;
    let goals;
    try {
        [linked, goals] = await Promise.all([
            get(`${base}/contributions`).then((response) => response.payload.data),
            get('/api/v1/goals').then((response) => response.payload.data),
        ]);
    } catch (error) {
        report(error);
        container.replaceChildren(element('p', t('Unable to load related goals.'), 'subtle-copy'));
        return;
    }
    const rerender = () => renderContributions(container, { type, id, excludeGoalId, onError });
    const mutate = async (control, operation) => {
        control.disabled = true;
        try {
            const current = (await get(base)).payload.data;
            await operation(current.version);
            await rerender();
        } catch (error) {
            report(error);
            control.disabled = false;
        }
    };

    container.replaceChildren();
    const list = element('div', undefined, 'contribution-list');
    for (const goal of linked) {
        const row = element('div', undefined, 'contribution-row');
        const link = element('a', goal.name, 'planning-item-link');
        link.href = `/goals/${encodeURIComponent(goal.id)}`;
        const unlink = element('button', '×', 'icon-button');
        unlink.type = 'button';
        unlink.setAttribute('aria-label', `${t('Unlink')} ${goal.name}`);
        unlink.title = t('Unlink');
        unlink.addEventListener('click', () =>
            mutate(unlink, (version) =>
                remove(`${base}/contributions/${encodeURIComponent(goal.id)}`, {
                    base_version: version,
                }),
            ),
        );
        row.append(link, unlink);
        list.append(row);
    }
    if (!linked.length)
        list.append(element('p', t('Not linked to other goals yet.'), 'subtle-copy'));
    container.append(list);

    const linkedIds = new Set(linked.map((goal) => goal.id));
    const available = goals.filter(
        (goal) => !linkedIds.has(goal.id) && goal.id !== excludeGoalId && goal.id !== id,
    );
    if (!available.length) return;
    const form = element('form', undefined, 'inline-form contribution-form');
    const select = element('select');
    select.setAttribute('aria-label', t('Goal this also supports'));
    select.append(new Option(t('Also supports…'), ''));
    for (const goal of available) select.append(new Option(goal.name, goal.id));
    const add = element('button', t('Link'), 'button button-quiet');
    add.type = 'submit';
    form.append(select, add);
    form.addEventListener('submit', (event) => {
        event.preventDefault();
        if (!select.value) return;
        mutate(add, (version) =>
            post(`${base}/contributions`, { goal_id: select.value, base_version: version }),
        );
    });
    container.append(form);
}
