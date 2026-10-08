import test from 'node:test';
import assert from 'node:assert/strict';
import {
    addNoteCheckbox,
    deleteNoteText,
    enterNoteLine,
    noteLines,
    replaceNoteText,
    toggleNoteCheckbox,
} from '../../src/js/lib/note-checkbox-text.js';

const caret = (start) => ({ start, end: start });

test('projection preserves literal markup, Unicode, whitespace, and malformed markers exactly', () => {
    const value = '<b>Ý tưởng 🐟</b>\n  - [X] Học e\u0301\n- [ ] \n- [z] literal\n';
    const lines = noteLines(value);
    assert.equal(lines.map((line) => line.raw).join('\n'), value);
    assert.deepEqual(
        lines.map((line) => line.checked),
        [null, true, false, null, null],
    );
    assert.equal(lines[1].text, 'Học e\u0301');
    assert.equal(lines[1].prefix, '  - [X] ');
    assert.equal(lines[2].start, value.indexOf('- [ ]'));
});

test('a selected range becomes checks without touching neighboring lines or existing checked state', () => {
    const value = 'intro\n  first\n- [x] second\nthird\nlast';
    const result = addNoteCheckbox(value, { start: 8, end: value.indexOf('last') });
    assert.equal(result.value, 'intro\n  - [ ] first\n- [x] second\n- [ ] third\nlast');
    assert.equal(result.caret, 14);
    assert.deepEqual(addNoteCheckbox('', caret(0)), { value: '- [ ] ', caret: 6 });
});

test('adding on a check inserts a new unchecked line and keeps the original text/state intact', () => {
    const value = '  - [x] same\nend';
    const result = addNoteCheckbox(value, caret(10));
    assert.equal(result.value, '  - [x] same\n  - [ ] \nend');
    assert.equal(result.value.slice(0, result.caret), '  - [x] same\n  - [ ] ');
});

test('toggling duplicate titles targets only its line and never changes literal note text', () => {
    const value = '- [X] same\n<b>same</b>\n  - [ ] same';
    assert.equal(toggleNoteCheckbox(value, 2, true), '- [X] same\n<b>same</b>\n  - [x] same');
    assert.equal(toggleNoteCheckbox(value, 0, false), '- [ ] same\n<b>same</b>\n  - [ ] same');
    assert.equal(toggleNoteCheckbox(value, 1, true), value);
    assert.equal(toggleNoteCheckbox(value, 99, true), value);
});

test('Enter continues unchecked with indentation, exits an empty check, and splits a selected line', () => {
    assert.deepEqual(enterNoteLine('  - [x] done', caret(12)), {
        value: '  - [x] done\n  - [ ] ',
        caret: 21,
    });
    assert.deepEqual(enterNoteLine('start\n  - [ ] ', caret(14)), { value: 'start\n  ', caret: 8 });
    assert.deepEqual(enterNoteLine('- [ ] abcdef', { start: 8, end: 10 }), {
        value: '- [ ] ab\n- [ ] ef',
        caret: 15,
    });
    assert.deepEqual(enterNoteLine('plain', caret(2)), { value: 'pl\nain', caret: 3 });
});

test('Backspace unwraps a check at its start; Unicode deletion does not leave half a surrogate pair', () => {
    assert.deepEqual(deleteNoteText('  - [x] text', caret(8)), { value: '  text', caret: 2 });
    assert.deepEqual(deleteNoteText('a🐟b', caret(3)), { value: 'ab', caret: 1 });
    assert.deepEqual(deleteNoteText('a🐟b', caret(1), false), { value: 'ab', caret: 1 });
    assert.deepEqual(deleteNoteText('a', caret(0)), { value: 'a', caret: 0 });
    assert.deepEqual(deleteNoteText('a', caret(1), false), { value: 'a', caret: 1 });
});

test('plain multiline replacement retains literal HTML, empty lines, and trailing newline', () => {
    assert.deepEqual(replaceNoteText('- [ ] old', { start: 6, end: 9 }, '<script>\n\n🐟\n'), {
        value: '- [ ] <script>\n\n🐟\n',
        caret: 19,
    });
});
