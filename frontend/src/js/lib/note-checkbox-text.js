// The editor projects plain text; no user-authored HTML becomes browser markup.
export function noteLines(value) {
    let start = 0;
    return String(value)
        .split('\n')
        .map((raw) => {
            const match = /^([\t ]*)- \[([ xX])\] (.*)$/u.exec(raw);
            const line = {
                raw,
                start,
                prefix: match ? raw.slice(0, match[1].length + 6) : '',
                indent: match?.[1] || '',
                text: match ? match[3] : raw,
                checked: match ? match[2] !== ' ' : null,
            };
            start += raw.length + 1;
            return line;
        });
}

export function replaceNoteText(value, selection, text) {
    const start = Math.max(0, Math.min(value.length, selection.start));
    const end = Math.max(start, Math.min(value.length, selection.end));
    return { value: value.slice(0, start) + text + value.slice(end), caret: start + text.length };
}

export function addNoteCheckbox(value, selection) {
    const lines = noteLines(value);
    const first = lines.findLastIndex((line) => line.start <= selection.start);
    const last = lines.findLastIndex((line) => line.start < selection.end);
    if (selection.start === selection.end && lines[first].checked !== null) {
        const line = lines[first];
        return replaceNoteText(
            value,
            {
                start: line.start + line.raw.length,
                end: line.start + line.raw.length,
            },
            `\n${line.indent}- [ ] `,
        );
    }
    let caret = selection.start;
    for (let index = first; index <= Math.max(first, last); index++) {
        if (lines[index].checked !== null) continue;
        const indent = /^[\t ]*/u.exec(lines[index].raw)[0];
        lines[index].raw = `${indent}- [ ] ${lines[index].raw.slice(indent.length)}`;
        if (index === first) caret += 6;
    }
    return { value: lines.map((line) => line.raw).join('\n'), caret };
}

export function toggleNoteCheckbox(value, index, checked) {
    const lines = noteLines(value);
    const line = lines[index];
    if (!line || line.checked === null) return value;
    const marker = line.start + line.indent.length + 3;
    return value.slice(0, marker) + (checked ? 'x' : ' ') + value.slice(marker + 1);
}

export function enterNoteLine(value, selection) {
    const removed = replaceNoteText(value, selection, '');
    const line = noteLines(removed.value).findLast((entry) => entry.start <= removed.caret);
    if (line.checked !== null && !line.text.trim()) {
        return replaceNoteText(
            removed.value,
            {
                start: line.start,
                end: line.start + line.prefix.length,
            },
            line.indent,
        );
    }
    return replaceNoteText(
        removed.value,
        { start: removed.caret, end: removed.caret },
        line.checked === null ? '\n' : `\n${line.indent}- [ ] `,
    );
}

export function deleteNoteText(value, selection, backward = true) {
    if (selection.start !== selection.end) return replaceNoteText(value, selection, '');
    const line = noteLines(value).findLast((entry) => entry.start <= selection.start);
    if (backward && line.checked !== null && selection.start === line.start + line.prefix.length) {
        return replaceNoteText(value, { start: line.start, end: selection.start }, line.indent);
    }
    let start = selection.start;
    let end = selection.end;
    if (backward && start > 0) {
        start -= value.codePointAt(start - 2) > 0xffff ? 2 : 1;
    } else if (!backward && end < value.length) {
        end += value.codePointAt(end) > 0xffff ? 2 : 1;
    }
    return replaceNoteText(value, { start, end }, '');
}
