const reference = new URL('../../images/reference/UI.png', import.meta.url).href;

const namespace = 'http://www.w3.org/2000/svg';
let decorationId = 0;
// Small decoration-only source regions (card accents and the roadmap anchor). The original raster is
// bundled unchanged; live labels and controls remain HTML, never screenshot pixels. Large scenery
// always comes from each theme's own illustration (theme-catalog.js), which stays sharp at any size.
const regions = {
    plant: [1005, 574, 48, 66],
    trophy: [1359, 570, 22, 24],
    anchor: [122, 624, 42, 44],
};

export function referenceDecoration(kind) {
    const svg = document.createElementNS(namespace, 'svg');
    svg.classList.add('reference-decoration', `reference-${kind}`);
    svg.setAttribute('viewBox', regions[kind].join(' '));
    svg.setAttribute('preserveAspectRatio', kind === 'plant' ? 'xMaxYMax meet' : 'xMidYMid slice');
    svg.setAttribute('aria-hidden', 'true');
    svg.setAttribute('focusable', 'false');
    const source = document.createElementNS(namespace, 'image');
    source.setAttribute('href', reference);
    source.setAttribute('width', '1536');
    source.setAttribute('height', '1024');
    const excluded = kind === 'plant' ? [[1005, 585, 9, 18]] : [];
    {
        // Clip the source rectangle even when the SVG viewport letterboxes with meet.
        const [x, y, width, height] = regions[kind];
        const definitions = document.createElementNS(namespace, 'defs');
        const clip = document.createElementNS(namespace, 'clipPath');
        clip.id = `reference-clip-${kind}-${++decorationId}`;
        const shape = document.createElementNS(namespace, 'path');
        const rectangle = ([left, top, w, h]) => `M${left} ${top}h${w}v${h}h${-w}Z`;
        shape.setAttribute(
            'd',
            [rectangle([x, y, width, height]), ...excluded.map(rectangle)].join(' '),
        );
        shape.setAttribute('clip-rule', 'evenodd');
        clip.append(shape);
        definitions.append(clip);
        svg.append(definitions);
        source.setAttribute('clip-path', `url(#${clip.id})`);
    }
    svg.append(source);
    return svg;
}

export function decorateReference(root = document) {
    for (const container of root.querySelectorAll('[data-reference-decoration]')) {
        if (container.querySelector(':scope > .reference-decoration')) continue;
        container.append(referenceDecoration(container.dataset.referenceDecoration));
    }
}
