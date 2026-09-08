export const COLORS = ['neutral', 'lemon', 'mint', 'sky', 'rose'];

export function nfc(value) {
    return String(value ?? '').normalize('NFC');
}

export function bodyText(value) {
    return String(value ?? '').replace(/\r\n?/g, '\n');
}

export function codePoints(value) {
    return Array.from(String(value ?? '')).length;
}

export function normalizeTitle(value) {
    return nfc(value).trim();
}

export function normalizeSnapshot(input = {}) {
    const labelIds = Array.from(
        new Set((Array.isArray(input.label_ids) ? input.label_ids : []).map(String)),
    )
        .filter((id) => /^\d+$/.test(id))
        .sort((a, b) => Number(a) - Number(b));
    return {
        title: normalizeTitle(input.title),
        content: bodyText(input.content),
        color: input.color || 'neutral',
        is_pinned: Boolean(input.is_pinned),
        label_ids: labelIds,
    };
}

export function snapshotFromNote(note) {
    return normalizeSnapshot({
        title: note.title,
        content: note.content,
        color: note.color,
        is_pinned: note.is_pinned,
        label_ids: (note.labels || []).map((label) => label.id),
    });
}

export function snapshotsEqual(a, b) {
    return JSON.stringify(normalizeSnapshot(a)) === JSON.stringify(normalizeSnapshot(b));
}

export function validateSnapshot(snapshot) {
    const value = normalizeSnapshot(snapshot);
    const errors = {};
    if (
        !value.title ||
        /[\u0000-\u001f\u007f]/u.test(value.title) ||
        codePoints(value.title) > 200
    ) {
        errors.title = 'Tiêu đề dài từ 1 đến 200 ký tự.';
    }
    if (
        !/\S/u.test(value.content) ||
        codePoints(value.content) > 50000 ||
        /[\u0000-\u0008\u000b\u000c\u000e-\u001f\u007f]/u.test(value.content)
    ) {
        errors.content = 'Nội dung phải có chữ và không vượt quá 50.000 ký tự.';
    }
    if (!COLORS.includes(value.color)) errors.color = 'Màu ghi chú không hợp lệ.';
    if (value.label_ids.length > 20) errors.label_ids = 'Mỗi ghi chú có tối đa 20 nhãn.';
    return { valid: Object.keys(errors).length === 0, errors, value };
}
