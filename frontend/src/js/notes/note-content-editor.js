import { bodyText } from '../lib/normalization.js';
import {
    addNoteCheckbox,
    deleteNoteText,
    enterNoteLine,
    noteLines,
    replaceNoteText,
    toggleNoteCheckbox,
} from '../lib/note-checkbox-text.js';

// Keep the textarea as the canonical form/snapshot value. The DOM is only a
// safe text-and-checkbox projection, shared by Notes autosave and Task Note Save.
export class NoteContentEditor {
    constructor(textarea) {
        this.textarea = textarea;
        this.value = bodyText(textarea.value);
        this.selection = { start: 0, end: 0 };
        this.undoStates = [];
        this.redoStates = [];
        this.composing = false;
        this.readOnly = false;
        this.lastEdit = null;

        this.frame = document.createElement('div');
        this.frame.className = 'note-document';
        const toolbar = document.createElement('div');
        toolbar.className = 'note-document-toolbar';
        this.addButton = document.createElement('button');
        this.addButton.type = 'button';
        this.addButton.className = 'button button-quiet';
        this.addButton.dataset.addNoteCheckbox = '';
        this.addButton.textContent = '☑ Check box';
        this.addButton.title = 'Turn this line into a check box';
        toolbar.append(this.addButton);

        this.root = document.createElement('div');
        this.root.className = 'note-content-editor';
        this.root.id = `${textarea.id}-interactive`;
        this.root.dataset.noteContentEditor = '';
        this.root.setAttribute('role', 'textbox');
        this.root.setAttribute('aria-multiline', 'true');
        this.root.dataset.placeholder = textarea.placeholder;
        const label = textarea.labels?.[0];
        if (label) {
            label.id ||= `${textarea.id}-label`;
            this.root.setAttribute('aria-labelledby', label.id);
            label.addEventListener('click', () => this.focus());
        } else this.root.setAttribute('aria-label', 'Note content');
        this.frame.append(toolbar, this.root);
        textarea.before(this.frame);
        textarea.hidden = true;
        this.render();
        this.setReadOnly(textarea.readOnly || textarea.disabled);
        this.bind();
    }

    bind() {
        this.root.addEventListener('beforeinput', (event) => this.beforeInput(event));
        this.root.addEventListener('input', (event) => {
            if (event.target.closest('[data-note-line-check]')) return;
            if (!this.composing) this.readNativeInput();
        });
        this.root.addEventListener('compositionstart', () => {
            this.composing = true;
            this.addButton.disabled = true;
            for (const input of this.root.querySelectorAll('input')) input.disabled = true;
            this.compositionSelection = this.getSelection();
            this.textarea.dispatchEvent(
                new CompositionEvent('compositionstart', { bubbles: true }),
            );
        });
        this.root.addEventListener('compositionend', () => {
            this.composing = false;
            this.readNativeInput();
            this.addButton.disabled = this.readOnly;
            this.textarea.dispatchEvent(new CompositionEvent('compositionend', { bubbles: true }));
        });
        this.root.addEventListener('keydown', (event) => {
            if (event.isComposing || this.composing || this.readOnly) return;
            if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === 'z') {
                event.preventDefault();
                this.history(event.shiftKey);
            } else if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === 'y') {
                event.preventDefault();
                this.history(true);
            } else if (event.key === 'Enter' && event.target === this.root) {
                event.preventDefault();
                this.commit(enterNoteLine(this.value, this.getSelection()), 'line');
            }
        });
        for (const name of ['paste', 'cut', 'copy']) {
            this.root.addEventListener(name, (event) => this.clipboard(event));
        }
        this.root.addEventListener('drop', (event) => {
            event.preventDefault();
            if (this.readOnly || this.composing) return;
            const text = event.dataTransfer?.getData('text/plain');
            if (text)
                this.commit(
                    replaceNoteText(this.value, this.getSelection(), bodyText(text)),
                    'paste',
                );
        });
        this.root.addEventListener('change', (event) => {
            const input = event.target.closest('[data-note-line-check]');
            if (!input) return;
            if (this.readOnly || this.composing) {
                this.render();
                return;
            }
            this.commit(
                {
                    value: toggleNoteCheckbox(
                        this.value,
                        Number(input.dataset.noteLineCheck),
                        input.checked,
                    ),
                    caret: null,
                },
                'check',
            );
        });
        this.addButton.addEventListener('click', () => {
            if (!this.readOnly && !this.composing)
                this.commit(addNoteCheckbox(this.value, this.getSelection()), 'check');
        });
        this.root.addEventListener('keyup', () => this.getSelection());
        this.root.addEventListener('mouseup', () => this.getSelection());
        this.root.addEventListener('blur', () => this.getSelection(), true);
    }

    beforeInput(event) {
        if (this.composing || event.isComposing) return;
        if (this.readOnly) {
            event.preventDefault();
            return;
        }
        const selection = this.getSelection();
        let change;
        if (event.inputType === 'insertText' && event.data !== null) {
            change = replaceNoteText(this.value, selection, event.data);
        } else if (['insertParagraph', 'insertLineBreak'].includes(event.inputType)) {
            change = enterNoteLine(this.value, selection);
        } else if (['deleteContentBackward', 'deleteContentForward'].includes(event.inputType)) {
            change = deleteNoteText(
                this.value,
                selection,
                event.inputType === 'deleteContentBackward',
            );
        } else if (['historyUndo', 'historyRedo'].includes(event.inputType)) {
            event.preventDefault();
            this.history(event.inputType === 'historyRedo');
            return;
        } else if (event.inputType.startsWith('format')) {
            event.preventDefault();
            return;
        }
        if (change) {
            event.preventDefault();
            this.commit(change, event.inputType === 'insertText' ? 'typing' : 'edit');
        }
    }

    clipboard(event) {
        if (this.composing || !event.clipboardData) return;
        const selection = this.getSelection();
        event.preventDefault();
        if (event.type === 'paste') {
            if (!this.readOnly)
                this.commit(
                    replaceNoteText(
                        this.value,
                        selection,
                        bodyText(event.clipboardData.getData('text/plain')),
                    ),
                    'paste',
                );
        } else {
            event.clipboardData.setData(
                'text/plain',
                this.value.slice(selection.start, selection.end),
            );
            if (event.type === 'cut' && !this.readOnly)
                this.commit(replaceNoteText(this.value, selection, ''), 'edit');
        }
    }

    readNativeInput() {
        const selection = this.getSelection();
        // IME and browser word/spelling edits may replace our spans or leave
        // text directly in the root. Read all editable text, never HTML.
        const readText = (node) => {
            if (node.nodeType === Node.TEXT_NODE) return node.textContent;
            if (node.nodeType !== Node.ELEMENT_NODE || node.contentEditable === 'false') return '';
            if (node.tagName === 'BR') return '\n';
            if (node.childNodes.length === 1 && node.firstChild.nodeName === 'BR') return '';
            return Array.from(node.childNodes).map(readText).join('');
        };
        let value = '';
        let previousBlock = false;
        for (const node of this.root.childNodes) {
            const block =
                node.nodeType === Node.ELEMENT_NODE && ['DIV', 'P'].includes(node.tagName);
            if (value && (block || previousBlock)) value += '\n';
            else if (previousBlock) value += '\n';
            value += (node.dataset?.prefix || '') + readText(node);
            previousBlock = block;
        }
        this.commit(
            { value: bodyText(value), caret: selection.end },
            'typing',
            this.compositionSelection,
        );
        this.compositionSelection = null;
        this.render();
    }

    commit(change, kind, previousSelection = null) {
        const selection = previousSelection || this.getSelection();
        if (change.value !== this.value) {
            const now = Date.now();
            const grouped =
                kind === 'typing' &&
                this.lastEdit?.kind === kind &&
                now - this.lastEdit.time < 750 &&
                selection.start === this.lastEdit.caret &&
                selection.start === selection.end;
            if (!grouped) {
                this.undoStates.push({ value: this.value, selection });
                if (this.undoStates.length > 100) this.undoStates.shift();
            }
            this.redoStates = [];
            this.lastEdit = { kind, time: now, caret: change.caret };
            this.value = change.value;
            this.textarea.value = this.value;
            this.render();
            this.textarea.dispatchEvent(new Event('input', { bubbles: true }));
        }
        if (change.caret !== null) this.focus({ start: change.caret, end: change.caret });
    }

    history(redo = false) {
        const from = redo ? this.redoStates : this.undoStates;
        const to = redo ? this.undoStates : this.redoStates;
        const state = from.pop();
        if (!state) return;
        to.push({ value: this.value, selection: this.getSelection() });
        this.value = state.value;
        this.textarea.value = state.value;
        this.lastEdit = null;
        this.render();
        this.focus(state.selection);
        this.textarea.dispatchEvent(new Event('input', { bubbles: true }));
    }

    setValue(value, { reset = false } = {}) {
        const next = bodyText(value);
        this.textarea.value = next;
        if (next === this.value && !reset) return;
        this.value = next;
        this.selection = { start: 0, end: 0 };
        this.undoStates = [];
        this.redoStates = [];
        this.lastEdit = null;
        this.render();
    }

    setReadOnly(readOnly) {
        this.readOnly = readOnly;
        this.root.contentEditable = readOnly ? 'false' : 'plaintext-only';
        this.root.tabIndex = 0;
        this.root.setAttribute('aria-readonly', String(readOnly));
        this.addButton.disabled = readOnly || this.composing;
        for (const input of this.root.querySelectorAll('input'))
            input.disabled = readOnly || this.composing;
    }

    render() {
        const previous = Array.from(this.root.children);
        const rows = noteLines(this.value).map((line, index) => {
            let row = previous[index];
            if (
                !row ||
                !row.querySelector('[data-note-line-text]') ||
                Boolean(row.querySelector('input')) !== (line.checked !== null)
            ) {
                row = document.createElement('div');
                row.className = 'note-content-line';
                if (line.checked !== null) {
                    const indent = document.createElement('span');
                    indent.dataset.noteLineIndent = '';
                    indent.contentEditable = 'false';
                    const box = document.createElement('span');
                    box.className = 'note-line-control';
                    box.contentEditable = 'false';
                    const input = document.createElement('input');
                    input.type = 'checkbox';
                    box.append(input);
                    row.append(indent, box);
                }
                const text = document.createElement('span');
                text.dataset.noteLineText = '';
                row.append(text);
            }
            row.dataset.noteLine = String(index);
            row.dataset.prefix = line.prefix;
            const text = row.querySelector('[data-note-line-text]');
            if (text.textContent !== line.text) text.textContent = line.text;
            if (!text.childNodes.length) text.append(document.createElement('br'));
            if (line.checked !== null) {
                row.querySelector('[data-note-line-indent]').textContent = line.indent;
                const input = row.querySelector('input');
                input.dataset.noteLineCheck = String(index);
                input.checked = line.checked;
                input.disabled = this.readOnly || this.composing;
                input.setAttribute('aria-label', line.text || 'Empty note check box');
                row.classList.toggle('is-checked', line.checked);
            }
            return row;
        });
        if (
            rows.length !== this.root.childNodes.length ||
            rows.some((row, index) => row !== previous[index])
        )
            this.root.replaceChildren(...rows);
        this.root.dataset.empty = String(this.value === '');
    }

    pointOffset(node, offset) {
        const lines = noteLines(this.value);
        if (node === this.root) return lines[offset]?.start ?? this.value.length;
        const element = node.nodeType === Node.ELEMENT_NODE ? node : node.parentElement;
        const row = element?.closest('[data-note-line]');
        if (!row || !this.root.contains(row)) return null;
        const line = lines[Number(row.dataset.noteLine)];
        if (!line) return null;
        const text = row.querySelector('[data-note-line-text]');
        if (!text) return null;
        if (node === row)
            return offset <= Array.from(row.childNodes).indexOf(text)
                ? line.start
                : line.start + line.raw.length;
        if (text.contains(node)) {
            const range = document.createRange();
            range.setStart(text, 0);
            range.setEnd(node, offset);
            return line.start + line.prefix.length + range.toString().length;
        }
        return line.start;
    }

    getSelection() {
        const selection = window.getSelection();
        if (
            selection?.rangeCount &&
            this.root.contains(selection.anchorNode) &&
            this.root.contains(selection.focusNode)
        ) {
            const start = this.pointOffset(selection.anchorNode, selection.anchorOffset);
            const end = this.pointOffset(selection.focusNode, selection.focusOffset);
            if (start !== null && end !== null)
                this.selection = { start: Math.min(start, end), end: Math.max(start, end) };
        }
        return this.selection;
    }

    focus(selection = this.selection) {
        this.root.focus({ preventScroll: true });
        this.selection = selection;
        const lines = noteLines(this.value);
        const point = (offset) => {
            const line = lines.findLast((entry) => entry.start <= offset) || lines[0];
            const row = this.root.children[lines.indexOf(line)];
            if (offset < line.start + line.prefix.length) return [row, 0];
            const text = row.querySelector('[data-note-line-text]');
            const node = text.firstChild;
            return node.nodeType === Node.TEXT_NODE
                ? [
                      node,
                      Math.min(node.length, Math.max(0, offset - line.start - line.prefix.length)),
                  ]
                : [text, 0];
        };
        const range = document.createRange();
        range.setStart(...point(selection.start));
        range.setEnd(...point(selection.end));
        window.getSelection().removeAllRanges();
        window.getSelection().addRange(range);
    }
}
