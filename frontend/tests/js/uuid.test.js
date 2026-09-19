import test from 'node:test';
import assert from 'node:assert/strict';
import { isUuidV4, secureUuidV4 } from '../../src/js/lib/uuid.js';

test('secure UUID uses and normalizes a native RFC 4122 v4 value', () => {
    const uuid = secureUuidV4({
        randomUUID: () => 'A0B1C2D3-E4F5-4678-9ABC-DEF012345678',
    });

    assert.equal(uuid, 'a0b1c2d3-e4f5-4678-9abc-def012345678');
    assert.equal(isUuidV4(uuid), true);
});

test('secure UUID fallback sets the RFC 4122 version and variant bits', () => {
    const uuid = secureUuidV4({
        getRandomValues: (bytes) => {
            for (let index = 0; index < bytes.length; index += 1) bytes[index] = index;
            return bytes;
        },
    });

    assert.equal(uuid, '00010203-0405-4607-8809-0a0b0c0d0e0f');
    assert.equal(isUuidV4(uuid), true);
});

test('secure UUID refuses to create data when secure randomness is unavailable', () => {
    assert.throws(() => secureUuidV4({}), /cannot generate secure identifiers/);
});
