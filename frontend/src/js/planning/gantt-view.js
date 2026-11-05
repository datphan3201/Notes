import { t } from '../lib/i18n.js';
import { intlLocale } from '../lib/format.js';
import { entityIcon } from '../lib/entity-icons.js';
import { addDays } from '../lib/calendar.js';
import { lineIcon } from '../lib/line-icons.js';
import { quickEditLink } from './quick-editor.js';
import { timeOfDay } from './task-capture.js';
import {
    ZOOMS,
    dayOffset,
    dragChanges,
    draggable,
    extendRange,
    ganttRows,
    initialRange,
    scaleSegments,
    spanWidth,
} from './gantt-model.js';

const BY_KEY = 'planner.gantt.by';
const ZOOM_KEY = 'planner.gantt.zoom';
const ROW_HEIGHT = 40;

const format = (date, options) =>
    new Intl.DateTimeFormat(intlLocale(), { timeZone: 'UTC', ...options }).format(
        new Date(`${date}T00:00:00Z`),
    );

function element(tag, className, text) {
    const node = document.createElement(tag);
    if (className) node.className = className;
    if (text != null) node.textContent = text;
    return node;
}

/**
 * The Calendar's Gantt view: rows by Task, Milestone or Goal beside a timeline that scrolls
 * sideways and grows as its end comes into view. Bars move by dragging (the whole bar or an
 * edge) or with Alt + arrow keys (Shift for the end), through `onChange(row, changes)`.
 */
export function initGanttView(root, { timezone, today, visible, onChange, announce }) {
    const scroll = root.querySelector('[data-gantt-scroll]');
    const bySelect = root.querySelector('[data-gantt-by]');
    const zoomSelect = root.querySelector('[data-gantt-zoom]');
    let by = localStorage.getItem(BY_KEY);
    if (!['task', 'milestone', 'goal'].includes(by)) by = 'goal';
    let zoom = localStorage.getItem(ZOOM_KEY);
    if (!(zoom in ZOOMS)) zoom = 'day';
    bySelect.value = by;
    zoomSelect.value = zoom;
    let range = initialRange(today(), zoom);
    let data = { tasks: [], milestones: [], goals: [] };
    const expanded = new Set();
    let rows = [];
    let focusKey = null;
    let suppressClick = false;

    const px = () => ZOOMS[zoom];
    const x = (date) => dayOffset(range, date, zoom);
    const rangeEnd = () => addDays(range.start, range.days - 1);

    function scale() {
        const { months, units } = scaleSegments(range, zoom);
        const head = element('div', 'gantt-scale');
        const top = element('div', 'gantt-scale-row is-top');
        for (const month of months) {
            const cell = element(
                'span',
                'gantt-scale-cell',
                format(
                    month.start,
                    zoom === 'month' ? { year: 'numeric' } : { month: 'long', year: 'numeric' },
                ),
            );
            cell.style.left = `${x(month.start)}px`;
            cell.style.width = `${month.days * px()}px`;
            top.append(cell);
        }
        const bottom = element('div', 'gantt-scale-row');
        for (const unit of units) {
            const label =
                zoom === 'day'
                    ? format(unit.start, { day: 'numeric' })
                    : zoom === 'week'
                      ? format(unit.start, { day: 'numeric', month: 'numeric' })
                      : format(unit.start, { month: 'short' });
            const cell = element('span', 'gantt-scale-cell', label);
            cell.style.left = `${x(unit.start)}px`;
            cell.style.width = `${unit.days * px()}px`;
            if (zoom === 'day') {
                cell.title = format(unit.start, { dateStyle: 'full' });
                const weekend = [0, 6].includes(new Date(`${unit.start}T00:00:00Z`).getUTCDay());
                cell.classList.toggle('is-weekend', weekend);
                cell.classList.toggle('is-today', unit.start === today());
            }
            bottom.append(cell);
        }
        // Month zoom shows years on top and months below; finer zooms show months on top.
        if (zoom === 'month') {
            top.replaceChildren();
            const years = new Map();
            for (const month of months) {
                const year = month.start.slice(0, 4);
                const entry = years.get(year) || { start: month.start, days: 0 };
                entry.days += month.days;
                years.set(year, entry);
            }
            for (const [year, entry] of years) {
                const cell = element('span', 'gantt-scale-cell', year);
                cell.style.left = `${x(entry.start)}px`;
                cell.style.width = `${entry.days * px()}px`;
                top.append(cell);
            }
        }
        head.append(top, bottom);
        return head;
    }

    function label(row) {
        const cell = element('div', 'gantt-label');
        cell.style.setProperty('--depth', row.depth);
        if (row.hasChildren) {
            const toggle = element('button', 'gantt-toggle');
            toggle.type = 'button';
            toggle.setAttribute('aria-expanded', String(row.expanded));
            toggle.setAttribute(
                'aria-label',
                `${row.expanded ? t('Collapse') : t('Expand')} ${row.item.name}`,
            );
            toggle.textContent = row.expanded ? '▾' : '▸';
            toggle.addEventListener('click', () => {
                if (expanded.has(row.key)) expanded.delete(row.key);
                else expanded.add(row.key);
                focusKey = `toggle:${row.key}`;
                render();
            });
            cell.append(toggle);
        } else cell.append(element('span', 'gantt-toggle-space'));
        if (row.type !== 'task')
            cell.append(
                entityIcon(row.item, {
                    size: 'sm',
                    fallbackIcon: row.type === 'milestone' ? 'flag' : 'target',
                }),
            );
        const copy = element('span', 'gantt-label-copy');
        const name = element('a', 'gantt-label-name', row.item.name);
        name.href =
            row.type === 'task'
                ? `/tasks/${encodeURIComponent(row.item.id)}`
                : `/goals/${encodeURIComponent(row.type === 'goal' ? row.item.id : row.item.goal_id)}`;
        quickEditLink(name, row.type, row.item.id);
        copy.append(name);
        if (row.context) copy.append(element('small', 'gantt-label-context', row.context));
        cell.append(copy);
        return cell;
    }

    function describe(row) {
        const span = row.span;
        const dates = span.point
            ? format(span.start, { day: 'numeric', month: 'short' })
            : `${format(span.start, { day: 'numeric', month: 'short' })} – ${format(span.end, {
                  day: 'numeric',
                  month: 'short',
              })}`;
        return [
            row.item.name,
            dates,
            row.type === 'task' ? '' : `${Math.round(row.progress)}%`,
            row.done ? t('Done') : '',
            row.overdue ? t('Overdue') : '',
        ]
            .filter(Boolean)
            .join(' · ');
    }

    function bar(row) {
        const span = row.span;
        const bar = element('a', `gantt-bar is-${row.type}`);
        bar.href =
            row.type === 'task'
                ? `/tasks/${encodeURIComponent(row.item.id)}`
                : `/goals/${encodeURIComponent(row.type === 'goal' ? row.item.id : row.item.goal_id)}`;
        quickEditLink(bar, row.type, row.item.id);
        bar.dataset.ganttKey = row.key;
        bar.classList.toggle('is-point', span.point);
        bar.classList.toggle('is-done', row.done);
        bar.classList.toggle('is-overdue', row.overdue);
        bar.classList.toggle('is-derived-start', Boolean(span.derived?.start));
        bar.classList.toggle('is-derived-end', Boolean(span.derived?.end));
        bar.style.left = `${x(span.start)}px`;
        bar.style.width = span.point ? '' : `${spanWidth(span.start, span.end, zoom)}px`;
        if (!span.point && row.type !== 'task')
            bar.style.setProperty('--progress', `${Math.max(0, Math.min(100, row.progress))}%`);
        const text = describe(row);
        bar.setAttribute('aria-label', text);
        bar.title = text;
        // The same chip as a Calendar item: icon, slot time for scheduled work, then the name.
        // A bar too short for its name shows the name just after it.
        bar.classList.toggle('is-narrow', span.point || spanWidth(span.start, span.end, zoom) < 90);
        const content = element('span', 'gantt-bar-content');
        content.append(marker(row));
        if (row.type === 'task' && row.item.scheduled_start)
            content.append(
                element('span', 'gantt-bar-time', timeOfDay(row.item.scheduled_start, timezone)),
            );
        content.append(element('span', 'gantt-bar-text', row.item.name));
        bar.append(content);
        const can = draggable(row);
        if (can.start) bar.append(element('span', 'gantt-handle is-start'));
        if (can.end) bar.append(element('span', 'gantt-handle is-end'));
        if (can.move || can.start || can.end) enableDrag(bar, row, can);
        return bar;
    }

    function marker(row) {
        if (row.type !== 'task')
            return entityIcon(row.item, {
                size: 'sm',
                fallbackIcon: row.type === 'milestone' ? 'flag' : 'target',
            });
        const icon = lineIcon(row.item.scheduled_start ? 'clock' : 'calendar');
        icon.classList.add('gantt-bar-icon');
        return icon;
    }

    function enableDrag(bar, row, can) {
        bar.classList.add('is-draggable');
        // A link would otherwise start the browser's own drag and swallow the pointer moves.
        bar.draggable = false;
        bar.addEventListener('dragstart', (event) => event.preventDefault());
        bar.addEventListener('pointerdown', (event) => {
            if (event.button !== 0) return;
            const mode = event.target.classList.contains('is-start')
                ? 'start'
                : event.target.classList.contains('is-end')
                  ? 'end'
                  : 'move';
            if (!can[mode]) return;
            event.preventDefault();
            bar.setPointerCapture(event.pointerId);
            const originX = event.clientX;
            const left = bar.offsetLeft;
            const width = bar.offsetWidth;
            let days = 0;
            const onMove = (move) => {
                days = Math.round((move.clientX - originX) / px());
                const shift = days * px();
                if (mode === 'move') bar.style.left = `${left + shift}px`;
                else if (mode === 'end') bar.style.width = `${Math.max(px(), width + shift)}px`;
                else {
                    bar.style.left = `${Math.min(left + shift, left + width - px())}px`;
                    bar.style.width = `${Math.max(px(), width - shift)}px`;
                }
                bar.classList.toggle('is-dragging', days !== 0);
            };
            const onUp = () => {
                bar.removeEventListener('pointermove', onMove);
                bar.removeEventListener('pointerup', onUp);
                bar.removeEventListener('pointercancel', onUp);
                bar.classList.remove('is-dragging');
                if (!days) return;
                // The click that ends a drag must not also open the editor.
                suppressClick = true;
                setTimeout(() => (suppressClick = false), 0);
                commit(row, mode, days);
            };
            bar.addEventListener('pointermove', onMove);
            bar.addEventListener('pointerup', onUp);
            bar.addEventListener('pointercancel', onUp);
        });
        bar.addEventListener('keydown', (event) => {
            if (!event.altKey || !['ArrowLeft', 'ArrowRight'].includes(event.key)) return;
            const mode = event.shiftKey ? 'end' : 'move';
            if (!can[mode]) return;
            event.preventDefault();
            focusKey = row.key;
            commit(row, mode, event.key === 'ArrowLeft' ? -1 : 1);
        });
    }

    function commit(row, mode, days) {
        const changes = dragChanges(row.type, row.item, mode, days, timezone);
        if (!changes) {
            render();
            return;
        }
        focusKey ??= row.key;
        onChange(row, changes);
    }

    function links(container) {
        // Prerequisite links between visible Milestones: from the end of the earlier bar to the
        // start of the later one.
        const index = new Map(rows.map((row, position) => [row.key, position]));
        const svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
        svg.setAttribute('class', 'gantt-links');
        svg.setAttribute('aria-hidden', 'true');
        svg.setAttribute('width', String(range.days * px()));
        svg.setAttribute('height', String(rows.length * ROW_HEIGHT));
        for (const row of rows) {
            if (row.type !== 'milestone' || !row.span) continue;
            for (const id of row.item.prerequisite_ids || []) {
                const from = rows[index.get(`milestone:${id}`)];
                if (!from?.span) continue;
                const x1 = x(from.span.end) + px();
                const y1 = index.get(from.key) * ROW_HEIGHT + ROW_HEIGHT / 2;
                const x2 = x(row.span.start);
                const y2 = index.get(row.key) * ROW_HEIGHT + ROW_HEIGHT / 2;
                const bend = Math.max(x1 + 8, Math.min(x2 - 8, x1 + 16));
                const path = document.createElementNS('http://www.w3.org/2000/svg', 'path');
                path.setAttribute('d', `M${x1} ${y1} H${bend} V${y2} H${x2}`);
                svg.append(path);
            }
        }
        container.append(svg);
    }

    function render() {
        rows = ganttRows(
            data,
            { by, expanded, visible, today: today(), from: range.start },
            timezone,
        );
        const width = range.days * px();
        const canvas = element('div', `gantt-canvas is-${zoom}`);
        canvas.style.setProperty('--day', `${px()}px`);
        canvas.style.setProperty('--timeline', `${width}px`);
        const head = element('div', 'gantt-row gantt-head');
        head.append(
            element(
                'div',
                'gantt-label gantt-corner',
                t({ task: 'Task', milestone: 'Milestone', goal: 'Goal' }[by]),
            ),
            scale(),
        );
        const body = element('div', 'gantt-body');
        const tracks = element('div', 'gantt-tracks');
        for (const row of rows) {
            const line = element('div', `gantt-row is-${row.type}`);
            const track = element('div', 'gantt-track');
            if (row.span) track.append(bar(row));
            line.append(label(row), track);
            body.append(line);
        }
        if (!rows.length) {
            const empty = element(
                'p',
                'subtle-copy gantt-empty',
                t(
                    'Nothing to show yet. Give your goals, milestones or tasks a date to see them here.',
                ),
            );
            body.append(empty);
        }
        links(tracks);
        const marker = element('div', 'gantt-today');
        marker.style.left = `${x(today()) + px() / 2}px`;
        marker.title = t('Today');
        tracks.append(marker);
        body.append(tracks);
        canvas.append(head, body);
        const keep = scroll.scrollLeft;
        scroll.replaceChildren(canvas);
        scroll.scrollLeft = keep;
        if (focusKey) {
            const key = focusKey;
            focusKey = null;
            const target = key.startsWith('toggle:')
                ? [...scroll.querySelectorAll('.gantt-toggle')].find(
                      (button) =>
                          button
                              .closest('.gantt-row')
                              ?.querySelector('.gantt-bar, .gantt-label-name')?.dataset.quickId ===
                          key.split(':')[2],
                  )
                : scroll.querySelector(`[data-gantt-key="${CSS.escape(key)}"]`);
            target?.focus();
        }
        period();
    }

    function period() {
        const labelWidth = scroll.querySelector('.gantt-corner')?.offsetWidth || 0;
        const first = Math.max(0, Math.floor(scroll.scrollLeft / px()));
        const last = Math.floor((scroll.scrollLeft + scroll.clientWidth - labelWidth) / px());
        const from = addDays(range.start, first);
        const to = addDays(range.start, Math.min(range.days - 1, Math.max(first, last)));
        return { from, to };
    }

    // The timeline grows at its end, so sliding right always reveals later weeks.
    scroll.addEventListener('scroll', () => {
        if (scroll.scrollLeft + scroll.clientWidth > scroll.scrollWidth - 400) {
            range = extendRange(range, zoom);
            render();
        }
    });
    scroll.addEventListener(
        'click',
        (event) => {
            if (suppressClick && event.target.closest('.gantt-bar')) {
                event.preventDefault();
                event.stopPropagation();
            }
        },
        true,
    );
    bySelect.addEventListener('change', () => {
        by = bySelect.value;
        localStorage.setItem(BY_KEY, by);
        render();
    });
    zoomSelect.addEventListener('change', () => {
        const centre = period().from;
        zoom = zoomSelect.value;
        localStorage.setItem(ZOOM_KEY, zoom);
        range = initialRange(today(), zoom);
        while (addDays(range.start, range.days) < centre) range = extendRange(range, zoom);
        render();
        scrollTo(centre);
    });

    function scrollTo(date) {
        if (date < range.start) range = initialRange(date, zoom);
        while (addDays(range.start, range.days - 30) < date) range = extendRange(range, zoom);
        render();
        scroll.scrollLeft = Math.max(0, x(date) - 2 * px() - (zoom === 'day' ? 2 * px() : 0));
    }

    return {
        update(next) {
            data = next;
            render();
        },
        today() {
            range = initialRange(today(), zoom);
            render();
            scrollTo(today());
            announce(t('Today'));
        },
        /** Slides the timeline by about one screen; `step` is -1 or 1. */
        step(step) {
            const days = Math.max(7, Math.floor((scroll.clientWidth * 0.8) / px()));
            scrollTo(addDays(period().from, step * days));
        },
        /** The visible dates, for the toolbar title. */
        period,
        rangeEnd,
    };
}
