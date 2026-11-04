import { get, patch, post } from '../lib/http.js';
import { t } from '../lib/i18n.js';
import { localDateTime } from '../lib/calendar.js';
import { iconButton } from '../lib/entity-icons.js';
import { starRating } from '../lib/star-rating.js';
import { transitionEntity } from './transitions.js';

// One floating editor for Tasks, Goals and Milestones on any page: a side sheet that edits or
// creates in place through the ordinary versioned APIs, so pages never navigate just to change
// a date or a name. Pages mark links with quickEditLink() (a plain click opens the sheet, a
// modified click still opens the full page) and refresh on the `planner:changed` event.

const TITLES = {
    task: { edit: 'Edit task', create: 'New task' },
    goal: { edit: 'Edit goal', create: 'New goal' },
    milestone: { edit: 'Edit milestone', create: 'New milestone' },
};
const TASK_STATUSES = [
    ['NotStarted', 'Not started'],
    ['InProgress', 'In progress'],
    ['Blocked', 'Blocked'],
];
const DONE = { task: 'Done', goal: 'Completed', milestone: 'Completed' };

// [field, label, kind, section]; sections: main, when, details.
const FIELDS = {
    task: [
        ['name', 'Task name', 'text', 'main'],
        ['parent', 'Add to', 'parent', 'main'],
        ['status', 'Status', 'status', 'main'],
        ['importance', 'Importance', 'stars', 'main'],
        ['start_date', 'Start date', 'date', 'when'],
        ['deadline', 'Due date', 'date', 'when'],
        ['scheduled_start', 'Scheduled start', 'datetime', 'when'],
        ['scheduled_end', 'Scheduled end', 'datetime', 'when'],
        ['reminder_at', 'Reminder', 'datetime', 'when'],
        ['estimated_minutes', 'Estimated minutes (optional)', 'minutes', 'when'],
        ['description', 'Description', 'textarea', 'details'],
        ['completion_criteria', 'Completion criteria', 'textarea', 'details'],
        ['expected_result', 'Expected result', 'textarea', 'details'],
    ],
    goal: [
        ['name', 'Goal name', 'text', 'main'],
        ['area_id', 'Area', 'area', 'main'],
        ['importance', 'Importance', 'stars', 'main'],
        ['deadline', 'Deadline', 'date', 'when'],
        ['description', 'Description', 'textarea', 'details'],
        ['expected_result', 'Expected result', 'textarea', 'details'],
        ['completion_criteria', 'Completion criteria', 'textarea', 'details'],
    ],
    milestone: [
        ['name', 'Milestone name', 'text', 'main'],
        ['goal_id', 'Goal', 'goal', 'main'],
        ['importance', 'Importance', 'stars', 'main'],
        ['deadline', 'Deadline', 'date', 'when'],
        ['description', 'Description', 'textarea', 'details'],
        ['completion_criteria', 'Completion criteria', 'textarea', 'details'],
    ],
};
const SECTIONS = [
    ['main', null],
    ['when', 'Dates and planning'],
    ['details', 'Description and criteria'],
];

/** Form strings for an entity, the shape the inputs hold. */
export function formValues(type, entity) {
    const values = {};
    for (const [field, , kind] of FIELDS[type]) {
        if (kind === 'parent')
            values.parent = entity.milestone_id
                ? `milestone:${entity.milestone_id}`
                : entity.goal_id
                  ? `goal:${entity.goal_id}`
                  : '';
        else if (kind === 'datetime')
            values[field] = entity[field] ? localDateTime(new Date(entity[field])) : '';
        else if (kind === 'stars') values[field] = String(entity[field] ?? 3);
        else values[field] = entity[field] == null ? '' : String(entity[field]);
    }
    values.icon = entity.icon ?? null;
    values.icon_color = entity.icon_color ?? null;
    return values;
}

/** The API body for the fields that differ from `initial` (all fields when creating). */
export function changedFields(type, values, initial = null) {
    const body = {};
    const kinds = Object.fromEntries(FIELDS[type].map(([field, , kind]) => [field, kind]));
    const keys = [...Object.keys(kinds), ...(type === 'task' ? [] : ['icon', 'icon_color'])];
    for (const field of keys) {
        if (initial && values[field] === initial[field]) continue;
        const value = values[field];
        const kind = kinds[field];
        if (kind === 'parent') {
            const [parentType, id] = String(value || '').split(':');
            body.goal_id = parentType === 'goal' ? id : null;
            body.milestone_id = parentType === 'milestone' ? id : null;
        } else if (kind === 'datetime') body[field] = value ? new Date(value).toISOString() : null;
        else if (kind === 'date' || kind === 'area' || kind === 'goal') body[field] = value || null;
        else if (kind === 'minutes') body[field] = value ? Number(value) : null;
        else if (kind === 'stars') body[field] = Number(value);
        else if (field === 'icon' || field === 'icon_color') body[field] = value;
        else body[field] = field === 'name' ? String(value).trim() : value;
    }
    return body;
}

export function fullPageHref(type, entity) {
    if (type === 'task') return `/tasks/${encodeURIComponent(entity.id)}`;
    if (type === 'goal') return `/goals/${encodeURIComponent(entity.id)}`;
    return `/goals/${encodeURIComponent(entity.goal_id)}#milestone=${encodeURIComponent(entity.id)}`;
}

/** Makes a link open the floating editor on a plain click; the href stays the full page. */
export function quickEditLink(link, type, id) {
    link.dataset.quickEdit = type;
    link.dataset.quickId = id;
    return link;
}

let sheet = null;

function element(tag, className, text) {
    const node = document.createElement(tag);
    if (className) node.className = className;
    if (text != null) node.textContent = text;
    return node;
}

function changed(type, id) {
    document.dispatchEvent(new CustomEvent('planner:changed', { detail: { type, id } }));
}

function errorText(error) {
    return (
        Object.values(error?.payload?.errors || {}).flat()[0] ||
        error?.message ||
        t('Unable to complete the request.')
    );
}

class QuickEditor {
    constructor() {
        this.dialog = element('dialog', 'quick-editor');
        this.dialog.setAttribute('aria-labelledby', 'quick-editor-title');
        this.dialog.addEventListener('cancel', (event) => {
            if (this.busy || (this.dirty() && !window.confirm(t('Discard your unsaved changes?'))))
                event.preventDefault();
        });
        this.dialog.addEventListener('close', () => {
            this.session += 1;
            this.trigger?.isConnected && this.trigger.focus();
        });
        this.session = 0;
        document.body.append(this.dialog);
    }

    dirty() {
        if (!this.values) return false;
        if (this.mode === 'create') return Boolean(this.values.name.trim());
        return Object.keys(changedFields(this.type, this.values, this.initial)).length > 0;
    }

    async open({ type, id = null, preset = {}, trigger = document.activeElement }) {
        if (this.dialog.open && !this.closeWithGuard()) return;
        this.type = type;
        this.mode = id ? 'edit' : 'create';
        this.trigger = trigger;
        this.entity = null;
        this.checklist = [];
        this.values = null;
        this.conflict = false;
        const session = ++this.session;
        this.renderShell(t('Loading…'));
        if (!this.dialog.open) this.dialog.showModal();
        try {
            await this.loadLists();
            if (id) await this.loadEntity(id);
            else
                this.entity = {
                    importance: 3,
                    status: type === 'task' ? 'NotStarted' : 'Active',
                    ...preset,
                };
            if (session !== this.session) return;
            this.values = formValues(type, this.entity);
            this.initial = { ...this.values };
            if (!id) this.initial = null;
            this.render();
        } catch (error) {
            if (session === this.session) this.renderShell(errorText(error), true);
        }
    }

    closeWithGuard() {
        if (this.busy) return false;
        if (this.dirty() && !window.confirm(t('Discard your unsaved changes?'))) return false;
        this.dialog.close();
        return true;
    }

    async loadLists() {
        const need = { goals: true, milestones: this.type === 'task', areas: this.type === 'goal' };
        const entries = await Promise.all(
            Object.entries(need)
                .filter(([, wanted]) => wanted)
                .map(async ([path]) => [path, (await get(`/api/v1/${path}`)).payload.data]),
        );
        this.lists = { goals: [], milestones: [], areas: [], ...Object.fromEntries(entries) };
    }

    async loadEntity(id) {
        const path = `/api/v1/${this.type}s/${encodeURIComponent(id)}`;
        const [entity, checklist] = await Promise.all([
            get(path),
            this.type === 'task' ? get(`${path}/checklist`) : null,
        ]);
        this.entity = entity.payload.data;
        this.checklist = checklist?.payload.data || [];
    }

    renderShell(message, failed = false) {
        const header = this.header();
        const body = element('p', failed ? 'field-error' : 'subtle-copy', message);
        if (failed) body.setAttribute('role', 'alert');
        this.dialog.replaceChildren(header, body);
    }

    header() {
        const header = element('header', 'quick-editor-header');
        const title = element('h2', null, t(TITLES[this.type][this.mode]));
        title.id = 'quick-editor-title';
        const actions = element('div', 'quick-editor-header-actions');
        if (this.mode === 'edit' && this.entity?.id) {
            const full = element('a', 'button button-quiet', t('Open full page'));
            full.href = fullPageHref(this.type, this.entity);
            actions.append(full);
        }
        const close = element('button', 'icon-button', '×');
        close.type = 'button';
        close.setAttribute('aria-label', t('Close'));
        close.addEventListener('click', () => this.closeWithGuard());
        actions.append(close);
        header.append(title, actions);
        return header;
    }

    field(field, label, kind) {
        const wrap = element('div', 'field');
        const id = `quick-editor-${field}`;
        const labelNode = element('label', null, t(label));
        labelNode.htmlFor = id;
        let control;
        if (kind === 'stars') {
            labelNode.removeAttribute('for');
            labelNode.id = `${id}-label`;
            const paint = () =>
                starRating(this.values[field], {
                    label: t(label),
                    size: 'md',
                    onChange: (value) => {
                        this.values[field] = String(value);
                        const next = paint();
                        control.replaceWith(next);
                        control = next;
                        next.querySelector('[aria-checked="true"]')?.focus();
                    },
                });
            control = paint();
            wrap.append(labelNode, control);
            return wrap;
        }
        if (kind === 'textarea') {
            control = element('textarea');
            control.rows = 3;
            control.maxLength = 10000;
        } else if (['parent', 'status', 'area', 'goal'].includes(kind)) {
            control = element('select');
            this.options(kind, control);
        } else {
            control = element('input');
            control.type =
                { date: 'date', datetime: 'datetime-local', minutes: 'number' }[kind] || 'text';
            if (kind === 'minutes') Object.assign(control, { min: 1, max: 1440 });
            if (kind === 'text') Object.assign(control, { maxLength: 200, required: true });
        }
        control.id = id;
        control.name = field;
        control.value = this.values[field];
        control.addEventListener('input', () => {
            this.values[field] = control.value;
        });
        control.addEventListener('change', () => {
            this.values[field] = control.value;
        });
        wrap.append(labelNode, control);
        return wrap;
    }

    options(kind, select) {
        const add = (parent, value, label) => parent.append(new Option(label, value));
        const openGoals = this.lists.goals.filter(
            (goal) => goal.status !== 'Completed' || goal.id === this.entity.goal_id,
        );
        if (kind === 'status') {
            if (this.entity.status === DONE.task) {
                add(select, DONE.task, t('Completed · reopen to change status'));
                select.disabled = true;
            } else for (const [value, label] of TASK_STATUSES) add(select, value, t(label));
        } else if (kind === 'area') {
            for (const area of this.lists.areas) add(select, area.id, area.name);
            if (!this.values.area_id && this.lists.areas[0])
                this.values.area_id = this.lists.areas[0].id;
            select.required = true;
        } else if (kind === 'goal') {
            for (const goal of openGoals) add(select, goal.id, goal.name);
            if (!this.values.goal_id && openGoals[0]) this.values.goal_id = openGoals[0].id;
            select.required = true;
        } else {
            add(select, '', t('Inbox · organize later'));
            for (const goal of openGoals) {
                const group = element('optgroup');
                group.label = goal.name;
                add(group, `goal:${goal.id}`, goal.name);
                for (const milestone of this.lists.milestones
                    .filter(
                        (item) =>
                            item.goal_id === goal.id &&
                            (item.status !== 'Completed' || item.id === this.entity.milestone_id),
                    )
                    .sort((a, b) => a.position - b.position))
                    add(group, `milestone:${milestone.id}`, `↳ ${milestone.name}`);
                select.append(group);
            }
        }
    }

    iconControl() {
        const wrap = element('div', 'quick-editor-icon');
        const paint = () => {
            const button = iconButton(
                {
                    id: this.entity.id || 'new',
                    icon: this.values.icon,
                    icon_color: this.values.icon_color,
                },
                {
                    label: this.values.name || t(TITLES[this.type].create),
                    size: 'lg',
                    fallbackIcon: this.type === 'milestone' ? 'flag' : 'target',
                    save: (choice) => {
                        this.values.icon = choice.icon;
                        this.values.icon_color = choice.icon_color;
                        wrap.replaceChildren(paint());
                    },
                },
            );
            return button;
        };
        wrap.append(paint());
        return wrap;
    }

    render() {
        const form = element('form', 'stack-form quick-editor-form');
        form.noValidate = false;
        if (this.conflict) form.append(this.conflictNotice());
        for (const [section, heading] of SECTIONS) {
            const fields = FIELDS[this.type].filter(([field, , , where]) => {
                if (where !== section) return false;
                // Moving a Goal or Milestone has its own guarded flows on the roadmap.
                if (this.mode === 'edit' && ['area_id', 'goal_id'].includes(field)) return false;
                if (this.mode === 'create' && field === 'status') return false;
                return true;
            });
            const nodes = fields.map(([field, label, kind]) => this.field(field, label, kind));
            if (section === 'main' && this.type !== 'task') {
                const row = element('div', 'quick-editor-title-row');
                row.append(this.iconControl(), nodes.shift());
                nodes.unshift(row);
            }
            if (!heading) form.append(...nodes);
            else {
                const group = element('details', 'capture-details quick-editor-section');
                group.open = section === 'when' || this.mode === 'create';
                group.append(element('summary', null, t(heading)), ...nodes);
                form.append(group);
            }
        }
        if (this.type === 'task' && this.mode === 'edit') form.append(this.checklistSection());
        const error = element('p', 'field-error is-hidden');
        error.setAttribute('role', 'alert');
        error.dataset.quickEditorError = '';
        const footer = element('div', 'dialog-footer quick-editor-footer');
        if (this.mode === 'edit') {
            const done = this.entity.status === DONE[this.type];
            const transition = element(
                'button',
                'button button-quiet',
                done ? t('Reopen') : t('Complete'),
            );
            transition.type = 'button';
            transition.classList.add('quick-editor-transition');
            transition.addEventListener('click', () =>
                this.transition(done ? 'reopen' : 'complete'),
            );
            footer.append(transition);
        }
        const cancel = element('button', 'button button-quiet', t('Cancel'));
        cancel.type = 'button';
        cancel.addEventListener('click', () => this.closeWithGuard());
        const save = element(
            'button',
            'button button-primary',
            this.mode === 'edit' ? t('Save changes') : t(`Create ${this.type}`),
        );
        save.type = 'submit';
        footer.append(cancel, save);
        form.append(error, footer);
        form.addEventListener('submit', (event) => {
            event.preventDefault();
            this.save(form);
        });
        this.dialog.replaceChildren(this.header(), form);
        if (this.mode === 'create') form.elements.name.focus();
    }

    conflictNotice() {
        const notice = element('aside', 'draft-conflict');
        notice.setAttribute('role', 'alert');
        notice.append(
            element('p', null, t('This item changed elsewhere. Your edits are preserved.')),
        );
        const row = element('div', 'action-row');
        const useSaved = element('button', 'button button-quiet', t('Use saved version'));
        useSaved.type = 'button';
        useSaved.addEventListener('click', async () => {
            await this.loadEntity(this.entity.id);
            this.values = formValues(this.type, this.entity);
            this.initial = { ...this.values };
            this.conflict = false;
            this.render();
        });
        const keep = element('button', 'button button-primary', t('Keep my draft'));
        keep.type = 'button';
        keep.addEventListener('click', async () => {
            // Rebase: the latest version becomes the base and only the fields edited here are
            // laid over it, so changes made elsewhere to other fields survive.
            const edited = Object.keys(this.values).filter(
                (field) => this.values[field] !== this.initial[field],
            );
            const draft = this.values;
            await this.loadEntity(this.entity.id);
            this.initial = formValues(this.type, this.entity);
            this.values = {
                ...this.initial,
                ...Object.fromEntries(edited.map((field) => [field, draft[field]])),
            };
            this.conflict = false;
            this.render();
        });
        row.append(useSaved, keep);
        notice.append(row);
        return notice;
    }

    showError(error) {
        const output = this.dialog.querySelector('[data-quick-editor-error]');
        if (!output) return;
        output.textContent = errorText(error);
        output.classList.remove('is-hidden');
    }

    async run(form, operation) {
        if (this.busy) return;
        this.busy = true;
        form?.setAttribute('aria-busy', 'true');
        const controls = form ? [...form.elements].filter((control) => !control.disabled) : [];
        for (const control of controls) control.disabled = true;
        try {
            await operation();
        } catch (error) {
            if (error?.status === 409 && this.mode === 'edit') {
                this.conflict = true;
                this.render();
            }
            this.showError(error);
        } finally {
            this.busy = false;
            form?.setAttribute('aria-busy', 'false');
            for (const control of controls) if (control.isConnected) control.disabled = false;
        }
    }

    save(form) {
        return this.run(form, async () => {
            const body = changedFields(this.type, this.values, this.initial);
            if (this.mode === 'edit') {
                if (!Object.keys(body).length) {
                    this.dialog.close();
                    return;
                }
                const response = await patch(`/api/v1/${this.type}s/${this.entity.id}`, {
                    base_version: this.entity.version,
                    ...body,
                });
                this.entity = response.payload.data;
            } else {
                // New work always starts Not started; status is not a create field.
                delete body.status;
                const response = await post(`/api/v1/${this.type}s`, body);
                this.entity = response.payload.data;
            }
            this.values = formValues(this.type, this.entity);
            this.initial = { ...this.values };
            changed(this.type, this.entity.id);
            this.dialog.close();
        });
    }

    transition(action) {
        const form = this.dialog.querySelector('form');
        return this.run(form, async () => {
            if (this.dirty() && !window.confirm(t('Discard your unsaved changes?'))) return;
            const response = await transitionEntity(this.type, this.entity, action);
            if (!response) return;
            await this.loadEntity(this.entity.id);
            this.values = formValues(this.type, this.entity);
            this.initial = { ...this.values };
            changed(this.type, this.entity.id);
            this.render();
        });
    }

    checklistSection() {
        const section = element('section', 'quick-editor-checklist');
        section.setAttribute('aria-labelledby', 'quick-editor-checklist-title');
        const heading = element('div', 'section-heading');
        const title = element('h3', null, t('Task completion checklist'));
        title.id = 'quick-editor-checklist-title';
        const count = element(
            'span',
            'subtle-copy',
            `${this.checklist.filter((item) => item.checked).length} / ${this.checklist.length}`,
        );
        heading.append(title, count);
        const list = element('div', 'quick-editor-checklist-list');
        for (const item of this.checklist) {
            const row = element('label', 'check-row checklist-row');
            const box = element('input');
            box.type = 'checkbox';
            box.checked = item.checked;
            box.addEventListener('change', () =>
                this.checklistChange(() =>
                    patch(`/api/v1/tasks/${this.entity.id}/checklist/${item.id}`, {
                        base_version: item.version,
                        checked: box.checked,
                    }),
                ),
            );
            row.append(box, element('span', null, item.title));
            list.append(row);
        }
        const add = element('div', 'inline-form');
        const input = element('input');
        input.placeholder = t('What needs to be done?');
        input.maxLength = 500;
        input.setAttribute('aria-label', t('New completion check'));
        const button = element('button', 'button button-quiet', t('Add'));
        button.type = 'button';
        const submit = () => {
            const value = input.value.trim();
            if (!value) return;
            this.checklistChange(() =>
                post(`/api/v1/tasks/${this.entity.id}/checklist`, {
                    title: value,
                    position: this.checklist.length,
                }),
            );
        };
        button.addEventListener('click', submit);
        input.addEventListener('keydown', (event) => {
            if (event.key !== 'Enter') return;
            event.preventDefault();
            submit();
        });
        add.append(input, button);
        section.append(heading, list, add);
        return section;
    }

    async checklistChange(operation) {
        try {
            await operation();
            const response = await get(`/api/v1/tasks/${this.entity.id}/checklist`);
            this.checklist = response.payload.data;
            const current = this.dialog.querySelector('.quick-editor-checklist');
            current?.replaceWith(this.checklistSection());
            changed('task', this.entity.id);
        } catch (error) {
            this.showError(error);
        }
    }
}

export function openQuickEditor(type, id, options = {}) {
    sheet ??= new QuickEditor();
    return sheet.open({ type, id, ...options });
}

export function openQuickCreator(type, preset = {}, options = {}) {
    sheet ??= new QuickEditor();
    return sheet.open({ type, preset, ...options });
}

/** Plain clicks on marked links open the editor; modified clicks keep the full page. */
export function initQuickEditor() {
    document.addEventListener('click', (event) => {
        const link = event.target.closest('a[data-quick-edit]');
        if (
            !link ||
            event.defaultPrevented ||
            event.button !== 0 ||
            event.metaKey ||
            event.ctrlKey ||
            event.shiftKey ||
            event.altKey
        )
            return;
        event.preventDefault();
        openQuickEditor(link.dataset.quickEdit, link.dataset.quickId, { trigger: link });
    });
}
