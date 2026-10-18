import vietnamese from '../../i18n/vi.json' with { type: 'json' };
export function t(
    message,
    locale = globalThis.window?.notesBootstrap?.preferences?.locale ||
        globalThis.document?.documentElement?.lang ||
        'en',
) {
    return locale === 'vi' ? vietnamese[message] || message : message;
}

export function statusLabel(status) {
    return t(
        {
            NotStarted: 'Not started',
            InProgress: 'In progress',
            Blocked: 'Blocked',
            Done: 'Completed',
            Completed: 'Completed',
            Active: 'Active',
        }[status] || status,
    );
}
