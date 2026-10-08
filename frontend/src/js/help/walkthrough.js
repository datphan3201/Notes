import { post } from '../lib/http.js';
import { RecoveryStore } from '../lib/recovery-store.js';
import { walkthroughSteps } from './walkthrough-content.js';
import placeholderImage from '../../images/walkthrough-placeholder.svg';

export function initWalkthrough({ ready = Promise.resolve() } = {}) {
    const dialog = document.querySelector('[data-walkthrough]');
    const trigger = document.querySelector('[data-open-walkthrough]');
    const bootstrap = window.notesBootstrap;
    if (!dialog || !trigger || !bootstrap?.user) return;

    const topic = dialog.querySelector('[data-walkthrough-topic]');
    const title = dialog.querySelector('[data-walkthrough-title]');
    const back = dialog.querySelector('[data-walkthrough-back]');
    const next = dialog.querySelector('[data-walkthrough-next]');
    const feedback = dialog.querySelector('[data-walkthrough-feedback]');
    const status = dialog.querySelector('[data-walkthrough-status]');
    let dismissed = bootstrap.walkthrough?.dismissed === true;
    let pending = false;
    let sessionEnded = false;
    let startupReady = false;
    let index = 0;
    let interacted = false;
    const markInteracted = () => {
        interacted = true;
    };
    document.addEventListener('pointerdown', markInteracted, true);
    document.addEventListener('keydown', markInteracted, true);

    const groups = new Map();
    for (const [stepIndex, step] of walkthroughSteps.entries()) {
        if (!groups.has(step.group)) {
            const group = document.createElement('optgroup');
            group.label = step.group;
            groups.set(step.group, group);
            topic.append(group);
        }
        const option = document.createElement('option');
        option.value = String(stepIndex);
        option.textContent = `${stepIndex + 1}. ${step.title}`;
        groups.get(step.group).append(option);
    }

    // Existing Notes dialogs use ARIA; planning dialogs use the native top layer.
    // Both take priority over help, as does the mobile navigation drawer.
    const hasOtherDialog = () =>
        [...document.querySelectorAll('dialog[open], [role="dialog"]')].some(
            (element) => element !== dialog && element.getClientRects().length > 0,
        ) || document.body.classList.contains('navigation-open');
    const syncTrigger = () => {
        trigger.disabled = !startupReady || sessionEnded || hasOtherDialog();
    };
    const observer = new MutationObserver(syncTrigger);
    observer.observe(document.body, {
        subtree: true,
        attributes: true,
        attributeFilter: ['class', 'hidden', 'open'],
    });
    syncTrigger();

    const render = (focusTitle = true) => {
        const step = walkthroughSteps[index];
        topic.value = String(index);
        title.textContent = step.title;
        dialog.querySelector('[data-walkthrough-intro]').textContent = step.intro;
        dialog.querySelector('[data-walkthrough-progress]').textContent =
            `Step ${index + 1} of ${walkthroughSteps.length} · ${step.group}`;
        const instructions = dialog.querySelector('[data-walkthrough-instructions]');
        instructions.replaceChildren(
            ...step.instructions.map((text) => {
                const item = document.createElement('li');
                item.textContent = text;
                return item;
            }),
        );
        const image = dialog.querySelector('[data-walkthrough-image]');
        image.src = step.image || placeholderImage;
        image.alt = step.image
            ? step.imageAlt || step.title
            : 'Placeholder illustration of a workspace';
        dialog.querySelector('[data-walkthrough-caption]').textContent = step.image
            ? step.imageCaption || step.title
            : 'Illustration placeholder · final UI images will be added later';
        back.disabled = index === 0;
        next.textContent = index === walkthroughSteps.length - 1 ? 'Finish' : 'Next';
        status.textContent = `Step ${index + 1} of ${walkthroughSteps.length}: ${step.title}`;
        dialog.querySelector('[data-walkthrough-content]').scrollTop = 0;
        if (focusTitle) title.focus({ preventScroll: true });
    };
    const open = () => {
        if (!startupReady || sessionEnded || dialog.open || hasOtherDialog()) return;
        index = 0;
        feedback.hidden = true;
        render(false);
        dialog.showModal();
        title.focus({ preventScroll: true });
    };
    const close = () => {
        dialog.close();
    };
    const dismiss = async () => {
        if (pending) return;
        if (dismissed) {
            close();
            return;
        }
        pending = true;
        feedback.hidden = true;
        dialog.setAttribute('aria-busy', 'true');
        const controls = [...dialog.querySelectorAll('button, select')];
        controls.forEach((control) => {
            control.disabled = true;
        });
        status.textContent = 'Remembering your choice…';
        try {
            const { payload } = await post('/api/v1/walkthrough/dismiss', {});
            if (payload?.data?.dismissed !== true)
                throw new Error('The choice was not acknowledged.');
            dismissed = true;
            bootstrap.walkthrough = { dismissed: true };
            close();
        } catch {
            dialog.querySelector('[data-walkthrough-error]').textContent =
                'Could not remember your choice. Retry Close, Skip, or Finish, or close for now. The guide may open again until your choice is saved.';
            feedback.hidden = false;
            status.textContent = '';
        } finally {
            pending = false;
            dialog.setAttribute('aria-busy', 'false');
            controls.forEach((control) => {
                control.disabled = false;
            });
            back.disabled = index === 0;
        }
    };
    trigger.addEventListener('click', open);
    dialog
        .querySelectorAll('[data-walkthrough-dismiss]')
        .forEach((control) => control.addEventListener('click', dismiss));
    dialog.querySelector('[data-walkthrough-close-now]').addEventListener('click', close);
    dialog.addEventListener('cancel', (event) => {
        event.preventDefault();
        dismiss();
    });
    dialog.addEventListener('keydown', (event) => {
        if (event.key !== 'Tab') return;
        const controls = [
            ...dialog.querySelectorAll('button:not(:disabled), select:not(:disabled)'),
        ].filter((control) => control.getClientRects().length);
        const first = controls[0];
        const last = controls.at(-1);
        if (!first) {
            event.preventDefault();
            title.focus({ preventScroll: true });
        } else if (
            event.shiftKey &&
            (document.activeElement === first || !controls.includes(document.activeElement))
        ) {
            event.preventDefault();
            last.focus();
        } else if (!event.shiftKey && document.activeElement === last) {
            event.preventDefault();
            first.focus();
        }
    });
    dialog.addEventListener('close', () => {
        if (!sessionEnded) trigger.focus({ preventScroll: true });
    });
    back.addEventListener('click', () => {
        if (index > 0) {
            index--;
            render();
        }
    });
    next.addEventListener('click', () => {
        if (index === walkthroughSteps.length - 1) dismiss();
        else {
            index++;
            render();
        }
    });
    topic.addEventListener('change', () => {
        index = Number(topic.value);
        render(false);
    });
    document.addEventListener('notes:session-changed', () => {
        sessionEnded = true;
        close();
        observer.disconnect();
        trigger.disabled = true;
    });

    // Wait for startup recovery. Never place an introduction over ongoing work.
    Promise.resolve(ready)
        .catch(() => {})
        .then(() => {
            startupReady = true;
            syncTrigger();
            document.removeEventListener('pointerdown', markInteracted, true);
            document.removeEventListener('keydown', markInteracted, true);
            if (bootstrap.walkthrough?.dismissed !== false || interacted || sessionEnded) return;
            const hashTarget = location.hash && document.getElementById(location.hash.slice(1));
            if (hashTarget?.closest('[data-workspace-dialog]')) return;
            if (new RecoveryStore({ userId: bootstrap.user.id }).read()) return;
            open();
        });
}
