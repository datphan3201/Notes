import { get, post } from '../lib/http.js';

export function initAIPage(root) {
    let action = null;
    const proposal = root.querySelector('[data-ai-proposal]');
    const controls = root.querySelector('[data-ai-actions]');
    const errorOutput = root.querySelector('[data-planning-error]');
    const error = (reason) => {
        errorOutput.textContent =
            Object.values(reason.payload?.errors || {}).flat()[0] || reason.message;
        errorOutput.classList.remove('is-hidden');
    };
    const contextContainer = root.querySelector('[data-ai-context]');
    const contextSummary = root.querySelector('[data-ai-context-summary]');
    const selectedContext = () =>
        [...contextContainer.querySelectorAll('input:checked')].map((input) => ({
            type: input.dataset.type,
            id: input.value,
        }));
    const updateSummary = () => {
        const labels = [...contextContainer.querySelectorAll('input:checked')].map(
            (input) => input.dataset.label,
        );
        contextSummary.textContent = labels.length
            ? `${labels.length} selected items will be sent: ${labels.join(', ')}`
            : 'No context selected; AI will receive only your instructions.';
    };
    const loadContext = async () => {
        try {
            const sources = await Promise.all(
                [
                    ['area', 'Area', get('/api/v1/areas')],
                    ['goal', 'Goal', get('/api/v1/goals')],
                    ['milestone', 'Milestone', get('/api/v1/milestones')],
                    ['task', 'Task', get('/api/v1/tasks')],
                    ['review', 'Review', get('/api/v1/reviews')],
                ].map(async ([type, heading, promise]) => [
                    type,
                    heading,
                    (await promise).payload.data,
                ]),
            );
            contextContainer.replaceChildren();
            for (const [type, heading, items] of sources) {
                if (!items.length) continue;
                const group = document.createElement('fieldset');
                group.className = 'context-group';
                const legend = document.createElement('legend');
                legend.textContent = heading;
                group.append(legend);
                for (const item of items) {
                    const labelText = item.name || `${item.kind} ${item.period_start}`;
                    const label = document.createElement('label');
                    label.className = 'check-row';
                    const input = document.createElement('input');
                    input.type = 'checkbox';
                    input.value = item.id;
                    input.dataset.type = type;
                    input.dataset.label = labelText;
                    input.addEventListener('change', updateSummary);
                    const text = document.createElement('span');
                    text.textContent = labelText;
                    label.append(input, text);
                    group.append(label);
                }
                contextContainer.append(group);
            }
            if (!contextContainer.children.length)
                contextContainer.textContent = 'No context is available to select.';
            updateSummary();
        } catch (reason) {
            contextContainer.textContent = 'Unable to load context.';
            error(reason);
        }
    };
    const render = (value) => {
        action = value;
        proposal.replaceChildren();
        const summary = document.createElement('p');
        summary.textContent = value.proposal.summary;
        proposal.append(summary);
        const list = document.createElement('ol');
        for (const operation of value.proposal.operations) {
            const item = document.createElement('li');
            item.textContent = `${operation.op}: ${operation.fields?.name || operation.local_id || ''}`;
            list.append(item);
        }
        proposal.append(list);
        controls.classList.toggle('is-hidden', value.status !== 'Proposed');
    };
    root.querySelector('[data-ai-form]').addEventListener('submit', async (event) => {
        event.preventDefault();
        const form = event.currentTarget;
        const data = new FormData(form);
        const button = form.querySelector('button');
        button.disabled = true;
        try {
            const response = await post('/api/v1/ai/actions', {
                capability: data.get('capability'),
                instruction: data.get('instruction'),
                context: selectedContext(),
                consent: data.get('consent') === 'on',
            });
            render(response.payload.data);
        } catch (reason) {
            error(reason);
        } finally {
            button.disabled = false;
        }
    });
    root.querySelector('[data-ai-apply]').addEventListener('click', async (event) => {
        const button = event.currentTarget;
        button.disabled = true;
        try {
            const response = await post(`/api/v1/ai/actions/${action.id}/apply`, {
                base_version: action.version,
                proposal_hash: action.proposal_hash,
            });
            render(response.payload.data);
        } catch (reason) {
            error(reason);
        } finally {
            button.disabled = false;
        }
    });
    root.querySelector('[data-ai-reject]').addEventListener('click', async (event) => {
        const button = event.currentTarget;
        button.disabled = true;
        try {
            const response = await post(`/api/v1/ai/actions/${action.id}/reject`, {
                base_version: action.version,
            });
            render(response.payload.data);
        } catch (reason) {
            error(reason);
        } finally {
            button.disabled = false;
        }
    });
    loadContext();
}
