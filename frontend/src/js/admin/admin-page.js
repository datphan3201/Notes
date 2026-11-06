import { get, patch, post, remove } from '../lib/http.js';
import { t } from '../lib/i18n.js';

const element = (tag, className, text) => {
    const node = document.createElement(tag);
    if (className) node.className = className;
    if (text !== undefined) node.textContent = text;
    return node;
};

// Administrator activity entries, by recorded action.
const ACTIVITY_LABELS = {
    'account.lock': 'Locked an account',
    'account.unlock': 'Unlocked an account',
    'account.delete': 'Deleted an account',
    'account.role': 'Changed an account role',
    'account.warn': 'Warned an account',
    'note.revoke_shares': 'Stopped sharing a note',
    'report.resolved': 'Resolved a note report',
    'report.dismissed': 'Dismissed a note report',
    'user_report.resolved': 'Resolved a user report',
    'user_report.dismissed': 'Dismissed a user report',
    'settings.history_limit': 'Changed the history limit',
    'settings.registration_mode': 'Changed who can register',
    'registration.invite': 'Invited an email',
    'registration.uninvite': 'Removed an invitation',
};

const ACTION_LABELS = {
    revoke_shares: 'Sharing stopped',
    lock_owner: 'Owner locked',
    lock_account: 'Account locked',
    warn_owner: 'Owner warned',
    warn_account: 'Account warned',
};

/** Chips describing a handled report: its outcome and the actions actually taken. */
function outcomeChips(report) {
    const row = element('div', 'admin-outcome');
    row.append(
        element('span', 'context-chip', t(report.status === 'resolved' ? 'Resolved' : 'Dismissed')),
    );
    for (const action of report.actions || [])
        row.append(element('span', 'context-chip', t(ACTION_LABELS[action] || action)));
    return row;
}

/**
 * Resolve form for an open report: the admin picks the actions to take, writes an optional
 * reply and resolves (acting) or dismisses (no action). The server rejects a resolution
 * without an action unless the account is already locked.
 */
function resolutionForm(choices, onSubmit) {
    const form = element('form', 'admin-resolution');
    if (choices.length) {
        const fieldset = element('fieldset');
        fieldset.append(element('legend', '', t('Action')));
        for (const [value, label, disabled] of choices) {
            const option = element('label', 'check-row');
            const box = element('input');
            box.type = 'checkbox';
            box.name = 'actions';
            box.value = value;
            box.disabled = disabled;
            option.append(box, element('span', '', t(label)));
            fieldset.append(option);
        }
        form.append(fieldset);
    }
    const reply = element('textarea');
    reply.name = 'response';
    reply.rows = 2;
    reply.maxLength = 1000;
    reply.placeholder = t('Optional reply to the reporter');
    reply.setAttribute('aria-label', t('Optional reply to the reporter'));
    const buttons = element('div', 'action-row');
    for (const [status, label, className] of [
        ['dismissed', 'Dismiss', 'button button-quiet'],
        ['resolved', 'Resolve', 'button button-primary'],
    ]) {
        const button = element('button', className, t(label));
        button.type = 'submit';
        button.value = status;
        buttons.append(button);
    }
    form.append(reply, buttons);
    form.addEventListener('submit', (event) => {
        event.preventDefault();
        const status = event.submitter?.value || 'resolved';
        const actions = [...form.querySelectorAll('input[name="actions"]:checked')].map(
            (box) => box.value,
        );
        onSubmit({ status, response: reply.value, actions: status === 'dismissed' ? [] : actions });
    });
    return form;
}

export function initAdminPage(root) {
    const status = root.querySelector('[data-admin-status]');
    const reportFilter = root.querySelector('[data-admin-report-status]');
    const reportList = root.querySelector('[data-admin-reports]');
    const userReportFilter = root.querySelector('[data-admin-user-report-status]');
    const userReportList = root.querySelector('[data-admin-user-reports]');
    const userSearch = root.querySelector('[data-admin-user-search]');
    const userList = root.querySelector('[data-admin-users]');
    const settings = root.querySelector('[data-admin-settings]');
    const registration = root.querySelector('[data-admin-registration]');
    const inviteForm = root.querySelector('[data-admin-invite-form]');
    const inviteList = root.querySelector('[data-admin-invites]');
    const activity = root.querySelector('[data-admin-activity]');
    const fail = (error) => {
        status.textContent = t(Object.values(error.payload?.errors || {})[0]?.[0] || error.message);
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
                reloadAll();
            } catch (error) {
                fail(error);
            }
        });
        return button;
    };

    // Deleting is for good, so the administrator types the account's email to confirm.
    const deleteButton = (account) => {
        const button = element('button', 'button button-danger-quiet', t('Delete account'));
        button.type = 'button';
        button.addEventListener('click', async () => {
            const typed = window.prompt(
                t(
                    'This deletes :email and all of their data for good. Type the email to confirm.',
                ).replace(':email', account.email),
                '',
            );
            if (typed === null) return;
            try {
                await remove(`/api/v1/admin/users/${account.id}`, { confirm_email: typed });
                status.textContent = t('Account deleted.');
                reloadAll();
            } catch (error) {
                fail(error);
            }
        });
        return button;
    };

    const resolve = (path, reload) => async (body) => {
        try {
            await post(path, body);
            status.textContent =
                body.status === 'resolved' ? t('Report resolved.') : t('Report dismissed.');
            reload();
            loadUsers();
            loadActivity();
        } catch (error) {
            fail(error);
        }
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
                        `${t('Reported by')} ${report.reporter.display_name} (${report.reporter.email}) · ${t('Owner')} ${report.owner.display_name} (${report.owner.email})${report.owner.locked ? ` · ${t('Locked')}` : ''} · ${new Date(report.created_at).toLocaleString()}`,
                    ),
                    element('p', '', `${t('Reason')}: ${report.reason}`),
                    element('blockquote', 'admin-excerpt', report.note.excerpt),
                );
                if (report.response)
                    copy.append(
                        element('p', 'subtle-copy', `${t('Response')}: ${report.response}`),
                    );
                if (report.status === 'open')
                    copy.append(
                        resolutionForm(
                            [
                                ['revoke_shares', 'Stop sharing this note with everyone', false],
                                ['warn_owner', 'Warn the owner', report.owner.locked],
                                [
                                    'lock_owner',
                                    report.owner.locked
                                        ? 'Owner is already locked'
                                        : 'Lock the owner’s account',
                                    report.owner.locked,
                                ],
                            ],
                            resolve(`/api/v1/admin/reports/${report.id}/resolve`, loadReports),
                        ),
                    );
                else copy.append(outcomeChips(report));
                card.append(copy);
                reportList.append(card);
            }
        } catch (error) {
            fail(error);
        }
    };

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
                if (report.status === 'open')
                    copy.append(
                        resolutionForm(
                            report.target
                                ? [
                                      ['warn_account', 'Warn this account', report.target.locked],
                                      [
                                          'lock_account',
                                          report.target.locked
                                              ? 'Account is already locked'
                                              : 'Lock this account',
                                          report.target.locked,
                                      ],
                                  ]
                                : [],
                            resolve(
                                `/api/v1/admin/user-reports/${report.id}/resolve`,
                                loadUserReports,
                            ),
                        ),
                    );
                else copy.append(outcomeChips(report));
                card.append(copy);
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
                const lockedFacts = account.locked
                    ? [
                          t('Locked'),
                          account.locked_by ? `${t('by')} ${account.locked_by}` : '',
                          account.locked_reason ? `“${account.locked_reason}”` : '',
                      ]
                          .filter(Boolean)
                          .join(' ')
                    : '';
                copy.append(
                    element('strong', '', account.display_name),
                    element('small', '', [account.email, lockedFacts].filter(Boolean).join(' · ')),
                );
                row.append(copy);
                // Administrators are granted and removed only with the server console.
                if (account.role === 'admin')
                    row.append(
                        element('span', 'context-chip', t('Admin · managed in the server console')),
                    );
                else {
                    const actions = element('div', 'action-row');
                    actions.append(lockButton(account, account.locked), deleteButton(account));
                    row.append(actions);
                }
                userList.append(row);
            }
        } catch (error) {
            fail(error);
        }
    };

    const renderInvites = (invites) => {
        inviteList.replaceChildren();
        if (!invites.length) inviteList.textContent = t('No invitations yet.');
        for (const invite of invites) {
            const row = element('article', 'planning-list-item');
            const copy = element('div');
            copy.append(
                element('strong', '', invite.email),
                element(
                    'small',
                    '',
                    invite.used
                        ? `${t('Account created')}${invite.used_by ? ` · ${invite.used_by}` : ''}`
                        : t('Waiting for sign-up'),
                ),
            );
            row.append(copy);
            if (!invite.used) {
                const button = element('button', 'button button-quiet', t('Remove'));
                button.type = 'button';
                button.setAttribute('aria-label', `${t('Remove invitation')}: ${invite.email}`);
                button.addEventListener('click', async () => {
                    try {
                        const response = await remove('/api/v1/admin/registration-invites', {
                            email: invite.email,
                        });
                        renderInvites(response.payload.data);
                        loadActivity();
                    } catch (error) {
                        fail(error);
                    }
                });
                row.append(button);
            }
            inviteList.append(row);
        }
    };
    const loadInvites = async () => {
        try {
            renderInvites((await get('/api/v1/admin/registration-invites')).payload.data);
        } catch (error) {
            fail(error);
        }
    };

    const loadActivity = async () => {
        try {
            const actions = (await get('/api/v1/admin/actions')).payload.data;
            activity.replaceChildren();
            if (!actions.length)
                activity.append(element('li', 'subtle-copy', t('No activity yet.')));
            for (const action of actions) {
                const item = element('li');
                const when = element(
                    'time',
                    'subtle-copy',
                    new Date(action.created_at).toLocaleString(),
                );
                when.dateTime = action.created_at;
                item.append(
                    when,
                    element(
                        'strong',
                        '',
                        action.actor ? action.actor.display_name : t('Server console'),
                    ),
                    element(
                        'span',
                        '',
                        `${t(ACTIVITY_LABELS[action.action] || action.action)} · ${action.summary}`,
                    ),
                );
                activity.append(item);
            }
        } catch (error) {
            fail(error);
        }
    };

    const reloadAll = () => {
        loadReports();
        loadUserReports();
        loadUsers();
        loadActivity();
    };

    const saveSettings = (body) => async (event) => {
        event.preventDefault();
        try {
            const saved = (await patch('/api/v1/admin/settings', body())).payload.data;
            settings.elements.history_limit.value = String(saved.history_limit);
            registration.elements.registration_mode.value = saved.registration_mode;
            status.textContent = t('Saved.');
            loadActivity();
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
    settings.addEventListener(
        'submit',
        saveSettings(() => ({ history_limit: Number(settings.elements.history_limit.value) })),
    );
    registration.addEventListener(
        'submit',
        saveSettings(() => ({ registration_mode: registration.elements.registration_mode.value })),
    );
    inviteForm.addEventListener('submit', async (event) => {
        event.preventDefault();
        try {
            const response = await post('/api/v1/admin/registration-invites', {
                email: inviteForm.elements.email.value,
            });
            renderInvites(response.payload.data);
            inviteForm.reset();
            status.textContent = t('Invitation added.');
            loadActivity();
        } catch (error) {
            fail(error);
        }
    });
    get('/api/v1/admin/settings')
        .then((response) => {
            settings.elements.history_limit.value = String(response.payload.data.history_limit);
            registration.elements.registration_mode.value = response.payload.data.registration_mode;
        })
        .catch(fail);
    reloadAll();
    loadInvites();
}
