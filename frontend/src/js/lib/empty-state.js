// Copy is supplied by the feature; user content always uses textContent.
export function renderEmptyState(container, { title, description, icon = 'tasks', href, action }) {
    const state = document.createElement('div');
    state.className = 'collection-empty';
    const graphic = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
    graphic.classList.add('ui-icon');
    graphic.setAttribute('aria-hidden', 'true');
    const use = document.createElementNS('http://www.w3.org/2000/svg', 'use');
    use.setAttribute('href', `#icon-${icon}`);
    graphic.append(use);
    const heading = document.createElement('strong');
    heading.textContent = title;
    const copy = document.createElement('p');
    copy.textContent = description;
    state.append(graphic, heading, copy);
    if (href && action) {
        const link = document.createElement('a');
        link.className = 'empty-action';
        link.href = href;
        link.textContent = action;
        state.append(link);
    }
    container.replaceChildren(state);
}
