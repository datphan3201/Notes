import { get, upload } from '../lib/http.js';
import { t } from '../lib/i18n.js';

export const MAX_EVIDENCE = 3;
const MAX_IMAGE_BYTES = 5 * 1024 * 1024;
const IMAGE_TYPES = ['image/jpeg', 'image/png', 'image/webp'];

/** Client-side check mirroring the server rules; the server still validates. */
export function evidenceProblem(files) {
    if (files.length > MAX_EVIDENCE) return t('Attach at most 3 images.');
    for (const file of files) {
        if (!IMAGE_TYPES.includes(file.type))
            return t('Only JPEG, PNG or WebP images are allowed.');
        if (file.size > MAX_IMAGE_BYTES) return t('Each image can be at most 5 MB.');
    }
    return '';
}

const STATUS_LABELS = {
    open: 'Waiting for review',
    resolved: 'Action taken',
    dismissed: 'Reviewed, no action',
};

export function initUserReports(root) {
    const form = root.querySelector('[data-user-report-form]');
    const fileInput = root.querySelector('[data-user-report-files]');
    const previews = root.querySelector('[data-user-report-previews]');
    const status = root.querySelector('[data-user-report-status]');
    const list = root.querySelector('[data-user-report-list]');
    let previewUrls = [];

    const showPreviews = () => {
        previewUrls.forEach((url) => URL.revokeObjectURL(url));
        previewUrls = [];
        previews.replaceChildren();
        for (const file of fileInput.files) {
            if (!IMAGE_TYPES.includes(file.type)) continue;
            const url = URL.createObjectURL(file);
            previewUrls.push(url);
            previews.append(
                Object.assign(document.createElement('img'), { src: url, alt: file.name }),
            );
        }
    };

    const loadReports = async () => {
        try {
            const reports = (await get('/api/v1/user-reports')).payload.data;
            list.replaceChildren();
            if (!reports.length) {
                list.textContent = t('You have not reported anyone.');
                return;
            }
            for (const report of reports) {
                const item = document.createElement('article');
                item.className = 'planning-list-item';
                const copy = document.createElement('div');
                const meta = `${new Date(report.created_at).toLocaleString()}${report.evidence_count ? ` · ${t(':count images').replace(':count', report.evidence_count)}` : ''}`;
                copy.append(
                    Object.assign(document.createElement('strong'), { textContent: report.email }),
                    Object.assign(document.createElement('small'), { textContent: meta }),
                    Object.assign(document.createElement('p'), { textContent: report.reason }),
                );
                if (report.response) {
                    copy.append(
                        Object.assign(document.createElement('p'), {
                            className: 'subtle-copy',
                            textContent: `${t('Administrator reply')}: ${report.response}`,
                        }),
                    );
                }
                item.append(
                    copy,
                    Object.assign(document.createElement('span'), {
                        className: 'context-chip',
                        textContent: t(STATUS_LABELS[report.status] || report.status),
                    }),
                );
                list.append(item);
            }
        } catch (error) {
            list.textContent = error.message;
        }
    };

    fileInput.addEventListener('change', () => {
        status.textContent = evidenceProblem([...fileInput.files]);
        showPreviews();
    });

    form.addEventListener('submit', async (event) => {
        event.preventDefault();
        const files = [...fileInput.files];
        const problem = evidenceProblem(files);
        if (problem) {
            status.textContent = problem;
            return;
        }
        const data = new FormData();
        data.append('email', form.elements.email.value.trim());
        data.append('reason', form.elements.reason.value.trim());
        files.forEach((file, index) => data.append(`evidence_${index + 1}`, file));
        const submit = form.querySelector('[type="submit"]');
        submit.disabled = true;
        status.textContent = t('Sending…');
        try {
            await upload('/api/v1/user-reports', data);
            form.reset();
            showPreviews();
            status.textContent = t('Thank you. An administrator will review your report.');
            loadReports();
        } catch (error) {
            status.textContent = t(
                Object.values(error.payload?.errors || {}).flat()[0] || error.message,
            );
        } finally {
            submit.disabled = false;
        }
    });

    loadReports();
}
