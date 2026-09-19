import test from 'node:test';
import assert from 'node:assert/strict';
import { DebouncedAction, LatestRequest } from '../../src/js/lib/read-coordinator.js';

class FakeController {
    signal = { aborted: false };

    abort() {
        this.signal.aborted = true;
    }
}

test('Q01 only the latest read ticket may update the page', () => {
    const requests = new LatestRequest({ controllerFactory: () => new FakeController() });
    const oldSearch = requests.begin();
    const newSearch = requests.begin();

    assert.equal(oldSearch.signal.aborted, true);
    assert.equal(requests.isCurrent(oldSearch), false);
    assert.equal(requests.isCurrent(newSearch), true);
    assert.equal(requests.shouldIgnore(oldSearch, { status: 500 }), true);
});

test('Q02 a label or page action can cancel a pending search debounce', () => {
    let callback = null;
    let cancelled = null;
    let fired = false;
    const debounce = new DebouncedAction({
        delay: 300,
        setTimeout: (next) => {
            callback = next;
            return 7;
        },
        clearTimeout: (timer) => {
            cancelled = timer;
            callback = null;
        },
    });

    debounce.schedule(() => {
        fired = true;
    });
    debounce.cancel();

    assert.equal(cancelled, 7);
    assert.equal(callback, null);
    assert.equal(fired, false);
});

test('Q03 a current read failure remains visible while aborted failures are ignored', () => {
    const requests = new LatestRequest({ controllerFactory: () => new FakeController() });
    const current = requests.begin();
    assert.equal(
        requests.shouldIgnore(current, {
            status: 503,
            code: 'SERVICE_UNAVAILABLE',
        }),
        false,
    );

    current.signal.aborted = true;
    assert.equal(
        requests.shouldIgnore(current, {
            status: 0,
            code: 'NETWORK_ERROR',
        }),
        true,
    );
});
