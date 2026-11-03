import { get } from '../lib/http.js';
import { t } from '../lib/i18n.js';
import { formatDay } from '../lib/format.js';
import { noteLines } from '../lib/note-checkbox-text.js';

// Notes linked to a Goal or Task, shown on that page with a shortcut to write a new one.
// The container declares what it belongs to: data-linked-notes="goal|task" data-linked-id="…".
export async function renderLinkedNotes(container) {
    if (!container) return;
    const type = container.dataset.linkedNotes;
    const id = container.dataset.linkedId;
    const list = container.querySelector('[data-linked-notes-list]');
    const create = container.querySelector('[data-linked-notes-new]');
    create.href = `/?new=1&${type}=${encodeURIComponent(id)}`;
    list.replaceChildren(
        Object.assign(document.createElement('p'), {
            className: 'loading-copy',
            textContent: t('Loading…'),
        }),
    );
    try {
        const notes = (
            await get(
                `/api/v1/${type === 'goal' ? 'goals' : 'tasks'}/${encodeURIComponent(id)}/notes`,
            )
        ).payload.data;
        list.replaceChildren();
        if (!notes.length) {
            list.append(
                Object.assign(document.createElement('p'), {
                    className: 'subtle-copy',
                    textContent: t('No notes are linked yet.'),
                }),
            );
            return;
        }
        for (const note of notes) {
            const item = document.createElement('a');
            item.className = 'linked-note';
            item.href = `/?note=${encodeURIComponent(note.id)}`;
            const title = document.createElement('strong');
            title.textContent = note.title || t('Untitled note');
            const preview = document.createElement('span');
            // Checklist markup reads as plain items in this compact list.
            preview.textContent = noteLines(note.content_preview)
                .map((line) => line.text)
                .filter(Boolean)
                .join(' · ');
            const date = document.createElement('small');
            date.textContent = formatDay(note.updated_at?.slice(0, 10));
            item.append(title, preview, date);
            list.append(item);
        }
    } catch (error) {
        list.replaceChildren(
            Object.assign(document.createElement('p'), {
                className: 'field-error',
                textContent: error.message || t('Unable to load notes.'),
            }),
        );
    }
}
