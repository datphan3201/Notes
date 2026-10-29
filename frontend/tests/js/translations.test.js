import assert from 'node:assert/strict';
import { readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import test from 'node:test';

const source = new URL('../../src/', import.meta.url).pathname;
const vietnamese = JSON.parse(readFileSync(join(source, 'i18n/vi.json'), 'utf8'));

function files(directory) {
    return readdirSync(directory, { withFileTypes: true }).flatMap((entry) => {
        const path = join(directory, entry.name);
        if (entry.isDirectory()) return files(path);
        return /\.(js|php)$/.test(entry.name) ? [path] : [];
    });
}

// Literal keys passed straight to t('…') in scripts or $view->t('…') in views.
function literalKeys(text) {
    const keys = [];
    const call = /(?:\bt|->t)\(\s*'((?:[^'\\]|\\.)*)'\s*,?\s*\)/g;
    for (const match of text.matchAll(call)) keys.push(match[1].replace(/\\'/g, "'"));
    return keys;
}

test('every literal interface string has a Vietnamese translation', () => {
    const missing = [];
    for (const file of [...files(join(source, 'js')), ...files(join(source, 'views'))]) {
        for (const key of literalKeys(readFileSync(file, 'utf8'))) {
            if (!(key in vietnamese)) missing.push(`${file.slice(source.length)}: ${key}`);
        }
    }
    assert.deepEqual(missing, []);
});

test('translations are non-empty and keep placeholders out of the dictionary', () => {
    for (const [key, value] of Object.entries(vietnamese)) {
        assert.equal(typeof value, 'string', key);
        assert.notEqual(value.trim(), '', key);
        assert.ok(!key.includes('${'), key);
    }
});
