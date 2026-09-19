export class HttpError extends Error {
    constructor(status, payload = null, response = null) {
        super(payload?.message || 'The request failed.');
        this.name = 'HttpError';
        this.status = status;
        this.payload = payload;
        this.response = response;
        this.code = payload?.code || 'INTERNAL_ERROR';
        this.retryAfter = response?.headers?.get('Retry-After') || null;
    }
}

function csrfToken() {
    return (
        document.querySelector('meta[name="csrf-token"]')?.getAttribute('content') ||
        window.notesBootstrap?.csrf_token ||
        ''
    );
}

export async function request(path, options = {}) {
    const { method = 'GET', body, signal, timeout = 15000, ...rest } = options;
    const controller = new AbortController();
    const timeoutId = window.setTimeout(() => controller.abort(), timeout);
    const abortListener = signal ? () => controller.abort() : null;
    signal?.addEventListener('abort', abortListener);
    const headers = new Headers(rest.headers || {});
    headers.set('Accept', 'application/json');
    headers.set('X-Requested-With', 'XMLHttpRequest');
    headers.set('X-CSRF-TOKEN', csrfToken());

    const isFormData = typeof FormData !== 'undefined' && body instanceof FormData;
    if (body !== undefined && !isFormData && !headers.has('Content-Type')) {
        headers.set('Content-Type', 'application/json');
    }

    try {
        const response = await fetch(path, {
            ...rest,
            method,
            body:
                isFormData || typeof body === 'string'
                    ? body
                    : body === undefined
                      ? undefined
                      : JSON.stringify(body),
            credentials: 'same-origin',
            headers,
            signal: controller.signal,
        });
        const contentType = response.headers.get('content-type') || '';
        const payload = contentType.includes('application/json') ? await response.json() : null;
        if (!response.ok || (payload === null && response.status !== 204)) {
            throw new HttpError(response.status, payload, response);
        }
        return { response, payload };
    } catch (error) {
        if (error instanceof HttpError) throw error;
        throw new HttpError(0, {
            code: 'NETWORK_ERROR',
            message:
                error.name === 'AbortError'
                    ? 'The request timed out.'
                    : 'Unable to connect to the server.',
        });
    } finally {
        window.clearTimeout(timeoutId);
        signal?.removeEventListener('abort', abortListener);
    }
}

export const get = (path, options = {}) => request(path, options);
export const post = (path, body, options = {}) =>
    request(path, { ...options, method: 'POST', body });
export const patch = (path, body, options = {}) =>
    request(path, { ...options, method: 'PATCH', body });
export const put = (path, body, options = {}) => request(path, { ...options, method: 'PUT', body });
export const remove = (path, body, options = {}) =>
    request(path, { ...options, method: 'DELETE', body });

/**
 * XHR is intentionally limited to multipart uploads: fetch does not expose
 * upload progress, while the UI needs honest pending/progress/error states.
 * The same-origin credentials and CSRF headers are kept identical to request.
 */
export function upload(path, formData, { signal, timeout = 120000, onProgress = () => {} } = {}) {
    return new Promise((resolve, reject) => {
        const xhr = new XMLHttpRequest();
        let settled = false;
        const responseLike = () => ({
            status: xhr.status,
            headers: { get: (name) => xhr.getResponseHeader(name) },
        });
        const finish = (callback, value) => {
            if (settled) return;
            settled = true;
            signal?.removeEventListener('abort', abort);
            callback(value);
        };
        const abort = () => xhr.abort();
        const parse = () => {
            const contentType = xhr.getResponseHeader('Content-Type') || '';
            if (!contentType.includes('application/json')) return null;
            try {
                return JSON.parse(xhr.responseText);
            } catch {
                return null;
            }
        };

        xhr.open('POST', path, true);
        xhr.withCredentials = true;
        xhr.timeout = timeout;
        xhr.setRequestHeader('Accept', 'application/json');
        xhr.setRequestHeader('X-Requested-With', 'XMLHttpRequest');
        xhr.setRequestHeader('X-CSRF-TOKEN', csrfToken());
        xhr.upload.addEventListener('progress', (event) => {
            if (event.lengthComputable) onProgress(Math.round((event.loaded / event.total) * 100));
        });
        xhr.onload = () => {
            const payload = parse();
            if (xhr.status < 200 || xhr.status >= 300 || (payload === null && xhr.status !== 204)) {
                finish(reject, new HttpError(xhr.status, payload, responseLike()));
                return;
            }
            finish(resolve, { response: responseLike(), payload });
        };
        xhr.onerror = () =>
            finish(
                reject,
                new HttpError(0, {
                    code: 'NETWORK_ERROR',
                    message: 'Unable to connect to the server.',
                }),
            );
        xhr.ontimeout = () =>
            finish(
                reject,
                new HttpError(0, { code: 'NETWORK_ERROR', message: 'The request timed out.' }),
            );
        xhr.onabort = () =>
            finish(
                reject,
                new HttpError(0, { code: 'NETWORK_ERROR', message: 'The upload was canceled.' }),
            );
        signal?.addEventListener('abort', abort, { once: true });
        xhr.send(formData);
    });
}
