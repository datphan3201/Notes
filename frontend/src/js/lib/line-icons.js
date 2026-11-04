// Single-colour line icons drawn with currentColor, shared by task controls.
const paths = {
    calendar: [
        'M6 5h12a2 2 0 0 1 2 2v11a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V7a2 2 0 0 1 2-2Z',
        'M4 10h16M8 3v4M16 3v4',
    ],
    clock: ['M12 6a7 7 0 1 1 0 14 7 7 0 0 1 0-14Z', 'M12 9.5V13l2.5 1.5M5 4 3 6M19 4l2 2'],
    repeat: ['M17 3l3 3-3 3M20 6H8a4 4 0 0 0-4 4v1M7 21l-3-3 3-3M4 18h12a4 4 0 0 0 4-4v-1'],
    pin: ['M9 4h6l-1 6 3 3v2H7v-2l3-3-1-6Z', 'M12 15v6'],
    sun: [
        'M12 8a4 4 0 1 1 0 8 4 4 0 0 1 0-8Z',
        'M12 2.5v2M12 19.5v2M2.5 12h2M19.5 12h2M5.3 5.3l1.4 1.4M17.3 17.3l1.4 1.4M5.3 18.7l1.4-1.4M17.3 6.7l1.4-1.4',
    ],
    star: ['M12 3.6l2.6 5.2 5.8.9-4.2 4.1 1 5.8-5.2-2.8-5.2 2.8 1-5.8-4.2-4.1 5.8-.9Z'],
    more: ['M5.5 12h.01M12 12h.01M18.5 12h.01'],
    edit: ['M4 20h4L19 9l-4-4L4 16v4Z', 'M13.5 6.5l4 4'],
    archive: ['M4 5h16v4H4Z', 'M5.5 9v9a2 2 0 0 0 2 2h9a2 2 0 0 0 2-2V9', 'M10 13h4'],
    lock: [
        'M7 11V8a5 5 0 0 1 10 0v3',
        'M6 11h12a1 1 0 0 1 1 1v8a1 1 0 0 1-1 1H6a1 1 0 0 1-1-1v-8a1 1 0 0 1 1-1Z',
        'M12 15v2',
    ],
    users: [
        'M9 11a3.5 3.5 0 1 0 0-7 3.5 3.5 0 0 0 0 7Z',
        'M2.5 20a6.5 6.5 0 0 1 13 0',
        'M16 4.3a3.5 3.5 0 0 1 0 6.4M18 14.2a6.5 6.5 0 0 1 3.5 5.8',
    ],
    eye: ['M2 12s3.6-7 10-7 10 7 10 7-3.6 7-10 7S2 12 2 12Z', 'M12 9a3 3 0 1 1 0 6 3 3 0 0 1 0-6Z'],
    paperclip: [
        'M20 11.5 12 19.5a5 5 0 0 1-7-7L13.5 4a3.3 3.3 0 0 1 4.7 4.7l-8.4 8.4a1.7 1.7 0 0 1-2.4-2.4L15 7.6',
    ],
    // Solid accents (greeting, streak): vector so they follow every theme instead of a raster crop.
    sparkle: [
        'M11 3.5 12.8 9 18 10.8 12.8 12.6 11 18l-1.8-5.4L4 10.8 9.2 9Z',
        'M18.5 14.5l.8 2.2 2.2.8-2.2.8-.8 2.2-.8-2.2-2.2-.8 2.2-.8Z',
    ],
    flame: [
        'M12 2.8c.6 3 4.9 5.2 4.9 10a4.9 4.9 0 0 1-9.8 0c0-2.3 1.2-3.7 2.4-4.9.3 1.5 1 2.5 1.9 3 .1-2.9.1-5.4.6-8.1Z',
    ],
};

/** A symbol from the shared SVG sprite (views/layouts/icons.php), e.g. spriteIcon('goals'). */
export function spriteIcon(name) {
    const svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
    svg.setAttribute('class', 'ui-icon');
    svg.setAttribute('aria-hidden', 'true');
    const use = document.createElementNS('http://www.w3.org/2000/svg', 'use');
    use.setAttribute('href', `#icon-${name}`);
    svg.append(use);
    return svg;
}

export function lineIcon(name, { filled = false, solid = false } = {}) {
    const svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
    svg.setAttribute('viewBox', '0 0 24 24');
    svg.setAttribute('aria-hidden', 'true');
    svg.classList.add('ui-icon', 'line-icon');
    for (const [index, d] of paths[name].entries()) {
        const path = document.createElementNS('http://www.w3.org/2000/svg', 'path');
        path.setAttribute('d', d);
        path.setAttribute('fill', solid || (filled && index === 0) ? 'currentColor' : 'none');
        path.setAttribute('stroke', 'currentColor');
        // The ⋯ dots are zero-length strokes, so their size is the stroke width.
        path.setAttribute('stroke-width', name === 'more' ? '3.2' : '1.8');
        path.setAttribute('stroke-linecap', 'round');
        path.setAttribute('stroke-linejoin', 'round');
        svg.append(path);
    }
    return svg;
}
