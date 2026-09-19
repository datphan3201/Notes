const UUID_V4 = /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/;

/**
 * Generate a UUID suitable for idempotent create requests. There is no weak
 * randomness fallback: failing visibly is safer than generating colliding IDs.
 */
export function secureUuidV4(cryptoProvider = globalThis.crypto) {
    if (typeof cryptoProvider?.randomUUID === 'function') {
        const uuid = cryptoProvider.randomUUID().toLowerCase();
        if (UUID_V4.test(uuid)) return uuid;
    }

    if (typeof cryptoProvider?.getRandomValues !== 'function') {
        throw new Error(
            'This browser cannot generate secure identifiers, so new data cannot be created.',
        );
    }

    const bytes = new Uint8Array(16);
    cryptoProvider.getRandomValues(bytes);
    bytes[6] = (bytes[6] & 0x0f) | 0x40;
    bytes[8] = (bytes[8] & 0x3f) | 0x80;
    const hex = [...bytes].map((byte) => byte.toString(16).padStart(2, '0')).join('');

    return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-${hex.slice(12, 16)}-${hex.slice(16, 20)}-${hex.slice(20)}`;
}

export function isUuidV4(value) {
    return typeof value === 'string' && UUID_V4.test(value);
}
