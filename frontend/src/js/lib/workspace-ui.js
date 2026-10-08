// Native dialogs retain their forms when closed. Only an acknowledged creation
// clears a draft; a pending write cannot be dismissed or submitted twice.
const formStates = new WeakMap();
const leaveChecks = new Set();
let leaveGuardInstalled = false;
const readForm = (form) =>
    JSON.stringify(
        [...form.elements]
            .filter(
                (control) => control.name && !['submit', 'button', 'hidden'].includes(control.type),
            )
            .map((control) => [
                control.name,
                control.type === 'checkbox' ? control.checked : control.value,
            ]),
    );

export function creationState(form) {
    if (!formStates.has(form)) {
        let saved = readForm(form);
        const state = {
            pending: false,
            get dirty() {
                return readForm(form) !== saved;
            },
            markSaved() {
                saved = readForm(form);
            },
        };
        formStates.set(form, state);
    }
    return formStates.get(form);
}

export async function createWithForm(form, operation) {
    const state = creationState(form);
    if (state.pending) return;
    state.pending = true;
    const controls = [...form.elements].map((control) => [control, control.disabled]);
    for (const [control] of controls) control.disabled = true;
    form.setAttribute('aria-busy', 'true');
    try {
        await operation();
    } finally {
        state.pending = false;
        form.setAttribute('aria-busy', 'false');
        for (const [control, disabled] of controls) control.disabled = disabled;
    }
}

export function finishCreation(form) {
    creationState(form).markSaved();
    form.closest('dialog')?.close();
}

export function reportWorkspaceError(root, error) {
    const output =
        root.querySelector('dialog[open] [data-dialog-error]') ||
        root.querySelector('[data-planning-error]');
    if (!output) return;
    output.textContent =
        Object.values(error.payload?.errors || {}).flat()[0] ||
        error.message ||
        'Unable to complete the request.';
    output.classList.remove('is-hidden');
}

export function guardWorkspaceLeave(check) {
    leaveChecks.add(check);
    if (leaveGuardInstalled) return;
    leaveGuardInstalled = true;
    const hasDraft = () => [...leaveChecks].some((test) => test());
    let leaveAccepted = false;
    const allow = () => {
        if (!hasDraft()) return true;
        leaveAccepted = window.confirm(
            'Leave this page? Unsaved changes will be lost. A save already sent may still complete.',
        );
        return leaveAccepted;
    };
    document.addEventListener(
        'click',
        (event) => {
            if (
                event.defaultPrevented ||
                event.button !== 0 ||
                event.ctrlKey ||
                event.metaKey ||
                event.shiftKey ||
                event.altKey
            )
                return;
            const link = event.target.closest('a[href]');
            if (!link || link.target === '_blank') return;
            const destination = new URL(link.href, location.href);
            if (
                destination.origin === location.origin &&
                destination.pathname === location.pathname &&
                destination.search === location.search
            )
                return;
            if (!allow()) {
                event.preventDefault();
                event.stopImmediatePropagation();
            }
        },
        true,
    );
    document.addEventListener(
        'submit',
        (event) => {
            if (event.target.matches('[data-leave-guard-form]') && !allow()) {
                event.preventDefault();
                event.stopImmediatePropagation();
            }
        },
        true,
    );
    window.addEventListener('beforeunload', (event) => {
        if (leaveAccepted) {
            leaveAccepted = false;
            return;
        }
        if (hasDraft()) {
            event.preventDefault();
            event.returnValue = '';
        }
    });
}

export function initWorkspaceUI(root) {
    for (const menu of root.querySelectorAll('[role="tablist"]:has([data-workspace-tab])')) {
        const tabs = [...menu.querySelectorAll('[data-workspace-tab]')];
        const select = (tab) => {
            for (const item of tabs) {
                const active = item === tab;
                item.setAttribute('aria-selected', String(active));
                item.tabIndex = active ? 0 : -1;
                document.getElementById(item.getAttribute('aria-controls')).hidden = !active;
            }
        };
        for (const tab of tabs) {
            tab.addEventListener('click', () => select(tab));
            tab.addEventListener('keydown', (event) => {
                let index = tabs.indexOf(tab);
                if (event.key === 'ArrowRight') index = (index + 1) % tabs.length;
                else if (event.key === 'ArrowLeft') index = (index + tabs.length - 1) % tabs.length;
                else if (event.key === 'Home') index = 0;
                else if (event.key === 'End') index = tabs.length - 1;
                else return;
                event.preventDefault();
                select(tabs[index]);
                tabs[index].focus();
            });
        }
    }
    const forms = [...root.querySelectorAll('[data-workspace-dialog] form')];
    forms.forEach(creationState);
    if (!root.matches('[data-goal-detail]'))
        guardWorkspaceLeave(() =>
            forms.some((form) => creationState(form).dirty || creationState(form).pending),
        );
    for (const dialog of root.querySelectorAll('[data-workspace-dialog]')) {
        let trigger = null;
        const busy = () =>
            [...dialog.querySelectorAll('form')].some((form) => creationState(form).pending) ||
            dialog.querySelector('form[aria-busy="true"]');
        const open = (source) => {
            if (document.querySelector('dialog[open]') || busy()) return;
            trigger = source;
            dialog.querySelector('[data-dialog-error]')?.classList.add('is-hidden');
            dialog.showModal();
            (
                dialog.querySelector('[autofocus]') ||
                dialog.querySelector('input:not([type="hidden"]), select, textarea')
            )?.focus();
        };
        root.addEventListener('click', (event) => {
            const source = event.target.closest(`[data-open-dialog="${dialog.id}"]`);
            const link = event.target.closest('a[href^="#"]');
            const hashId = link?.getAttribute('href').slice(1);
            const target = hashId && document.getElementById(hashId);
            if (source || (target && dialog.contains(target))) {
                event.preventDefault();
                const panel = dialog.closest('[data-workspace-panel]');
                if (panel) root.querySelector(`[aria-controls="${panel.id}"]`)?.click();
                open(source || link);
            }
        });
        dialog.addEventListener('cancel', (event) => {
            if (busy()) event.preventDefault();
        });
        dialog.querySelectorAll('[data-close-dialog]').forEach((button) =>
            button.addEventListener('click', () => {
                if (!busy()) dialog.close();
            }),
        );
        dialog.addEventListener('close', () => {
            if (trigger?.isConnected && trigger.getClientRects().length) trigger.focus();
        });
        const hash = location.hash.slice(1);
        const target = hash && document.getElementById(hash);
        if (target && dialog.contains(target) && !dialog.hasAttribute('data-wait-for-data')) {
            const tab = root.querySelector(
                `[data-workspace-tab="${dialog.id === 'new-series-dialog' ? 'recurring' : 'checkins'}"]`,
            );
            tab?.click();
            open(root.querySelector(`[data-open-dialog="${dialog.id}"]`));
        }
    }
}
