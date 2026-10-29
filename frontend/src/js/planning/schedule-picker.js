import { t } from '../lib/i18n.js';
import {
    addDays,
    monthMatrix,
    nextWeek,
    reminderPreset,
    shiftMonth,
    to24Hour,
    weekday,
} from '../lib/calendar.js';

const locale = () => (window.notesBootstrap?.preferences?.locale === 'vi' ? 'vi-VN' : 'en-US');
const weekdayName = (date, style = 'short') =>
    new Date(`${date}T00:00:00Z`).toLocaleDateString(locale(), { weekday: style, timeZone: 'UTC' });

let openMenu = null;

export function closeScheduleMenu() {
    openMenu?.remove();
    openMenu = null;
}

const button = (label, detail, onClick) => {
    const node = document.createElement('button');
    node.type = 'button';
    node.className = 'schedule-option';
    const text = document.createElement('span');
    text.textContent = label;
    node.append(text);
    if (detail) {
        const small = document.createElement('small');
        small.textContent = detail;
        node.append(small);
    }
    node.addEventListener('click', onClick);
    return node;
};

function calendarView(menu, { today, initial, withTime, onSave }) {
    const start = (initial || today).slice(0, 10);
    let { year, month } = { year: Number(start.slice(0, 4)), month: Number(start.slice(5, 7)) };
    let chosen = start;
    const view = document.createElement('div');
    view.className = 'schedule-calendar';
    const heading = document.createElement('div');
    heading.className = 'schedule-calendar-heading';
    const title = document.createElement('strong');
    const previous = button('▲', null, () => move(-1));
    previous.setAttribute('aria-label', t('Previous month'));
    const next = button('▼', null, () => move(1));
    next.setAttribute('aria-label', t('Next month'));
    heading.append(title, previous, next);
    const grid = document.createElement('div');
    grid.className = 'schedule-calendar-grid';
    grid.setAttribute('role', 'grid');
    const time = document.createElement('div');
    time.className = 'schedule-time';
    const hour = document.createElement('select');
    const minute = document.createElement('select');
    const meridiem = document.createElement('select');
    for (let value = 1; value <= 12; value++) hour.append(new Option(String(value), String(value)));
    for (let value = 0; value < 60; value += 5)
        minute.append(new Option(String(value).padStart(2, '0'), String(value)));
    meridiem.append(new Option('AM', 'AM'), new Option('PM', 'PM'));
    const initialTime = initial && initial.length > 10 ? initial.slice(11, 16) : '19:00';
    const [initialHour, initialMinute] = initialTime.split(':').map(Number);
    hour.value = String(initialHour % 12 || 12);
    minute.value = String(Math.floor(initialMinute / 5) * 5);
    meridiem.value = initialHour >= 12 ? 'PM' : 'AM';
    hour.setAttribute('aria-label', t('Hour'));
    minute.setAttribute('aria-label', t('Minute'));
    meridiem.setAttribute('aria-label', 'AM/PM');
    time.append(hour, minute, meridiem);
    time.hidden = !withTime;
    const footer = document.createElement('div');
    footer.className = 'schedule-footer';
    const cancel = button(t('Cancel'), null, closeScheduleMenu);
    const save = button(t('Save'), null, () => {
        onSave(
            withTime ? `${chosen}T${to24Hour(hour.value, minute.value, meridiem.value)}` : chosen,
        );
        closeScheduleMenu();
    });
    save.classList.add('is-primary');
    footer.append(cancel, save);

    const render = () => {
        title.textContent = new Date(Date.UTC(year, month - 1, 1)).toLocaleDateString(locale(), {
            month: 'long',
            year: 'numeric',
            timeZone: 'UTC',
        });
        grid.replaceChildren();
        for (const date of monthMatrix(year, month)[0]) {
            const label = document.createElement('span');
            label.className = 'schedule-weekday';
            label.textContent = weekdayName(date, 'short').slice(0, 2);
            grid.append(label);
        }
        for (const week of monthMatrix(year, month)) {
            for (const date of week) {
                const day = document.createElement('button');
                day.type = 'button';
                day.textContent = String(Number(date.slice(8)));
                day.classList.toggle('is-outside', Number(date.slice(5, 7)) !== month);
                day.classList.toggle('is-today', date === today);
                day.classList.toggle('is-selected', date === chosen);
                day.setAttribute('aria-pressed', String(date === chosen));
                day.setAttribute(
                    'aria-label',
                    new Date(`${date}T00:00:00Z`).toLocaleDateString(locale(), {
                        dateStyle: 'full',
                        timeZone: 'UTC',
                    }),
                );
                day.addEventListener('click', () => {
                    chosen = date;
                    render();
                });
                grid.append(day);
            }
        }
    };
    const move = (delta) => {
        ({ year, month } = shiftMonth(year, month, delta));
        render();
    };
    render();
    view.append(heading, grid, time, footer);
    setMenuBody(menu, view);
    grid.querySelector('.is-selected')?.focus();
}

function customRepeatView(menu, { current, onSave }) {
    const form = document.createElement('form');
    form.className = 'schedule-custom';
    const every = document.createElement('label');
    every.textContent = t('Repeat every');
    const interval = document.createElement('input');
    interval.type = 'number';
    interval.min = '1';
    interval.max = '52';
    interval.value = String(current?.interval || 1);
    const unit = document.createElement('select');
    for (const [value, label] of [
        ['daily', 'days'],
        ['weekly', 'weeks'],
        ['monthly', 'months'],
        ['yearly', 'years'],
    ])
        unit.append(new Option(t(label), value));
    unit.value = current?.unit || 'weekly';
    every.append(interval, unit);
    const days = document.createElement('fieldset');
    days.className = 'weekday-picker';
    const legend = document.createElement('legend');
    legend.textContent = t('On these days');
    days.append(legend);
    // ISO weekday numbers 1 (Mon) … 7 (Sun), labelled from a known Monday.
    for (let day = 1; day <= 7; day++) {
        const label = document.createElement('label');
        const box = document.createElement('input');
        box.type = 'checkbox';
        box.value = String(day);
        box.checked = current?.weekdays?.includes(day) || false;
        label.append(box, weekdayName(addDays('2026-01-05', day - 1), 'short'));
        days.append(label);
    }
    const ends = document.createElement('label');
    ends.textContent = t('Ends (optional)');
    const end = document.createElement('input');
    end.type = 'date';
    end.value = current?.end || '';
    ends.append(end);
    const sync = () => {
        days.hidden = unit.value !== 'weekly';
    };
    unit.addEventListener('change', sync);
    sync();
    const footer = document.createElement('div');
    footer.className = 'schedule-footer';
    const cancel = button(t('Cancel'), null, closeScheduleMenu);
    const save = document.createElement('button');
    save.type = 'submit';
    save.className = 'schedule-option is-primary';
    save.textContent = t('Save');
    footer.append(cancel, save);
    form.append(every, days, ends, footer);
    form.addEventListener('submit', (event) => {
        event.preventDefault();
        onSave({
            kind: 'custom',
            unit: unit.value,
            interval: Math.min(52, Math.max(1, Number(interval.value) || 1)),
            weekdays: [...days.querySelectorAll('input:checked')].map((box) => Number(box.value)),
            end: end.value || null,
        });
        closeScheduleMenu();
    });
    setMenuBody(menu, form);
    interval.focus();
}

// Keeps the menu fully on screen, e.g. after it grows into a calendar.
function keepInView(menu) {
    const rect = menu.getBoundingClientRect();
    menu.style.left = `${Math.max(8, Math.min(rect.left, window.innerWidth - rect.width - 8))}px`;
    menu.style.top = `${Math.max(8, Math.min(rect.top, window.innerHeight - rect.height - 8))}px`;
}

function setMenuBody(menu, ...nodes) {
    menu.querySelector('.schedule-menu-body').replaceChildren(...nodes);
    keepInView(menu);
}

// The grip at the top lets the menu be dragged anywhere inside the viewport.
function dragHandle(menu) {
    const handle = document.createElement('div');
    handle.className = 'schedule-drag-handle';
    handle.title = t('Drag to move');
    handle.setAttribute('aria-hidden', 'true');
    handle.addEventListener('pointerdown', (event) => {
        if (event.button !== 0) return;
        event.preventDefault();
        const rect = menu.getBoundingClientRect();
        const dx = event.clientX - rect.left;
        const dy = event.clientY - rect.top;
        handle.setPointerCapture(event.pointerId);
        menu.classList.add('is-dragging');
        const move = (next) => {
            menu.style.left = `${Math.max(8, Math.min(next.clientX - dx, window.innerWidth - rect.width - 8))}px`;
            menu.style.top = `${Math.max(8, Math.min(next.clientY - dy, window.innerHeight - rect.height - 8))}px`;
        };
        const stop = () => {
            menu.classList.remove('is-dragging');
            handle.removeEventListener('pointermove', move);
            handle.removeEventListener('pointerup', stop);
            handle.removeEventListener('pointercancel', stop);
        };
        handle.addEventListener('pointermove', move);
        handle.addEventListener('pointerup', stop);
        handle.addEventListener('pointercancel', stop);
    });
    return handle;
}

/**
 * Opens a menu under `anchor`. kind: 'date' (YYYY-MM-DD), 'reminder'
 * (YYYY-MM-DDTHH:MM local) or 'repeat' ({kind, unit, interval, weekdays, end}).
 * onSelect receives the new value, or null to clear it.
 */
export function openScheduleMenu(anchor, kind, { today, value = null, onSelect }) {
    closeScheduleMenu();
    const menu = document.createElement('div');
    menu.className = 'schedule-menu';
    menu.setAttribute('role', 'dialog');
    menu.setAttribute(
        'aria-label',
        t({ date: 'Due date', reminder: 'Remind me', repeat: 'Repeat' }[kind]),
    );
    const body = document.createElement('div');
    body.className = 'schedule-menu-body';
    menu.append(dragHandle(menu), body);
    const choose = (next) => {
        onSelect(next);
        closeScheduleMenu();
        anchor.focus();
    };
    if (kind === 'date') {
        const tomorrow = addDays(today, 1);
        const week = nextWeek(today);
        body.append(
            button(t('Today'), weekdayName(today), () => choose(today)),
            button(t('Tomorrow'), weekdayName(tomorrow), () => choose(tomorrow)),
            button(t('Next week'), weekdayName(week), () => choose(week)),
            button(t('Pick a date'), null, () =>
                calendarView(menu, { today, initial: value, withTime: false, onSave: onSelect }),
            ),
        );
    } else if (kind === 'reminder') {
        const presets = ['later', 'tomorrow', 'week'].map((preset) => reminderPreset(preset));
        const describe = (stamp) =>
            new Date(stamp).toLocaleString(locale(), {
                weekday: 'short',
                hour: 'numeric',
                minute: '2-digit',
            });
        body.append(
            button(t('Later today'), describe(presets[0]), () => choose(presets[0])),
            button(t('Tomorrow'), describe(presets[1]), () => choose(presets[1])),
            button(t('Next week'), describe(presets[2]), () => choose(presets[2])),
            button(t('Pick a date & time'), null, () =>
                calendarView(menu, { today, initial: value, withTime: true, onSave: onSelect }),
            ),
        );
    } else {
        for (const [choice, label] of [
            ['daily', 'Daily'],
            ['weekdays', 'Weekdays'],
            ['weekly', 'Weekly'],
            ['monthly', 'Monthly'],
            ['yearly', 'Yearly'],
        ])
            body.append(
                button(t(label), null, () => choose({ kind: choice, end: value?.end || null })),
            );
        body.append(
            button(t('Custom'), null, () =>
                customRepeatView(menu, { current: value, onSave: onSelect }),
            ),
        );
    }
    if (value) {
        const clear = button(
            t(
                { date: 'Remove due date', reminder: 'Remove reminder', repeat: 'Do not repeat' }[
                    kind
                ],
            ),
            null,
            () => choose(null),
        );
        clear.classList.add('is-danger');
        body.append(clear);
    }
    (anchor.closest('dialog') || document.body).append(menu);
    const rect = anchor.getBoundingClientRect();
    menu.style.top = `${Math.min(rect.bottom + 4, window.innerHeight - menu.offsetHeight - 8)}px`;
    menu.style.left = `${Math.max(8, Math.min(rect.left, window.innerWidth - menu.offsetWidth - 8))}px`;
    openMenu = menu;
    menu.querySelector('button')?.focus();
}

globalThis.document?.addEventListener('keydown', (event) => {
    if (event.key === 'Escape' && openMenu) {
        event.stopPropagation();
        closeScheduleMenu();
    }
});
globalThis.document?.addEventListener('pointerdown', (event) => {
    if (
        openMenu &&
        !openMenu.contains(event.target) &&
        !event.target.closest('[data-schedule-open]')
    )
        closeScheduleMenu();
});

export function describeRepeat(rule) {
    if (!rule) return '';
    if (rule.kind !== 'custom') return t(rule.kind[0].toUpperCase() + rule.kind.slice(1));
    const unit = t(
        { daily: 'days', weekly: 'weeks', monthly: 'months', yearly: 'years' }[rule.unit],
    );
    return `${t('Every')} ${rule.interval} ${unit}`;
}

/** Binds the three icon buttons of a Task capture form to its hidden fields. */
export function initScheduleToolbar(form, todayProvider) {
    const toolbar = form.querySelector('[data-schedule-toolbar]');
    if (!toolbar || toolbar.dataset.ready) return;
    toolbar.dataset.ready = 'true';
    const field = (name) => form.elements[name];
    const label = (kind) => toolbar.querySelector(`[data-schedule-label="${kind}"]`);
    const readRepeat = () =>
        field('repeat_frequency').value
            ? {
                  kind: field('repeat_frequency').value,
                  unit: field('repeat_unit').value || 'weekly',
                  interval: Number(field('repeat_interval').value || 1),
                  weekdays: field('repeat_days').value
                      ? field('repeat_days').value.split(',').map(Number)
                      : [],
                  end: field('repeat_end').value || null,
              }
            : null;
    const render = () => {
        const due = field('deadline').value;
        const reminder = field('reminder_at').value;
        label('date').textContent = due
            ? new Date(`${due}T00:00:00Z`).toLocaleDateString(locale(), {
                  weekday: 'short',
                  day: 'numeric',
                  month: 'short',
                  timeZone: 'UTC',
              })
            : '';
        label('reminder').textContent = reminder
            ? new Date(reminder).toLocaleString(locale(), {
                  day: 'numeric',
                  month: 'short',
                  hour: 'numeric',
                  minute: '2-digit',
              })
            : '';
        label('repeat').textContent = describeRepeat(readRepeat());
        for (const kind of ['date', 'reminder', 'repeat'])
            toolbar
                .querySelector(`[data-schedule-open="${kind}"]`)
                .classList.toggle('is-set', !!label(kind).textContent);
    };
    const set = (name, value) => {
        field(name).value = value ?? '';
        field(name).dispatchEvent(new Event('input', { bubbles: true }));
    };
    toolbar.querySelectorAll('[data-schedule-open]').forEach((trigger) =>
        trigger.addEventListener('click', () => {
            const kind = trigger.dataset.scheduleOpen;
            const today = todayProvider();
            const value =
                kind === 'date'
                    ? field('deadline').value || null
                    : kind === 'reminder'
                      ? field('reminder_at').value || null
                      : readRepeat();
            openScheduleMenu(trigger, kind, {
                today,
                value,
                onSelect: (next) => {
                    if (kind === 'date') set('deadline', next);
                    else if (kind === 'reminder') set('reminder_at', next);
                    else {
                        set('repeat_frequency', next?.kind);
                        set('repeat_unit', next?.unit);
                        set('repeat_interval', next?.interval || 1);
                        set('repeat_days', next?.weekdays?.join(','));
                        set('repeat_end', next?.end);
                    }
                    render();
                },
            });
        }),
    );
    form.addEventListener('reset', () => window.setTimeout(render));
    form.addEventListener('schedule:refresh', render);
    render();
}
