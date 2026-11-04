import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';
import { COLORS, ICONS, cycleHue } from '../../src/js/lib/entity-icons.js';
import { starCount } from '../../src/js/lib/star-rating.js';

const backend = readFileSync(
    new URL('../../../backend/src/Domain/Planning/EntityIcon.php', import.meta.url),
    'utf8',
);
const phpList = (name) =>
    [
        ...backend.match(new RegExp(`const ${name} = \\[([^\\]]*)\\]`))[1].matchAll(/'([a-z-]+)'/g),
    ].map((match) => match[1]);

test('the icon and colour catalogues match what the backend accepts', () => {
    assert.deepEqual(Object.keys(ICONS), phpList('ICONS'));
    assert.deepEqual(Object.keys(COLORS), phpList('COLORS'));
});

test('automatic hues cycle through the eight accents and stars stay on a 1-5 scale', () => {
    assert.equal(cycleHue(0), COLORS.amber);
    assert.equal(cycleHue(8), COLORS.amber);
    assert.deepEqual([0, 1, 3.4, 5, 9, 'x'].map(starCount), [1, 1, 3, 5, 5, 3]);
});
