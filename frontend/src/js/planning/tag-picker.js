import { get } from '../lib/http.js';
import { t } from '../lib/i18n.js';

let tagsRequest = null;

/** The owner's tags (shared with Notes), loaded once per page. */
export function loadTags() {
    tagsRequest ??= get('/api/v1/tags')
        .then((response) => response.payload.data)
        .catch((error) => {
            tagsRequest = null;
            throw error;
        });
    return tagsRequest;
}

export const sameTagIds = (left = [], right = []) =>
    JSON.stringify([...left].map(String).sort()) === JSON.stringify([...right].map(String).sort());

/** Small read-only chips for a list row. */
export function tagChips(tagIds, tags) {
    const byId = new Map(tags.map((tag) => [String(tag.id), tag]));
    return (tagIds || [])
        .map((id) => byId.get(String(id)))
        .filter(Boolean)
        .map((tag) => {
            const chip = document.createElement('span');
            chip.className = 'tag-chip';
            chip.textContent = `#${tag.name}`;
            return chip;
        });
}

/**
 * A collapsible checkbox list of tags. `onChange(ids)` fires on every toggle;
 * callers either save immediately or keep the value with a form.
 */
export function createTagPicker({ onChange = () => {}, label = t('Tags') } = {}) {
    const details = document.createElement('details');
    details.className = 'tag-picker';
    const summary = document.createElement('summary');
    const list = document.createElement('div');
    list.className = 'tag-picker-list';
    details.append(summary, list);
    let tags = [];
    let selected = new Set();
    let disabled = false;

    const describe = () => {
        const names = tags.filter((tag) => selected.has(String(tag.id))).map((tag) => tag.name);
        summary.textContent = `${label} · ${names.length ? names.join(', ') : t('none')}`;
    };
    const render = () => {
        list.replaceChildren();
        for (const tag of tags) {
            const option = document.createElement('label');
            option.className = 'check-row';
            const box = document.createElement('input');
            box.type = 'checkbox';
            box.value = String(tag.id);
            box.checked = selected.has(String(tag.id));
            box.disabled = disabled;
            box.addEventListener('change', () => {
                if (box.checked) selected.add(box.value);
                else selected.delete(box.value);
                describe();
                onChange(picker.value);
            });
            const name = document.createElement('span');
            name.textContent = tag.name;
            option.append(box, name);
            list.append(option);
        }
        if (!tags.length) {
            const hint = document.createElement('p');
            hint.className = 'subtle-copy';
            hint.textContent = t('No tags yet. Create them in Notes → Manage tags.');
            list.append(hint);
        }
        describe();
    };
    const picker = {
        element: details,
        get value() {
            return [...selected].sort((a, b) => Number(a) - Number(b));
        },
        set value(ids) {
            selected = new Set((ids || []).map(String));
            render();
        },
        set disabled(value) {
            disabled = value;
            for (const box of list.querySelectorAll('input')) box.disabled = value;
        },
    };
    describe();
    loadTags()
        .then((loaded) => {
            tags = loaded;
            render();
        })
        .catch(() => {
            list.textContent = t('Tags are unavailable right now.');
        });
    return picker;
}
