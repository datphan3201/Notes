<?php

declare(strict_types=1);

namespace Planner\Infrastructure\Mail;

use RuntimeException;

/**
 * Minimal SMTP client: EHLO, optional STARTTLS or implicit TLS, AUTH PLAIN or
 * LOGIN, then one message. Every reply is checked; any failure throws.
 */
final readonly class SmtpTransport
{
    public function __construct(
        private string $host,
        private int $port,
        private string $encryption,
        private ?string $username = null,
        private ?string $password = null,
        private string $heloName = 'localhost',
        private int $timeout = 15,
        private bool $verifyPeer = true,
    ) {
        if (!in_array($encryption, ['tls', 'ssl', 'none'], true)) {
            throw new RuntimeException('SMTP encryption must be tls, ssl or none.');
        }
    }

    /** @param list<string> $recipients */
    public function send(string $from, array $recipients, string $message): void
    {
        $context = stream_context_create(['ssl' => [
            'peer_name' => $this->host,
            'verify_peer' => $this->verifyPeer,
            'verify_peer_name' => $this->verifyPeer,
            'SNI_enabled' => true,
        ]]);
        $remote = ($this->encryption === 'ssl' ? 'ssl://' : 'tcp://').$this->host.':'.$this->port;
        $socket = @stream_socket_client($remote, $code, $error, $this->timeout, STREAM_CLIENT_CONNECT, $context);
        if ($socket === false) {
            throw new RuntimeException("SMTP connection to {$this->host}:{$this->port} failed: $error");
        }
        stream_set_timeout($socket, $this->timeout);

        try {
            $this->expect($socket, [220]);
            $extensions = $this->hello($socket);
            if ($this->encryption === 'tls') {
                if (!array_key_exists('STARTTLS', $extensions)) {
                    throw new RuntimeException('The SMTP server does not offer STARTTLS.');
                }
                $this->command($socket, 'STARTTLS', [220]);
                if (stream_socket_enable_crypto($socket, true, STREAM_CRYPTO_METHOD_TLS_CLIENT) !== true) {
                    throw new RuntimeException('SMTP TLS negotiation failed.');
                }
                $extensions = $this->hello($socket);
            }
            if ($this->username !== null && $this->username !== '') {
                $this->authenticate($socket, (string) ($extensions['AUTH'] ?? ''));
            }
            $this->command($socket, 'MAIL FROM:<'.$this->address($from).'>', [250]);
            foreach ($recipients as $recipient) {
                $this->command($socket, 'RCPT TO:<'.$this->address($recipient).'>', [250, 251]);
            }
            $this->command($socket, 'DATA', [354]);
            // CRLF line endings and RFC 5321 dot-stuffing.
            $data = (string) preg_replace("/\r\n|\r|\n/", "\r\n", $message);
            $data = (string) preg_replace('/^\./m', '..', $data);
            $this->write($socket, rtrim($data, "\r\n")."\r\n.\r\n");
            $this->expect($socket, [250]);
            try {
                $this->command($socket, 'QUIT', [221]);
            } catch (RuntimeException) {
                // The message is already accepted; a rude goodbye changes nothing.
            }
        } finally {
            fclose($socket);
        }
    }

    /** @param resource $socket @return array<string, string> */
    private function hello($socket): array
    {
        $this->write($socket, 'EHLO '.$this->heloName."\r\n");
        [$code, $lines] = $this->read($socket);
        if ($code !== 250) {
            $this->command($socket, 'HELO '.$this->heloName, [250]);

            return [];
        }
        $extensions = [];
        foreach (array_slice($lines, 1) as $line) {
            $parts = explode(' ', trim($line), 2);
            $extensions[strtoupper($parts[0])] = strtoupper($parts[1] ?? '');
        }

        return $extensions;
    }

    /** @param resource $socket */
    private function authenticate($socket, string $mechanisms): void
    {
        if ($mechanisms === '' || str_contains(" $mechanisms ", ' PLAIN ')) {
            $this->command($socket, 'AUTH PLAIN '.base64_encode("\0".$this->username."\0".$this->password), [235]);

            return;
        }
        if (!str_contains(" $mechanisms ", ' LOGIN ')) {
            throw new RuntimeException('The SMTP server offers no supported login method.');
        }
        $this->command($socket, 'AUTH LOGIN', [334]);
        $this->command($socket, base64_encode((string) $this->username), [334]);
        $this->command($socket, base64_encode((string) $this->password), [235]);
    }

    /** @param resource $socket @param list<int> $accepted */
    private function command($socket, string $line, array $accepted): void
    {
        $this->write($socket, $line."\r\n");
        $this->expect($socket, $accepted, str_starts_with($line, 'AUTH') ? 'AUTH' : strtok($line, ' :'));
    }

    /** @param resource $socket @param list<int> $accepted */
    private function expect($socket, array $accepted, string $step = 'greeting'): void
    {
        [$code, $lines] = $this->read($socket);
        if (!in_array($code, $accepted, true)) {
            throw new RuntimeException("SMTP $step was rejected: ".trim(implode(' ', $lines)));
        }
    }

    /** @param resource $socket @return array{0:int,1:list<string>} */
    private function read($socket): array
    {
        $lines = [];
        while (true) {
            $line = fgets($socket, 1024);
            if ($line === false) {
                $meta = stream_get_meta_data($socket);
                throw new RuntimeException($meta['timed_out'] ? 'SMTP server timed out.' : 'SMTP connection closed unexpectedly.');
            }
            $lines[] = substr(rtrim($line, "\r\n"), 4);
            // "250-..." continues a multi-line reply; "250 ..." ends it.
            if (strlen($line) < 4 || $line[3] !== '-') {
                return [(int) substr($line, 0, 3), $lines];
            }
        }
    }

    /** @param resource $socket */
    private function write($socket, string $data): void
    {
        $remaining = $data;
        while ($remaining !== '') {
            $written = fwrite($socket, $remaining);
            if ($written === false || $written === 0) {
                throw new RuntimeException('SMTP write failed.');
            }
            $remaining = substr($remaining, $written);
        }
    }

    private function address(string $email): string
    {
        if ($email === '' || strpbrk($email, "\r\n<>") !== false) {
            throw new RuntimeException('Invalid SMTP address.');
        }

        return $email;
    }
}
