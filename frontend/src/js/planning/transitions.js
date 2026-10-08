import { post } from '../lib/http.js';

// Only explicit server requests for acknowledgement can trigger another
// submission. Network failures and version conflicts are never retried here.
export async function transitionEntity(
    type,
    entity,
    action,
    { send = post, confirm = (message) => window.confirm(message) } = {},
) {
    const body = { base_version: entity.version };
    const path = `/api/v1/${type}s/${encodeURIComponent(entity.id)}/${action}`;
    for (let attempt = 0; attempt < 3; attempt += 1) {
        try {
            return await send(path, body);
        } catch (error) {
            if (error.status !== 422) throw error;
            const ancestors = error.payload?.ancestors;
            if (error.code === 'ANCESTOR_REOPEN_REQUIRED' && Array.isArray(ancestors)) {
                if (
                    !confirm(
                        `Reopen “${entity.name}” and these completed goals?\n${ancestors.map((goal) => `• ${goal.name}`).join('\n')}`,
                    )
                )
                    return null;
                body.acknowledge_ancestor_reopen = true;
            } else if (error.payload?.errors?.acknowledge_unchecked_items) {
                if (!confirm(`Complete “${entity.name}” with unfinished checklist items?`))
                    return null;
                body.acknowledge_unchecked_items = true;
            } else if (error.payload?.errors?.acknowledge_open_tasks) {
                if (
                    !confirm(
                        `Complete “${entity.name}” with unfinished tasks? Their status will stay unchanged.`,
                    )
                )
                    return null;
                body.acknowledge_open_tasks = true;
            } else {
                throw error;
            }
        }
    }
    throw new Error('The operation needs another confirmation. Refresh and try again.');
}
