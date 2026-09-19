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
            labels: snapshot.label_ids.map((labelId) => ({ id: labelId, name: 'Tag ' + labelId })),
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
    persisted = true,
    baseVersion = persisted ? 1 : null,
    noteId = '11111111-1111-4111-8111-111111111111',
    recovery = null,
    snapshot = {
        title: 'Title',
        content: 'Old',
        color: 'neutral',
        is_pinned: false,
        label_ids: [],
    },
} = {}) {
    return {
        clock,
        machine: new AutosaveMachine({
            userId: '1',
            noteId,
            persisted,
            baseVersion,
            snapshot,
            transport,
            recovery,
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

    machine.input({ content: 'New' });
    clock.advance(499);
    assert.equal(calls.length, 0);
    clock.advance(1);
    await settle();

    assert.equal(calls.length, 1);
    assert.equal(calls[0].sentSnapshot.content, 'New');
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

    machine.input({ content: 'Version one' });
    clock.advance(500);
    await settle();
    machine.input({ content: 'Version two' });
    assert.equal(calls.length, 1);

    resolvers[0].resolve(noteResponse(calls[0].noteId, 2, calls[0].sentSnapshot));
    await settle();
    assert.equal(calls.length, 2);
    assert.equal(calls[1].sentSnapshot.content, 'Version two');
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

    machine.input({ content: 'Can retry' });
    clock.advance(500);
    await settle();
    assert.equal(machine.state.phase, 'retry_wait');
    assert.equal(calls[0].sentSnapshot.content, 'Can retry');

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
        title: 'Server',
        content: 'Different version',
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

    machine.input({ content: 'Local version to keep' });
    clock.advance(500);
    await settle();
    assert.equal(machine.state.phase, 'conflict');
    assert.equal(machine.state.draftSnapshot.content, 'Local version to keep');

    machine.keepLocal();
    await settle();
    assert.equal(calls.length, 2);
    assert.equal(calls[1].baseVersion, 2);
    assert.equal(calls[1].sentSnapshot.content, 'Local version to keep');
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
        machine.input({ content: 'Input ' + index });
        clock.advance(400);
        await settle();
    }
    assert.equal(calls.length, 1);
    assert.equal(calls[0].sentSnapshot.content, 'Input 4');
});

test('J07 editing during an unknown write retains retry state and frozen payload', async () => {
    const calls = [];
    const { machine, clock } = makeMachine({
        transport: async (request) => {
            calls.push(request);
            throw { status: 503 };
        },
    });
    machine.input({ content: 'Submitted' });
    clock.advance(500);
    await settle();
    machine.input({ content: 'Old' });
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
    assert.equal(machine.draftSnapshot.content, 'Old');
    assert.ok(calls.every((call) => call.sentSnapshot.content === 'Submitted'));
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
    machine.input({ content: 'Old version in flight' });
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
    machine.input({ content: 'Old draft' });
    machine.phase = 'auth_expired';
    machine.reconcile(
        noteResponse(machine.noteId, 2, {
            ...machine.draftSnapshot,
            content: 'Changed in another window',
        }).data,
    );
    assert.equal(machine.phase, 'conflict');
    assert.equal(machine.draftSnapshot.content, 'Old draft');
    assert.equal(machine.baseVersion, 1);
});

test('J13 expired session pauses timers and acknowledges a committed pending write on recheck', async () => {
    const { machine, clock } = makeMachine({
        transport: async () => {
            throw { status: 419 };
        },
    });
    machine.input({ content: 'Submitted data' });
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
    machine.input({ content: 'English content' });
    clock.advance(2500);
    await settle();
    assert.equal(calls.length, 0);
    machine.compositionEnd();
    clock.advance(500);
    await settle();
    assert.equal(calls.length, 1);
    assert.equal(calls[0].sentSnapshot.content, 'English content');
});

test('J01 a new note waits for both valid fields and reuses one stable UUID', async () => {
    const calls = [];
    const { machine, clock } = makeMachine({
        persisted: false,
        snapshot: { title: '', content: '', color: 'neutral' },
        transport: async (request) => {
            calls.push(request);
            return noteResponse(request.noteId, 1, request.sentSnapshot);
        },
    });

    machine.input({ title: 'Title only' });
    clock.advance(2500);
    await settle();
    assert.equal(calls.length, 0);
    assert.equal(machine.phase, 'incomplete');

    machine.input({ content: 'Now valid' });
    clock.advance(500);
    await settle();
    assert.equal(calls.length, 1);
    assert.equal(calls[0].kind, 'create');
    assert.equal(calls[0].noteId, machine.noteId);
    assert.equal(machine.phase, 'saved');
    assert.equal(machine.baseVersion, 1);
});

test('J05 a lost create response retries the exact UUID and snapshot', async () => {
    const calls = [];
    const { machine, clock } = makeMachine({
        persisted: false,
        snapshot: { title: '', content: '', color: 'neutral' },
        transport: async (request) => {
            calls.push(request);
            if (calls.length === 1) throw { status: 0, code: 'NETWORK_ERROR' };
            return noteResponse(request.noteId, 1, request.sentSnapshot);
        },
    });

    machine.input({ title: 'Create once', content: 'Must not duplicate' });
    clock.advance(500);
    await settle();
    clock.advance(1000);
    await settle();

    assert.equal(calls.length, 2);
    assert.equal(calls[0].noteId, calls[1].noteId);
    assert.deepEqual(calls[0].sentSnapshot, calls[1].sentSnapshot);
    assert.equal(machine.phase, 'saved');
});

test('J06 a lost update response retries the same base revision and snapshot', async () => {
    const calls = [];
    const { machine, clock } = makeMachine({
        transport: async (request) => {
            calls.push(request);
            if (calls.length === 1) throw { status: 503 };
            return noteResponse(request.noteId, 2, request.sentSnapshot);
        },
    });

    machine.input({ content: 'The server may have saved this' });
    clock.advance(500);
    await settle();
    clock.advance(1000);
    await settle();

    assert.equal(calls.length, 2);
    assert.equal(calls[0].baseVersion, 1);
    assert.equal(calls[1].baseVersion, 1);
    assert.deepEqual(calls[0].sentSnapshot, calls[1].sentSnapshot);
    assert.equal(machine.baseVersion, 2);
});

test('J08 validation errors stop automatic retry and corrected input can save', async () => {
    const calls = [];
    const { machine, clock } = makeMachine({
        transport: async (request) => {
            calls.push(request);
            if (calls.length === 1) {
                throw { status: 422, payload: { errors: { content: ['Invalid'] } } };
            }
            return noteResponse(request.noteId, 2, request.sentSnapshot);
        },
    });

    machine.input({ content: 'Rejected by server' });
    clock.advance(500);
    await settle();
    clock.advance(60000);
    await settle();
    assert.equal(calls.length, 1);
    assert.equal(machine.phase, 'error');

    machine.input({ content: 'Corrected content' });
    clock.advance(500);
    await settle();
    assert.equal(calls.length, 2);
    assert.equal(calls[1].sentSnapshot.content, 'Corrected content');
    assert.equal(machine.phase, 'saved');
});

test('J09 choosing server adopts it while a second keep-local conflict pauses again', async () => {
    const serverV2 = {
        title: 'Server',
        content: 'Version 2',
        color: 'rose',
        is_pinned: false,
        label_ids: [],
    };
    const serverV3 = { ...serverV2, content: 'Version 3' };
    const useServerMachine = makeMachine({
        transport: async (request) => {
            throw {
                status: 409,
                payload: { current: noteResponse(request.noteId, 2, serverV2).data },
            };
        },
    });
    useServerMachine.machine.input({ content: 'Local' });
    useServerMachine.clock.advance(500);
    await settle();
    useServerMachine.machine.useServer();
    assert.equal(useServerMachine.machine.phase, 'saved');
    assert.equal(useServerMachine.machine.draftSnapshot.content, 'Version 2');

    let attempts = 0;
    const keepLocalMachine = makeMachine({
        transport: async (request) => {
            attempts += 1;
            const current = attempts === 1 ? serverV2 : serverV3;
            throw {
                status: 409,
                payload: { current: noteResponse(request.noteId, attempts + 1, current).data },
            };
        },
    });
    keepLocalMachine.machine.input({ content: 'Keep local' });
    keepLocalMachine.clock.advance(500);
    await settle();
    keepLocalMachine.machine.keepLocal();
    await settle();
    assert.equal(attempts, 2);
    assert.equal(keepLocalMachine.machine.phase, 'conflict');
    keepLocalMachine.clock.advance(60000);
    await settle();
    assert.equal(attempts, 2);
    assert.equal(keepLocalMachine.machine.draftSnapshot.content, 'Keep local');
});

test('J11 flush saves a valid dirty draft and discard removes invalid recovery', async () => {
    const recovery = {
        writes: 0,
        removals: 0,
        write() {
            this.writes += 1;
            return true;
        },
        remove() {
            this.removals += 1;
        },
    };
    const { machine } = makeMachine({
        recovery,
        transport: async (request) => noteResponse(request.noteId, 2, request.sentSnapshot),
    });
    machine.input({ content: 'Save before closing' });
    assert.equal(machine.flush(), false);
    assert.equal(machine.phase, 'saving');
    await settle();
    assert.equal(machine.phase, 'saved');

    machine.input({ content: '' });
    assert.equal(machine.phase, 'incomplete');
    machine.discard();
    assert.equal(machine.phase, 'saved');
    assert.ok(recovery.writes > 0);
    assert.ok(recovery.removals >= 2);
});

test('J15 a deleted note stops stale retries and retains the local draft', async () => {
    const { machine, clock } = makeMachine({
        transport: async () => {
            throw { status: 410, code: 'NOTE_DELETED' };
        },
    });
    machine.input({ content: 'Local version to copy' });
    clock.advance(500);
    await settle();

    assert.equal(machine.phase, 'unavailable');
    assert.equal(machine.pendingRequest, null);
    assert.equal(machine.draftSnapshot.content, 'Local version to copy');
    clock.advance(60000);
    await settle();
    assert.equal(machine.phase, 'unavailable');
});

test('J16 invalid existing content never replaces the server and saves after correction', async () => {
    const calls = [];
    const { machine, clock } = makeMachine({
        transport: async (request) => {
            calls.push(request);
            return noteResponse(request.noteId, 2, request.sentSnapshot);
        },
    });

    machine.input({ content: '' });
    clock.advance(2500);
    await settle();
    assert.equal(calls.length, 0);
    assert.equal(machine.acknowledgedSnapshot.content, 'Old');
    assert.equal(machine.draftSnapshot.content, '');

    machine.input({ content: 'Edited content' });
    clock.advance(500);
    await settle();
    assert.equal(calls.length, 1);
    assert.equal(calls[0].sentSnapshot.content, 'Edited content');
    assert.equal(machine.phase, 'saved');
});
