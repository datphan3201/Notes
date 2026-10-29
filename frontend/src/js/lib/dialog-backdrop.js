/**
 * Clicking the dimmed area around any open <dialog> closes it the same way
 * Escape does: a cancelable `cancel` event goes first, so dialogs that are
 * busy saving can still refuse. The press must also start on the backdrop,
 * so dragging a text selection out of a field never closes the dialog.
 */
export function outsideDialog(dialog, x, y) {
    const box = dialog.getBoundingClientRect();
    return x < box.left || x > box.right || y < box.top || y > box.bottom;
}

function backdropTarget(event) {
    const dialog = event.target;
    if (!(dialog instanceof HTMLDialogElement) || !dialog.open) return null;
    return outsideDialog(dialog, event.clientX, event.clientY) ? dialog : null;
}

export function initDialogBackdropClose() {
    let pressed = null;
    document.addEventListener('pointerdown', (event) => {
        pressed = backdropTarget(event);
    });
    document.addEventListener('click', (event) => {
        const dialog = backdropTarget(event);
        const started = pressed;
        pressed = null;
        if (!dialog || dialog !== started) return;
        if (dialog.dispatchEvent(new Event('cancel', { cancelable: true }))) dialog.close();
    });
}
