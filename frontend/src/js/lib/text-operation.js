/**
 * Operational-transformation text operations, wire-compatible with the PHP
 * Planner\Domain\Realtime\TextOperation.
 *
 * An operation is an array of components applied left to right over the
 * whole document: a positive integer retains that many characters, a negative
 * integer deletes that many and a string inserts itself. Lengths are UTF-16
 * code units (JavaScript string indices).
 */

const isRetain = (component) => typeof component === 'number' && component > 0;
const isDelete = (component) => typeof component === 'number' && component < 0;
const isInsert = (component) => typeof component === 'string';

/** Appends one component, merging with the previous one and keeping inserts before deletes. */
function push(ops, component) {
    if (component === 0 || component === '') return;
    const last = ops.length - 1;
    if (last < 0) {
        ops.push(component);
        return;
    }
    const previous = ops[last];
    if (isInsert(component) && isInsert(previous)) ops[last] = previous + component;
    else if (isRetain(component) && isRetain(previous)) ops[last] = previous + component;
    else if (isDelete(component) && isDelete(previous)) ops[last] = previous + component;
    else if (isInsert(component) && isDelete(previous)) {
        if (last > 0 && isInsert(ops[last - 1])) ops[last - 1] += component;
        else {
            ops[last] = component;
            ops.push(previous);
        }
    } else ops.push(component);
}

export function normalize(components) {
    const ops = [];
    for (const component of components) push(ops, component);
    return ops;
}

export function baseLength(ops) {
    return ops.reduce((sum, c) => sum + (isRetain(c) ? c : isDelete(c) ? -c : 0), 0);
}

export function targetLength(ops) {
    return ops.reduce((sum, c) => sum + (isRetain(c) ? c : isInsert(c) ? c.length : 0), 0);
}

export function isNoop(ops) {
    return ops.length === 0 || (ops.length === 1 && isRetain(ops[0]));
}

export function apply(ops, text) {
    if (baseLength(ops) !== text.length) {
        throw new Error('The operation does not fit the document.');
    }
    let result = '';
    let position = 0;
    for (const component of ops) {
        if (isInsert(component)) result += component;
        else if (isRetain(component)) {
            result += text.slice(position, position + component);
            position += component;
        } else position -= component;
    }
    return result;
}

/** Combines a then b into one operation with the same effect. */
export function compose(a, b) {
    if (targetLength(a) !== baseLength(b)) {
        throw new Error('Operations cannot be composed.');
    }
    const result = [];
    let i = 0;
    let j = 0;
    let x = a[i++];
    let y = b[j++];
    while (x !== undefined || y !== undefined) {
        if (isDelete(x)) {
            push(result, x);
            x = a[i++];
            continue;
        }
        if (isInsert(y)) {
            push(result, y);
            y = b[j++];
            continue;
        }
        if (x === undefined || y === undefined) throw new Error('Operations cannot be composed.');
        if (isRetain(x) && isRetain(y)) {
            const min = Math.min(x, y);
            push(result, min);
            [x, y] = [x - min || a[i++], y - min || b[j++]];
        } else if (isInsert(x) && isDelete(y)) {
            const min = Math.min(x.length, -y);
            [x, y] = [x.slice(min) || a[i++], y + min || b[j++]];
        } else if (isInsert(x) && isRetain(y)) {
            const min = Math.min(x.length, y);
            push(result, x.slice(0, min));
            [x, y] = [x.slice(min) || a[i++], y - min || b[j++]];
        } else {
            // retain then delete
            const min = Math.min(x, -y);
            push(result, -min);
            [x, y] = [x - min || a[i++], y + min || b[j++]];
        }
    }
    return result;
}

/**
 * Transforms concurrent operations a and b (same base) into [a', b'] with
 * apply(apply(d, a), b') === apply(apply(d, b), a'). a's inserts win ties.
 */
export function transform(a, b) {
    if (baseLength(a) !== baseLength(b)) throw new Error('Operations do not share a base.');
    const aPrime = [];
    const bPrime = [];
    let i = 0;
    let j = 0;
    let x = a[i++];
    let y = b[j++];
    while (x !== undefined || y !== undefined) {
        if (isInsert(x)) {
            push(aPrime, x);
            push(bPrime, x.length);
            x = a[i++];
            continue;
        }
        if (isInsert(y)) {
            push(aPrime, y.length);
            push(bPrime, y);
            y = b[j++];
            continue;
        }
        if (x === undefined || y === undefined) throw new Error('Operations do not share a base.');
        let min;
        if (isRetain(x) && isRetain(y)) {
            min = Math.min(x, y);
            push(aPrime, min);
            push(bPrime, min);
        } else if (isDelete(x) && isDelete(y)) {
            min = Math.min(-x, -y);
        } else if (isDelete(x) && isRetain(y)) {
            min = Math.min(-x, y);
            push(aPrime, -min);
        } else {
            min = Math.min(x, -y);
            push(bPrime, -min);
        }
        x = isRetain(x) ? x - min : x + min;
        y = isRetain(y) ? y - min : y + min;
        if (x === 0) x = a[i++];
        if (y === 0) y = b[j++];
    }
    return [aPrime, bPrime];
}

const isHighSurrogate = (code) => code >= 0xd800 && code <= 0xdbff;
const isLowSurrogate = (code) => code >= 0xdc00 && code <= 0xdfff;

/**
 * The single-splice operation turning `before` into `after`: the common prefix
 * and suffix are retained and the middle is replaced. Never splits a
 * surrogate pair, so the server can always apply it.
 */
export function fromDiff(before, after) {
    if (before === after) return before.length ? [before.length] : [];
    let prefix = 0;
    const max = Math.min(before.length, after.length);
    while (prefix < max && before.charCodeAt(prefix) === after.charCodeAt(prefix)) prefix++;
    if (prefix > 0 && isHighSurrogate(before.charCodeAt(prefix - 1))) prefix--;
    let suffix = 0;
    while (
        suffix < max - prefix &&
        before.charCodeAt(before.length - 1 - suffix) ===
            after.charCodeAt(after.length - 1 - suffix)
    )
        suffix++;
    if (suffix > 0 && isLowSurrogate(before.charCodeAt(before.length - suffix))) suffix--;
    const ops = [];
    push(ops, prefix);
    push(ops, after.slice(prefix, after.length - suffix));
    push(ops, -(before.length - prefix - suffix));
    push(ops, suffix);
    return ops;
}

/**
 * Where a caret at `index` moves when `ops` is applied. Inserts exactly at the
 * caret push it right only when they come from someone else (`ownInsert` false
 * keeps a remote insert after the local caret).
 */
export function transformIndex(ops, index, { ownInsert = false } = {}) {
    let newIndex = index;
    let position = 0;
    for (const component of ops) {
        if (position > index) break;
        if (isRetain(component)) position += component;
        else if (isInsert(component)) {
            if (position < index || (position === index && ownInsert)) newIndex += component.length;
        } else {
            newIndex -= Math.min(-component, index - position);
            position -= component;
        }
    }
    return Math.max(0, newIndex);
}
