import { get, patch, post } from '../lib/http.js';
import { t } from '../lib/i18n.js';

const element = (tag, className, text) => {
    const node = document.createElement(tag);
    if (className) node.className = className;
    if (text !== undefined) node.textContent = text;
    return node;
};

export function initAdminPage(root) {
    const status = root.querySelector('[data-admin-status]');
    const reportFilter = root.querySelector('[data-admin-report-status]');
    const reportList = root.querySelector('[data-admin-reports]');
    const userReportFilter = root.querySelector('[data-admin-user-report-status]');
    const userReportList = root.querySelector('[data-admin-user-reports]');
    const userSearch = root.querySelector('[data-admin-user-search]');
    const userList = root.querySelector('[data-admin-users]');
    const settings = root.querySelector('[data-admin-settings]');
    const fail = (error) => {
        status.textContent = Object.values(error.payload?.errors || {})[0]?.[0] || error.message;
    };

    const lockButton = (account, locked) => {
        const button = element(
            'button',
            'button button-quiet',
            locked ? t('Unlock') : t('Lock account'),
        );
        button.type = 'button';
        button.addEventListener('click', async () => {
            const reason = locked
                ? null
                : window.prompt(t('Reason for locking (shown to administrators)'), '');
            if (!locked && reason === null) return;
            try {
                await post(
                    `/api/v1/admin/users/${account.id}/${locked ? 'unlock' : 'lock'}`,
                    locked ? {} : { reason },
                );
                status.textContent = locked ? t('Account unlocked.') : t('Account locked.');
                loadReports();
                loadUserReports();
                loadUsers();
            } catch (error) {
                fail(error);
            }
        });
        return button;
    };

    const loadReports = async () => {
        try {
            const reports = (await get(`/api/v1/admin/reports?status=${reportFilter.value}`))
                .payload.data;
            reportList.replaceChildren();
            if (!reports.length) reportList.textContent = t('No reports.');
            for (const report of reports) {
                const card = element('article', 'planning-list-item admin-report');
                const copy = element('div');
                copy.append(
                    element('strong', '', report.note.title),
                    element(
                        'small',
                        '',
                        `${t('Reported by')} ${report.reporter.display_name} (${report.reporter.email}) · ${t('Owner')} ${report.owner.display_name} (${report.owner.email}) · ${new Date(report.created_at).toLocaleString()}`,
                    ),
                    element('p', '', `${t('Reason')}: ${report.reason}`),
                    element('blockquote', 'admin-excerpt', report.note.excerpt),
                );
                if (report.response)
                    copy.append(
                        element('p', 'subtle-copy', `${t('Response')}: ${report.response}`),
                    );
                const actions = element('div', 'action-row');
                if (report.status === 'open') {
                    for (const outcome of ['resolved', 'dismissed']) {
                        const button = element(
                            'button',
                            outcome === 'resolved'
                                ? 'button button-primary'
                                : 'button button-quiet',
                            outcome === 'resolved' ? t('Resolve') : t('Dismiss'),
                        );
                        button.type = 'button';
                        button.addEventListener('click', async () => {
                            const response = window.prompt(t('Optional reply to the reporter'), '');
                            if (response === null) return;
                            try {
                                await post(`/api/v1/admin/reports/${report.id}/resolve`, {
                                    status: outcome,
                                    response,
                                });
                                loadReports();
                            } catch (error) {
                                fail(error);
                            }
                        });
                        actions.append(button);
                    }
                } else {
                    actions.append(
                        element(
                            'span',
                            'context-chip',
                            t(report.status === 'resolved' ? 'Resolved' : 'Dismissed'),
                        ),
                    );
                }
                actions.append(lockButton(report.owner, report.owner.locked));
                card.append(copy, actions);
                reportList.append(card);
            }
        } catch (error) {
            fail(error);
        }
    };

    const resolveButtons = (path, reload) =>
        ['resolved', 'dismissed'].map((outcome) => {
            const button = element(
                'button',
                outcome === 'resolved' ? 'button button-primary' : 'button button-quiet',
                outcome === 'resolved' ? t('Resolve') : t('Dismiss'),
            );
            button.type = 'button';
            button.addEventListener('click', async () => {
                const response = window.prompt(t('Optional reply to the reporter'), '');
                if (response === null) return;
                try {
                    await post(path, { status: outcome, response });
                    reload();
                } catch (error) {
                    fail(error);
                }
            });
            return button;
        });

    // Reports about people, filed from Settings; evidence images open full size.
    const loadUserReports = async () => {
        try {
            const reports = (
                await get(`/api/v1/admin/user-reports?status=${userReportFilter.value}`)
            ).payload.data;
            userReportList.replaceChildren();
            if (!reports.length) userReportList.textContent = t('No reports.');
            for (const report of reports) {
                const card = element('article', 'planning-list-item admin-report');
                const copy = element('div');
                const target = report.target
                    ? `${report.target.display_name} (${report.target.email})${report.target.locked ? ` · ${t('Locked')}` : ''}`
                    : `${report.reported_email} · ${t('No account with this email')}`;
                copy.append(
                    element('strong', '', target),
                    element(
                        'small',
                        '',
                        `${t('Reported by')} ${report.reporter.display_name} (${report.reporter.email}) · ${new Date(report.created_at).toLocaleString()}`,
                    ),
                    element('p', '', `${t('Reason')}: ${report.reason}`),
                );
                if (report.evidence.length) {
                    const gallery = element('div', 'report-evidence-previews');
                    report.evidence.forEach((url, index) => {
                        const link = element('a');
                        link.href = url;
                        link.target = '_blank';
                        link.rel = 'noopener';
                        link.append(
                            Object.assign(document.createElement('img'), {
                                src: url,
                                alt: `${t('Evidence')} ${index + 1}`,
                                loading: 'lazy',
                            }),
                        );
                        gallery.append(link);
                    });
                    copy.append(gallery);
                }
                if (report.response)
                    copy.append(
                        element('p', 'subtle-copy', `${t('Response')}: ${report.response}`),
                    );
                const actions = element('div', 'action-row');
                if (report.status === 'open') {
                    actions.append(
                        ...resolveButtons(
                            `/api/v1/admin/user-reports/${report.id}/resolve`,
                            loadUserReports,
                        ),
                    );
                } else {
                    actions.append(
                        element(
                            'span',
                            'context-chip',
                            t(report.status === 'resolved' ? 'Resolved' : 'Dismissed'),
                        ),
                    );
                }
                if (report.target) actions.append(lockButton(report.target, report.target.locked));
                card.append(copy, actions);
                userReportList.append(card);
            }
        } catch (error) {
            fail(error);
        }
    };

    let searchTimer = null;
    const loadUsers = async () => {
        try {
            const users = (
                await get(`/api/v1/admin/users?q=${encodeURIComponent(userSearch.value)}`)
            ).payload.data;
            userList.replaceChildren();
            for (const account of users) {
                const row = element('article', 'planning-list-item');
                const copy = element('div');
                copy.append(
                    element(
                        'strong',
                        '',
                        `${account.display_name}${account.role === 'admin' ? ` · ${t('Admin')}` : ''}`,
                    ),
                    element(
                        'small',
                        '',
                        `${account.email}${account.locked ? ` · ${t('Locked')}${account.locked_reason ? `: ${account.locked_reason}` : ''}` : ''}`,
                    ),
                );
                row.append(copy);
                if (String(account.id) !== String(window.notesBootstrap.user.id))
                    row.append(lockButton(account, account.locked));
                userList.append(row);
            }
        } catch (error) {
            fail(error);
        }
    };

    reportFilter.addEventListener('change', loadReports);
    userReportFilter.addEventListener('change', loadUserReports);
    userSearch.addEventListener('input', () => {
        window.clearTimeout(searchTimer);
        searchTimer = window.setTimeout(loadUsers, 250);
    });
    settings.addEventListener('submit', async (event) => {
        event.preventDefault();
        try {
            await patch('/api/v1/admin/settings', {
                history_limit: Number(settings.elements.history_limit.value),
            });
            status.textContent = t('Saved.');
        } catch (error) {
            fail(error);
        }
    });
    get('/api/v1/admin/settings')
        .then((response) => {
            settings.elements.history_limit.value = String(response.payload.data.history_limit);
        })
        .catch(fail);
    loadReports();
    loadUserReports();
    loadUsers();
}
