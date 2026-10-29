// Single-colour line icons drawn with currentColor, shared by task controls.
const paths = {
    calendar: [
        'M6 5h12a2 2 0 0 1 2 2v11a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V7a2 2 0 0 1 2-2Z',
        'M4 10h16M8 3v4M16 3v4',
    ],
    clock: ['M12 6a7 7 0 1 1 0 14 7 7 0 0 1 0-14Z', 'M12 9.5V13l2.5 1.5M5 4 3 6M19 4l2 2'],
    repeat: ['M17 3l3 3-3 3M20 6H8a4 4 0 0 0-4 4v1M7 21l-3-3 3-3M4 18h12a4 4 0 0 0 4-4v-1'],
    pin: ['M9 4h6l-1 6 3 3v2H7v-2l3-3-1-6Z', 'M12 15v6'],
};

export function lineIcon(name, { filled = false } = {}) {
    const svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
    svg.setAttribute('viewBox', '0 0 24 24');
    svg.setAttribute('aria-hidden', 'true');
    svg.classList.add('ui-icon', 'line-icon');
    for (const [index, d] of paths[name].entries()) {
        const path = document.createElementNS('http://www.w3.org/2000/svg', 'path');
        path.setAttribute('d', d);
        path.setAttribute('fill', filled && index === 0 ? 'currentColor' : 'none');
        path.setAttribute('stroke', 'currentColor');
        path.setAttribute('stroke-width', '1.8');
        path.setAttribute('stroke-linecap', 'round');
        path.setAttribute('stroke-linejoin', 'round');
        svg.append(path);
    }
    return svg;
}
