import { formatMoment } from '../lib/format.js';
import { get, post } from '../lib/http.js';
import { t, statusLabel } from '../lib/i18n.js';
import { collectionPage, renderPagination } from '../planning/collection-page.js';

const TYPE_LABELS = {
    area: 'Area',
    goal: 'Goal',
    milestone: 'Milestone',
    task: 'Task',
    habit: 'Habit',
};

/** The archived items shown for a type filter and a name search, newest first as served. */
export function archiveMatches(items, { type = 'all', query = '' } = {}) {
    const needle = query.trim().toLocaleLowerCase();
    return items.filter(
        (item) =>
            (type === 'all' || item.type === type) &&
            (!needle || item.name.toLocaleLowerCase().includes(needle)),
    );
}

/** Why an item cannot be restored yet: it lives inside an archived parent (Habits only link to a Goal). */
export function restoreBlocker(item) {
    if (!item.parent?.archived || item.type === 'habit') return '';
    return t('Inside the archived :type “:name”. Restore it first.')
        .replace(':type', t(TYPE_LABELS[item.parent.type]))
        .replace(':name', item.parent.name);
}

export function initArchivePage(root) {
    const list = root.querySelector('[data-archive-list]');
    const status = root.querySelector('[data-archive-status]');
    const type = root.querySelector('[data-archive-type]');
    const search = root.querySelector('[data-archive-search]');
    const timeZone = window.notesBootstrap?.preferences?.timezone;
    let items = [];
    let page = 0;

    const row = (item) => {
        const article = document.createElement('article');
        article.className = 'planning-list-item';
        const copy = document.createElement('div');
        const facts = [
            t(TYPE_LABELS[item.type]),
            item.status ? statusLabel(item.status) : '',
            `${t('Archived')} ${formatMoment(item.archived_at, { timeZone })}`,
        ].filter(Boolean);
        copy.append(
            Object.assign(document.createElement('strong'), { textContent: item.name }),
            Object.assign(document.createElement('small'), { textContent: facts.join(' · ') }),
        );
        if (item.parent && !item.parent.archived) {
            copy.append(
                Object.assign(document.createElement('p'), {
                    className: 'subtle-copy',
                    textContent: `${t(TYPE_LABELS[item.parent.type])}: ${item.parent.name}`,
                }),
            );
        }
        if (item.contents) {
            copy.append(
                Object.assign(document.createElement('p'), {
                    className: 'subtle-copy',
                    textContent: t('Comes back with :count items archived with it.').replace(
                        ':count',
                        item.contents,
                    ),
                }),
            );
        }
        const blocker = restoreBlocker(item);
        if (blocker) {
            copy.append(
                Object.assign(document.createElement('p'), {
                    className: 'field-hint',
                    textContent: blocker,
                }),
            );
        }
        const restore = Object.assign(document.createElement('button'), {
            type: 'button',
            className: 'button button-quiet',
            textContent: t('Restore'),
            disabled: Boolean(blocker),
        });
        restore.setAttribute('aria-label', `${t('Restore')} ${item.name}`);
        restore.addEventListener('click', async () => {
            restore.disabled = true;
            try {
                const result = (
                    await post(
                        `/api/v1/archive/${item.type}/${encodeURIComponent(item.id)}/restore`,
                        { base_version: item.version },
                    )
                ).payload.data;
                const more = result.restored - 1;
                status.textContent = (
                    more > 0
                        ? t('Restored “:name” and :count items inside it.')
                        : t('Restored “:name”.')
                )
                    .replace(':name', item.name)
                    .replace(':count', more);
                await load();
            } catch (error) {
                status.textContent =
                    Object.values(error.payload?.errors || {})[0]?.[0] || error.message;
                restore.disabled = false;
            }
        });
        article.append(copy, restore);
        return article;
    };

    const render = () => {
        const result = collectionPage(
            archiveMatches(items, { type: type.value, query: search.value }),
            { page, size: 12 },
        );
        page = result.page;
        renderPagination(root.querySelector('[data-archive-pagination]'), result, (next) => {
            page = next;
            render();
        });
        list.replaceChildren();
        if (!result.items.length) {
            list.textContent = items.length ? t('Nothing matches.') : t('Nothing is archived.');
            return;
        }
        list.append(...result.items.map(row));
    };

    const load = async () => {
        items = (await get('/api/v1/archive')).payload.data;
        render();
    };

    type.addEventListener('change', () => {
        page = 0;
        render();
    });
    search.addEventListener('input', () => {
        page = 0;
        render();
    });
    load().catch((error) => {
        list.textContent = error.message;
    });
}
