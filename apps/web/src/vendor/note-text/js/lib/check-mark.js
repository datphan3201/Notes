// The single check mark used across the app. Its shape lives in the
// --check-mark CSS mask so markers, buttons and checkboxes all match.
export function checkMark() {
    const mark = document.createElement('span');
    mark.className = 'check-mark';
    mark.setAttribute('aria-hidden', 'true');
    return mark;
}

// Replaces a control's content with the check mark followed by its label.
export function setCheckedLabel(node, label) {
    node.replaceChildren(checkMark(), document.createTextNode(label));
}

// The missed-day x shares the check mark's size and colour rules.
export function crossMark() {
    const mark = checkMark();
    mark.classList.add('is-cross');
    return mark;
}
