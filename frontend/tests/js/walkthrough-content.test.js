import assert from 'node:assert/strict';
import { existsSync } from 'node:fs';
import test from 'node:test';
import { walkthroughSteps } from '../../src/js/help/walkthrough-content.js';
import { walkthroughImage } from '../../src/js/help/walkthrough.js';

const publicDir = new URL('../../../backend/public', import.meta.url).pathname;

test('every tour step is written in both languages and shows a published screenshot', () => {
    const ids = new Set();
    for (const step of walkthroughSteps) {
        assert.ok(!ids.has(step.id), `duplicate step ${step.id}`);
        ids.add(step.id);
        for (const text of [
            step.group,
            step.title,
            step.intro,
            step.imageAlt,
            ...step.instructions,
        ]) {
            assert.ok(
                text.en?.trim() && text.vi?.trim(),
                `${step.id} needs English and Vietnamese text`,
            );
        }
        for (const language of ['en', 'vi']) {
            const image = walkthroughImage(step, language);
            assert.equal(image, `/guide/${language}/${step.shot}.webp`);
            assert.ok(existsSync(publicDir + image), `${image} is missing`);
        }
    }
});
