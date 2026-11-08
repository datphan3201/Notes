import assert from 'node:assert/strict';
import test from 'node:test';
import { notificationText } from '../../src/js/lib/notifications.js';

const vi = (callback) => {
    globalThis.window = { notesBootstrap: { preferences: { locale: 'vi' } } };
    try {
        return callback();
    } finally {
        delete globalThis.window;
    }
};

test('notifications are worded in the reader language from their params', () => {
    const invite = {
        type: 'share_invite',
        payload: {
            title: 'Lan shared a note with you',
            body: 'Plan (can edit)',
            params: { actor: 'Lan', note: 'Plan', permission: 'edit' },
        },
    };
    assert.deepEqual(notificationText(invite), {
        title: 'Lan shared a note with you',
        body: 'Plan (Can edit)',
    });
    assert.deepEqual(
        vi(() => notificationText(invite)),
        { title: 'Lan đã chia sẻ một ghi chú với bạn', body: 'Plan (Được sửa)' },
    );

});

test('older notifications without params keep their stored text', () => {
    assert.deepEqual(
        notificationText({
            type: 'share_joined',
            payload: { title: 'Sam joined your shared note', body: '' },
        }),
        { title: 'Sam joined your shared note', body: '' },
    );
    // A name that looks like a placeholder is inserted literally, never re-expanded.
    assert.equal(
        notificationText({
            type: 'share_joined',
            payload: { params: { actor: ':note', note: 'X' } },
        }).title,
        ':note joined your shared note',
    );
});
