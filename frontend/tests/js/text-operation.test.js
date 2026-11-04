import assert from 'node:assert/strict';
import test from 'node:test';
import { OTClient } from '../../src/js/lib/ot-client.js';
import {
    apply,
    compose,
    fromDiff,
    transform,
    transformIndex,
} from '../../src/js/lib/text-operation.js';

function random(seed) {
    let state = seed;
    return () => {
        state = (state * 1103515245 + 12345) % 2147483648;
        return state / 2147483648;
    };
}

const alphabet = ['a', 'b', ' ', '\n', 'ế', 'ạ', 'đ', 'Ư'];

function randomText(next, max = 20) {
    let text = '';
    for (let count = Math.floor(next() * max); count > 0; count--)
        text += alphabet[Math.floor(next() * alphabet.length)];
    return text;
}

function randomOperation(next, text) {
    return fromDiff(text, randomEdit(next, text));
}

function randomEdit(next, text) {
    const start = Math.floor(next() * (text.length + 1));
    const end = start + Math.floor(next() * (text.length - start + 1));
    return text.slice(0, start) + randomText(next, 4) + text.slice(end);
}

test('fromDiff produces a single splice that reproduces the edit', () => {
    assert.deepEqual(fromDiff('abc', 'abXc'), [2, 'X', 1]);
    assert.deepEqual(fromDiff('abc', 'ac'), [1, -1, 1]);
    assert.deepEqual(fromDiff('abc', 'abc'), [3]);
    assert.deepEqual(fromDiff('', 'hi'), ['hi']);
    const next = random(7);
    for (let round = 0; round < 300; round++) {
        const before = randomText(next);
        const after = randomEdit(next, before);
        assert.equal(apply(fromDiff(before, after), before), after);
    }
});

test('fromDiff never splits a surrogate pair', () => {
    const ops = fromDiff('😀', '😃');
    assert.deepEqual(ops, ['😃', -2]);
    assert.equal(apply(ops, '😀'), '😃');
});

test('transform converges and compose is equivalent to sequential apply', () => {
    const next = random(42);
    for (let round = 0; round < 500; round++) {
        const text = randomText(next);
        const a = randomOperation(next, text);
        const b = randomOperation(next, text);
        const [aPrime, bPrime] = transform(a, b);
        assert.equal(apply(bPrime, apply(a, text)), apply(aPrime, apply(b, text)));
        const afterA = apply(a, text);
        const c = randomOperation(next, afterA);
        assert.equal(apply(compose(a, c), text), apply(c, afterA));
    }
});

test('carets move with remote edits', () => {
    assert.equal(transformIndex([2, 'XY', 3], 4), 6);
    assert.equal(transformIndex([2, 'XY', 3], 2), 2);
    assert.equal(transformIndex([2, 'XY', 3], 2, { ownInsert: true }), 4);
    assert.equal(transformIndex([1, -3, 1], 3), 1);
    assert.equal(transformIndex([1, -3, 1], 5), 2);
});

/** A tiny in-memory ot.js server for simulating several clients. */
function simulate(seed, clientCount, steps) {
    const next = random(seed);
    const initial = randomText(next);
    const server = { text: initial, history: [] };
    const queues = [];
    const clients = [];
    const deliver = (from, revision, ops) => {
        let op = ops;
        for (const concurrent of server.history.slice(revision)) [op] = transform(op, concurrent);
        server.text = apply(op, server.text);
        server.history.push(op);
        queues.forEach((queue, index) => queue.push(index === from ? { ack: true } : { op }));
    };
    for (let index = 0; index < clientCount; index++) {
        queues.push([]);
        const client = new OTClient({
            revision: 0,
            text: initial,
            send: (revision, ops) => pendingSends.push([index, revision, ops]),
            onRemote: () => {},
        });
        clients.push(client);
    }
    const pendingSends = [];
    for (let step = 0; step < steps; step++) {
        const choice = next();
        if (choice < 0.45) {
            const index = Math.floor(next() * clientCount);
            const client = clients[index];
            client.applyLocal(fromDiff(client.text, randomEdit(next, client.text)));
        } else if (choice < 0.75 && pendingSends.length) {
            const [from, revision, ops] = pendingSends.shift();
            deliver(from, revision, ops);
        } else {
            const index = Math.floor(next() * clientCount);
            const message = queues[index].shift();
            if (message?.ack) clients[index].serverAck();
            else if (message) clients[index].applyServer(message.op);
        }
    }
    // Drain everything.
    while (pendingSends.length || queues.some((queue) => queue.length)) {
        while (pendingSends.length) deliver(...pendingSends.shift());
        queues.forEach((queue, index) => {
            while (queue.length) {
                const message = queue.shift();
                if (message.ack) clients[index].serverAck();
                else clients[index].applyServer(message.op);
            }
        });
    }
    return { server, clients };
}

test('several clients editing concurrently converge with the server', () => {
    for (let seed = 1; seed <= 60; seed++) {
        const { server, clients } = simulate(seed, 3, 60);
        for (const client of clients) {
            assert.equal(client.text, server.text, `seed ${seed}`);
            assert.equal(client.hasPending(), false);
        }
    }
});

test('reconnecting rebases unacknowledged edits over changes made meanwhile', () => {
    const sent = [];
    const client = new OTClient({
        revision: 3,
        text: 'hello world',
        send: (revision, ops) => sent.push([revision, ops]),
        onRemote: () => {},
    });
    client.applyLocal(fromDiff('hello world', 'hello brave world'));
    // The connection drops; another person changed the start meanwhile.
    const visible = client.rebase(7, 'Hi, hello world');
    assert.equal(client.text, 'Hi, hello brave world');
    assert.deepEqual(visible, ['Hi, ', 17]);
    assert.equal(client.revision, 7);
    assert.deepEqual(sent.at(-1), [7, [10, 'brave ', 5]]);

    // An edit the server already applied before the drop is not sent twice.
    const again = new OTClient({
        revision: 0,
        text: 'ab',
        send: (r, o) => sent.push([r, o]),
        onRemote: () => {},
    });
    again.applyLocal(['x', 2]);
    const count = sent.length;
    assert.equal(again.rebase(1, 'xab'), null);
    assert.equal(again.text, 'xab');
    assert.equal(sent.length, count);
    assert.equal(again.hasPending(), false);

    // The in-flight edit landed but a later buffered one did not: only the later one is resent.
    const third = new OTClient({
        revision: 0,
        text: 'ab',
        send: (r, o) => sent.push([r, o]),
        onRemote: () => {},
    });
    third.applyLocal(['x', 2]);
    third.applyLocal([3, 'y']);
    assert.equal(third.rebase(1, 'xab'), null);
    assert.equal(third.text, 'xaby');
    assert.deepEqual(sent.at(-1), [1, [3, 'y']]);
});
