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
    const team = {
        type: 'team_invite',
        payload: { params: { actor: 'An', team: 'Team 5', role: 'viewer' } },
    };
    assert.deepEqual(
        vi(() => notificationText(team)),
        { title: 'An đã mời bạn vào Team 5', body: 'Vai trò: Người xem' },
    );
});

test('older notifications without params keep their stored text', () => {
    assert.deepEqual(
        notificationText({
            type: 'team_joined',
            payload: { title: 'Sam joined Team 5', body: '' },
        }),
        { title: 'Sam joined Team 5', body: '' },
    );
    // A name that looks like a placeholder is inserted literally, never re-expanded.
    assert.equal(
        notificationText({
            type: 'team_joined',
            payload: { params: { actor: ':team', team: 'X' } },
        }).title,
        ':team joined X',
    );
});
