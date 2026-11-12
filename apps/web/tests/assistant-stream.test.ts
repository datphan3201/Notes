import assert from 'node:assert/strict';
import test from 'node:test';
import { appendAnswer } from '../src/lib/assistant-stream.ts';

test('stream appends Unicode text and reconnect replaces persisted output', () => {
    let answer = appendAnswer('', { answer_delta: 'Xin 👋', answer_offset: 0, answer_reset: true });
    answer = appendAnswer(answer, { answer_delta: ' chào', answer_offset: 5, answer_reset: false });
    assert.equal(answer, 'Xin 👋 chào');
    assert.equal(appendAnswer(answer, { answer_delta: answer, answer_offset: 0, answer_reset: true }), answer);
    assert.equal(appendAnswer(answer, { answer_delta: '', answer_offset: 0, answer_reset: true }), '');
    assert.throws(() => appendAnswer(answer, { answer_delta: 'extra', answer_offset: 3, answer_reset: false }));
});
