<?php

declare(strict_types=1);

namespace Planner\Infrastructure\Session;

use InvalidArgumentException;
use RuntimeException;

final readonly class SessionCipher
{
    private const VERSION = "\x01";

    private function __construct(private string $key) {}

    public static function fromEncodedKey(?string $encoded): self
    {
        if ($encoded === null || trim($encoded) === '') {
            throw new InvalidArgumentException('SESSION_ENCRYPTION_KEY is required by the HTTP runtime.');
        }

        $encoded = trim($encoded);
        $key = preg_match('/^[0-9a-fA-F]{64}$/', $encoded) === 1
            ? hex2bin($encoded)
            : base64_decode($encoded, true);

        if (! is_string($key) || strlen($key) !== SODIUM_CRYPTO_AEAD_XCHACHA20POLY1305_IETF_KEYBYTES) {
            throw new InvalidArgumentException('SESSION_ENCRYPTION_KEY must encode exactly 32 bytes.');
        }

        return new self($key);
    }

    public function encrypt(string $sessionId, string $plaintext): string
    {
        $nonce = random_bytes(SODIUM_CRYPTO_AEAD_XCHACHA20POLY1305_IETF_NPUBBYTES);
        $ciphertext = sodium_crypto_aead_xchacha20poly1305_ietf_encrypt(
            $plaintext,
            $sessionId,
            $nonce,
            $this->key,
        );

        return self::VERSION.$nonce.$ciphertext;
    }

    public function decrypt(string $sessionId, string $payload): string
    {
        $minimum = 1 + SODIUM_CRYPTO_AEAD_XCHACHA20POLY1305_IETF_NPUBBYTES
            + SODIUM_CRYPTO_AEAD_XCHACHA20POLY1305_IETF_ABYTES;

        if (strlen($payload) < $minimum || $payload[0] !== self::VERSION) {
            throw new RuntimeException('Unsupported or truncated session payload.');
        }

        $nonce = substr($payload, 1, SODIUM_CRYPTO_AEAD_XCHACHA20POLY1305_IETF_NPUBBYTES);
        $ciphertext = substr($payload, 1 + SODIUM_CRYPTO_AEAD_XCHACHA20POLY1305_IETF_NPUBBYTES);
        $plaintext = sodium_crypto_aead_xchacha20poly1305_ietf_decrypt(
            $ciphertext,
            $sessionId,
            $nonce,
            $this->key,
        );

        if ($plaintext === false) {
            throw new RuntimeException('Session payload authentication failed.');
        }

        return $plaintext;
    }
}
