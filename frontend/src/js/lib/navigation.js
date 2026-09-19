// The shell owns navigation on every page; individual features keep their own
// draft/leave guards. Mobile-only focus and inert state must never leak to desktop.
export function initNavigation() {
    const sidebar = document.querySelector('#app-sidebar');
    const trigger = document.querySelector('[data-open-sidebar]');
    const body = document.querySelector('[data-app-body]');
    const scrim = document.querySelector('.sidebar-scrim');
    if (!sidebar || !trigger || !body) return;

    const mobile = window.matchMedia('(max-width: 800px)');
    let open = false;
    const setOpen = (next, restoreFocus = true) => {
        open = next && mobile.matches;
        sidebar.classList.toggle('is-open', open);
        scrim?.classList.toggle('is-visible', open);
        document.body.classList.toggle('navigation-open', open);
        trigger.setAttribute('aria-expanded', String(open));
        body.inert = open;
        sidebar.inert = mobile.matches && !open;
        if (open) sidebar.querySelector('[data-close-sidebar]').focus();
        else if (restoreFocus && mobile.matches) trigger.focus();
    };
    trigger.addEventListener('click', () => setOpen(!open));
    document.querySelectorAll('[data-close-sidebar]').forEach((element) => {
        element.addEventListener('click', () => setOpen(false));
    });
    document.addEventListener('keydown', (event) => {
        if (!open) return;
        if (event.key === 'Escape') {
            event.preventDefault();
            setOpen(false);
        }
        if (event.key !== 'Tab') return;
        const controls = [...sidebar.querySelectorAll('a[href], button:not(:disabled)')].filter(
            (element) => element.getClientRects().length,
        );
        const first = controls[0];
        const last = controls.at(-1);
        if (
            event.shiftKey &&
            (document.activeElement === first || document.activeElement === sidebar)
        ) {
            event.preventDefault();
            last.focus();
        } else if (!event.shiftKey && document.activeElement === last) {
            event.preventDefault();
            first.focus();
        }
    });
    // A draft guard can cancel a link; dismissing the drawer restores the page
    // before that feature shows its confirmation dialog.
    sidebar.addEventListener('click', (event) => {
        if (open && event.target.closest('a[href]')) setOpen(false);
    });
    sidebar.addEventListener('submit', () => {
        if (open) setOpen(false);
    });
    mobile.addEventListener('change', () => setOpen(false, false));
    setOpen(false, false);
}
