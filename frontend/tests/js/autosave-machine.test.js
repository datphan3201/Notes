import test from 'node:test';
import assert from 'node:assert/strict';
import { AutosaveMachine } from '../../src/js/notes/autosave-machine.js';

class FakeClock {
    constructor() {
        this.time = 0;
        this.nextId = 1;
        this.timers = new Map();
    }

    now = () => this.time;

    setTimeout = (callback, delay) => {
        const id = this.nextId++;
        this.timers.set(id, { at: this.time + delay, callback });
        return id;
    };

    clearTimeout = (id) => this.timers.delete(id);

    advance(milliseconds) {
        const target = this.time + milliseconds;
        while (true) {
            const due = [...this.timers.entries()]
                .filter(([, timer]) => timer.at <= target)
                .sort((left, right) => left[1].at - right[1].at)[0];
            if (!due) break;
            this.time = due[1].at;
            this.timers.delete(due[0]);
            due[1].callback();
        }
        this.time = target;
    }
}

function noteResponse(id, version, snapshot) {
    return {
        data: {
            id,
            version,
            title: snapshot.title,
            content: snapshot.content,
            color: snapshot.color,
            is_pinned: snapshot.is_pinned,
            labels: snapshot.label_ids.map((labelId) => ({ id: labelId, name: 'Nhãn ' + labelId })),
            attachments: [],
        },
    };
}

const settle = async () => {
    // The machine deliberately starts transport work in a microtask so input
    // handlers finish before a request is frozen. Drain enough turns to make
    // the test observe the same post-ack state as a browser event loop.
    for (let index = 0; index < 8; index += 1) await Promise.resolve();
};

function makeMachine({
    transport,
    clock = new FakeClock(),
    snapshot = {
        title: 'Tiêu đề',
        content: 'Cũ',
        color: 'neutral',
        is_pinned: false,
        label_ids: [],
    },
} = {}) {
    return {
        clock,
        machine: new AutosaveMachine({
            userId: '1',
            noteId: '11111111-1111-4111-8111-111111111111',
            persisted: true,
            baseVersion: 1,
            snapshot,
            transport,
            clock,
        }),
    };
}

test('debounces valid edits and reaches saved only after a matching acknowledgement', async () => {
    const calls = [];
    const clock = new FakeClock();
    const { machine } = makeMachine({
        clock,
        transport: async (request) => {
            calls.push(request);
            return noteResponse(request.noteId, 2, request.sentSnapshot);
        },
    });

    machine.input({ content: 'Mới' });
    clock.advance(499);
    assert.equal(calls.length, 0);
    clock.advance(1);
    await settle();

    assert.equal(calls.length, 1);
    assert.equal(calls[0].sentSnapshot.content, 'Mới');
    assert.equal(machine.state.phase, 'saved');
    assert.equal(machine.state.baseVersion, 2);
});

test('keeps typing during a save and sends the latest draft after the first acknowledgement', async () => {
    const calls = [];
    const resolvers = [];
    const clock = new FakeClock();
    const { machine } = makeMachine({
        clock,
        transport: (request) => {
            calls.push(request);
            return new Promise((resolve) => resolvers.push({ request, resolve }));
        },
    });

    machine.input({ content: 'Bản một' });
    clock.advance(500);
    await settle();
    machine.input({ content: 'Bản hai' });
    assert.equal(calls.length, 1);

    resolvers[0].resolve(noteResponse(calls[0].noteId, 2, calls[0].sentSnapshot));
    await settle();
    assert.equal(calls.length, 2);
    assert.equal(calls[1].sentSnapshot.content, 'Bản hai');
    assert.equal(calls[1].baseVersion, 2);

    resolvers[1].resolve(noteResponse(calls[1].noteId, 3, calls[1].sentSnapshot));
    await settle();
    assert.equal(machine.state.phase, 'saved');
});

test('retries the same frozen request with 1s, 2s, then success', async () => {
    const calls = [];
    const clock = new FakeClock();
    const { machine } = makeMachine({
        clock,
        transport: async (request) => {
            calls.push(request);
            if (calls.length < 3) throw { status: 503, code: 'SERVER_BUSY' };
            return noteResponse(request.noteId, 2, request.sentSnapshot);
        },
    });

    machine.input({ content: 'Có thể thử lại' });
    clock.advance(500);
    await settle();
    assert.equal(machine.state.phase, 'retry_wait');
    assert.equal(calls[0].sentSnapshot.content, 'Có thể thử lại');

    clock.advance(1000);
    await settle();
    assert.equal(machine.state.phase, 'retry_wait');
    clock.advance(2000);
    await settle();
    assert.equal(calls.length, 3);
    assert.equal(machine.state.phase, 'saved');
    assert.deepEqual(
        calls.map((call) => call.sentSnapshot),
        [calls[0].sentSnapshot, calls[0].sentSnapshot, calls[0].sentSnapshot],
    );
});

test('pauses on conflict and keeps local draft only after explicit resolution', async () => {
    const calls = [];
    const clock = new FakeClock();
    const server = {
        title: 'Máy chủ',
        content: 'Bản khác',
        color: 'rose',
        is_pinned: false,
        label_ids: [],
    };
    const { machine } = makeMachine({
        clock,
        transport: async (request) => {
            calls.push(request);
            if (calls.length === 1)
                throw {
                    status: 409,
                    payload: { current: { ...noteResponse(request.noteId, 2, server).data } },
                };
            return noteResponse(request.noteId, 3, request.sentSnapshot);
        },
    });

    machine.input({ content: 'Bản local cần giữ' });
    clock.advance(500);
    await settle();
    assert.equal(machine.state.phase, 'conflict');
    assert.equal(machine.state.draftSnapshot.content, 'Bản local cần giữ');

    machine.keepLocal();
    await settle();
    assert.equal(calls.length, 2);
    assert.equal(calls[1].baseVersion, 2);
    assert.equal(calls[1].sentSnapshot.content, 'Bản local cần giữ');
    assert.equal(machine.state.phase, 'saved');
});

test('J02 continuous typing dispatches by two seconds', async () => {
    const calls = [];
    const { machine, clock } = makeMachine({
        transport: async (request) => {
            calls.push(request);
            return noteResponse(request.noteId, 2, request.sentSnapshot);
        },
    });
    for (let index = 0; index < 5; index++) {
        machine.input({ content: 'Nhập ' + index });
        clock.advance(400);
        await settle();
    }
    assert.equal(calls.length, 1);
    assert.equal(calls[0].sentSnapshot.content, 'Nhập 4');
});

test('J07 editing during an unknown write retains retry state and frozen payload', async () => {
    const calls = [];
    const { machine, clock } = makeMachine({
        transport: async (request) => {
            calls.push(request);
            throw { status: 503 };
        },
    });
    machine.input({ content: 'Đã gửi' });
    clock.advance(500);
    await settle();
    machine.input({ content: 'Cũ' });
    assert.equal(machine.phase, 'retry_wait');
    assert.equal(Object.isFrozen(calls[0].sentSnapshot), true);
    for (const delay of [1000, 2000, 4000]) {
        clock.advance(delay);
        await settle();
    }
    clock.advance(60000);
    await settle();
    assert.equal(calls.length, 4);
    assert.equal(machine.phase, 'error');
    assert.equal(machine.draftSnapshot.content, 'Cũ');
    assert.ok(calls.every((call) => call.sentSnapshot.content === 'Đã gửi'));
});

test('J07 Retry-After accepts seconds and dates and defaults missing headers to five seconds', () => {
    const { machine } = makeMachine();
    assert.equal(machine.retryAfterMs({ retryAfter: null }), 5000);
    assert.equal(machine.retryAfterMs({ retryAfter: '3' }), 3000);
    assert.equal(machine.retryAfterMs({ retryAfter: 'Thu, 01 Jan 1970 00:00:07 GMT' }), 7000);
});

test('J10 late acknowledgements after disposal cannot modify the next editor', async () => {
    let resolve;
    const { machine, clock } = makeMachine({
        transport: () =>
            new Promise((done) => {
                resolve = done;
            }),
    });
    machine.input({ content: 'Cũ đang gửi' });
    clock.advance(500);
    await settle();
    const pending = machine.pendingRequest;
    let emitted = false;
    machine.onChange = () => {
        emitted = true;
    };
    machine.dispose();
    resolve(noteResponse(pending.noteId, 2, pending.sentSnapshot));
    await settle();
    assert.equal(emitted, false);
    assert.equal(machine.baseVersion, 1);
});

test('J12 recovery of an older revision requires explicit conflict resolution', () => {
    const { machine } = makeMachine();
    machine.input({ content: 'Bản nháp cũ' });
    machine.phase = 'auth_expired';
    machine.reconcile(
        noteResponse(machine.noteId, 2, {
            ...machine.draftSnapshot,
            content: 'Đã đổi từ cửa sổ khác',
        }).data,
    );
    assert.equal(machine.phase, 'conflict');
    assert.equal(machine.draftSnapshot.content, 'Bản nháp cũ');
    assert.equal(machine.baseVersion, 1);
});

test('J13 expired session pauses timers and acknowledges a committed pending write on recheck', async () => {
    const { machine, clock } = makeMachine({
        transport: async () => {
            throw { status: 419 };
        },
    });
    machine.input({ content: 'Dữ liệu đã gửi' });
    clock.advance(500);
    await settle();
    assert.equal(machine.phase, 'auth_expired');
    const pending = machine.pendingRequest;
    clock.advance(60000);
    machine.reconcile(noteResponse(machine.noteId, 2, pending.sentSnapshot).data);
    assert.equal(machine.phase, 'saved');
    assert.equal(machine.pendingRequest, null);
    assert.equal(machine.baseVersion, 2);
});

test('J14 IME suppresses dispatch until composition ends', async () => {
    const calls = [];
    const { machine, clock } = makeMachine({
        transport: async (request) => {
            calls.push(request);
            return noteResponse(request.noteId, 2, request.sentSnapshot);
        },
    });
    machine.input({ content: 'T' });
    machine.compositionStart();
    machine.input({ content: 'Tiếng Việt' });
    clock.advance(2500);
    await settle();
    assert.equal(calls.length, 0);
    machine.compositionEnd();
    clock.advance(500);
    await settle();
    assert.equal(calls.length, 1);
    assert.equal(calls[0].sentSnapshot.content, 'Tiếng Việt');
});
