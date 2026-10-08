// Filtering retains server order and clamps the page after a mutation removes
// its final row. Search never interprets a user's text as a regular expression.
export function collectionPage(items, { query = '', status = 'all', page = 0, size = 8 } = {}) {
    const text = query.trim().toLocaleLowerCase();
    const matches = items.filter(
        (item) =>
            (!text || item.name.toLocaleLowerCase().includes(text)) &&
            (status === 'all' ||
                (status === 'open' ? item.status !== 'Done' : item.status === status)),
    );
    const pages = Math.max(1, Math.ceil(matches.length / size));
    const index = Math.min(Math.max(0, page), pages - 1);
    return {
        items: matches.slice(index * size, (index + 1) * size),
        page: index,
        pages,
        total: matches.length,
    };
}

export function renderPagination(container, result, onPage) {
    container.replaceChildren();
    if (result.pages <= 1) return;
    const previous = document.createElement('button');
    const next = document.createElement('button');
    const label = document.createElement('span');
    label.textContent = `Page ${result.page + 1} of ${result.pages}`;
    label.setAttribute('aria-live', 'polite');
    label.setAttribute(
        'aria-label',
        `${result.total} items. Page ${result.page + 1} of ${result.pages}`,
    );
    for (const [button, text, change, disabled] of [
        [previous, 'Previous', -1, result.page === 0],
        [next, 'Next', 1, result.page === result.pages - 1],
    ]) {
        button.type = 'button';
        button.className = 'button button-quiet';
        button.textContent = text;
        button.disabled = disabled;
        button.addEventListener('click', () => {
            onPage(result.page + change);
            const buttons = [...container.querySelectorAll('button')];
            (
                buttons.find((item) => item.textContent === text && !item.disabled) ||
                buttons.find((item) => !item.disabled)
            )?.focus();
        });
    }
    container.append(previous, label, next);
}
