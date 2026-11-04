<?php

declare(strict_types=1);

namespace Planner\Infrastructure\Realtime;

use Psr\Log\LoggerInterface;

/**
 * Minimal RFC 6455 WebSocket server on PHP streams, driving a CollaborationHub.
 *
 * One process, one stream_select loop, no extensions or frameworks. A browser
 * connects to /realtime, then sends {"type":"auth","ticket":...} as its first
 * message (tickets stay out of URLs and proxy logs). Only text frames carry
 * application JSON; ping/pong/close are handled here. Origins other than the
 * configured app origins are refused during the handshake.
 */
final class WebSocketServer
{
    private const GUID = '258EAFA5-E914-47DA-95CA-C5AB0DC85B11';

    private const MAX_MESSAGE_BYTES = 1_048_576;

    private const MAX_CONNECTIONS = 1000;

    private const AUTH_TIMEOUT_MS = 10_000;

    private const IDLE_TIMEOUT_MS = 75_000;

    private const PING_EVERY_MS = 25_000;

    /** @var resource|null */
    private $server = null;

    /** @var array<int, array<string, mixed>> */
    private array $connections = [];

    /** @var array<int, int> stream resource id => connection id */
    private array $bySocket = [];

    private int $nextId = 1;

    private bool $running = true;

    private CollaborationHub $hub;

    /**
     * @param list<string> $allowedOrigins exact scheme://host[:port] values
     * @param \Closure(\Closure(int, array<string, mixed>): void, \Closure(int, int, string): void): CollaborationHub $hubFactory
     * @param (\Closure(): void)|null $heartbeat called about once a minute (for example to keep the database connection alive)
     */
    public function __construct(
        private readonly string $listen,
        private readonly array $allowedOrigins,
        private readonly RealtimeTicket $tickets,
        \Closure $hubFactory,
        private readonly ?LoggerInterface $logger = null,
        private readonly ?\Closure $heartbeat = null,
    ) {
        $this->hub = $hubFactory(
            fn (int $id, array $message) => $this->sendJson($id, $message),
            fn (int $id, int $code, string $reason) => $this->closeConnection($id, $code, $reason),
        );
    }

    public function stop(): void
    {
        $this->running = false;
    }

    public function run(): void
    {
        $context = stream_context_create(['socket' => ['so_reuseaddr' => true, 'backlog' => 128]]);
        $server = @stream_socket_server('tcp://'.$this->listen, $errorCode, $errorMessage, STREAM_SERVER_BIND | STREAM_SERVER_LISTEN, $context);
        if ($server === false) {
            throw new \RuntimeException("Realtime server cannot listen on {$this->listen}: $errorMessage ($errorCode)");
        }
        stream_set_blocking($server, false);
        $this->server = $server;
        $this->logger?->info('Realtime server listening.', ['listen' => $this->listen]);
        $lastHeartbeat = $this->now();

        while ($this->running) {
            $read = [$server];
            $write = [];
            foreach ($this->connections as $connection) {
                $read[] = $connection['socket'];
                if ($connection['out'] !== '') {
                    $write[] = $connection['socket'];
                }
            }
            $except = null;
            $ready = @stream_select($read, $write, $except, 0, 100_000);
            if ($ready === false) {
                // Interrupted by a signal; the loop condition decides whether to stop.
                continue;
            }
            foreach ($read as $socket) {
                if ($socket === $server) {
                    $this->accept();
                    continue;
                }
                $id = $this->idFor($socket);
                if ($id !== null) {
                    $this->readFrom($id);
                }
            }
            foreach ($write as $socket) {
                $id = $this->idFor($socket);
                if ($id !== null) {
                    $this->flush($id);
                }
            }
            $now = $this->now();
            $this->hub->tick($now);
            $this->housekeeping($now);
            if ($this->heartbeat !== null && $now - $lastHeartbeat > 60_000) {
                $lastHeartbeat = $now;
                ($this->heartbeat)();
            }
        }

        foreach (array_keys($this->connections) as $id) {
            $this->closeConnection($id, 1001, 'Server restarting');
        }
        // Rooms save their text when their last participant leaves.
        fclose($server);
    }

    private function accept(): void
    {
        $socket = @stream_socket_accept($this->server, 0);
        if ($socket === false) {
            return;
        }
        if (count($this->connections) >= self::MAX_CONNECTIONS) {
            fclose($socket);

            return;
        }
        stream_set_blocking($socket, false);
        $id = $this->nextId++;
        $this->bySocket[get_resource_id($socket)] = $id;
        $now = $this->now();
        $this->connections[$id] = [
            'socket' => $socket,
            'state' => 'handshake',
            'in' => '',
            'out' => '',
            'fragments' => '',
            'opened' => $now,
            'seen' => $now,
            'pinged' => $now,
            'closing' => false,
        ];
    }

    private function readFrom(int $id): void
    {
        $chunk = @fread($this->connections[$id]['socket'], 65536);
        if ($chunk === false || ($chunk === '' && feof($this->connections[$id]['socket']))) {
            $this->drop($id);

            return;
        }
        $this->connections[$id]['in'] .= $chunk;
        $this->connections[$id]['seen'] = $this->now();
        if (strlen($this->connections[$id]['in']) > self::MAX_MESSAGE_BYTES + 16) {
            $this->closeConnection($id, 1009, 'Message too large');

            return;
        }
        if ($this->connections[$id]['state'] === 'handshake') {
            $this->handshake($id);

            return;
        }
        $this->frames($id);
    }

    private function handshake(int $id): void
    {
        $buffer = $this->connections[$id]['in'];
        $end = strpos($buffer, "\r\n\r\n");
        if ($end === false) {
            if (strlen($buffer) > 16384) {
                $this->reject($id, 431, 'Request Header Fields Too Large');
            }

            return;
        }
        $this->connections[$id]['in'] = substr($buffer, $end + 4);
        $lines = explode("\r\n", substr($buffer, 0, $end));
        $requestLine = array_shift($lines);
        $headers = [];
        foreach ($lines as $line) {
            $colon = strpos($line, ':');
            if ($colon !== false) {
                $headers[strtolower(trim(substr($line, 0, $colon)))] = trim(substr($line, $colon + 1));
            }
        }
        $path = (string) parse_url(explode(' ', (string) $requestLine)[1] ?? '', PHP_URL_PATH);
        $origin = $headers['origin'] ?? '';
        $key = $headers['sec-websocket-key'] ?? '';
        if (! str_starts_with((string) $requestLine, 'GET ')
            || ! in_array($path, ['/realtime', '/'], true)
            || strtolower($headers['upgrade'] ?? '') !== 'websocket'
            || ($headers['sec-websocket-version'] ?? '') !== '13'
            || strlen((string) base64_decode($key, true)) !== 16) {
            $this->reject($id, 400, 'Bad Request');

            return;
        }
        if (! in_array(rtrim($origin, '/'), $this->allowedOrigins, true)) {
            $this->reject($id, 403, 'Forbidden');

            return;
        }
        $accept = base64_encode(sha1($key.self::GUID, true));
        $this->connections[$id]['out'] .= "HTTP/1.1 101 Switching Protocols\r\nUpgrade: websocket\r\nConnection: Upgrade\r\nSec-WebSocket-Accept: $accept\r\n\r\n";
        $this->connections[$id]['state'] = 'auth';
        $this->flush($id);
        if (isset($this->connections[$id]) && $this->connections[$id]['in'] !== '') {
            $this->frames($id);
        }
    }

    private function frames(int $id): void
    {
        while (isset($this->connections[$id])) {
            $buffer = $this->connections[$id]['in'];
            if (strlen($buffer) < 2) {
                return;
            }
            $first = ord($buffer[0]);
            $second = ord($buffer[1]);
            $final = ($first & 0x80) !== 0;
            $opcode = $first & 0x0F;
            $masked = ($second & 0x80) !== 0;
            $length = $second & 0x7F;
            $offset = 2;
            if ($length === 126) {
                if (strlen($buffer) < 4) {
                    return;
                }
                $length = unpack('n', substr($buffer, 2, 2))[1];
                $offset = 4;
            } elseif ($length === 127) {
                if (strlen($buffer) < 10) {
                    return;
                }
                $length = unpack('J', substr($buffer, 2, 8))[1];
                $offset = 10;
            }
            if (! $masked || ($first & 0x70) !== 0) {
                $this->closeConnection($id, 1002, 'Protocol error');

                return;
            }
            if ($length > self::MAX_MESSAGE_BYTES) {
                $this->closeConnection($id, 1009, 'Message too large');

                return;
            }
            if (strlen($buffer) < $offset + 4 + $length) {
                return;
            }
            $mask = substr($buffer, $offset, 4);
            $payload = substr($buffer, $offset + 4, $length);
            $this->connections[$id]['in'] = substr($buffer, $offset + 4 + $length);
            $payload ^= str_repeat($mask, intdiv($length, 4) + 1);
            $payload = substr($payload, 0, $length);

            match ($opcode) {
                0x0, 0x1 => $this->data($id, $opcode, $payload, $final),
                0x8 => $this->closeConnection($id, 1000, ''),
                0x9 => $this->queue($id, $this->frame(0xA, $payload)),
                0xA => null,
                default => $this->closeConnection($id, 1003, 'Unsupported data'),
            };
        }
    }

    private function data(int $id, int $opcode, string $payload, bool $final): void
    {
        $this->connections[$id]['fragments'] .= $payload;
        if (strlen($this->connections[$id]['fragments']) > self::MAX_MESSAGE_BYTES) {
            $this->closeConnection($id, 1009, 'Message too large');

            return;
        }
        if (! $final) {
            return;
        }
        $text = $this->connections[$id]['fragments'];
        $this->connections[$id]['fragments'] = '';
        try {
            $message = json_decode($text, true, 32, JSON_THROW_ON_ERROR);
        } catch (\JsonException) {
            $this->closeConnection($id, 1007, 'Invalid JSON');

            return;
        }
        if (! is_array($message)) {
            $this->closeConnection($id, 1007, 'Invalid message');

            return;
        }
        if ($this->connections[$id]['state'] === 'auth') {
            $claims = is_string($message['ticket'] ?? null) && ($message['type'] ?? null) === 'auth'
                ? $this->tickets->verify($message['ticket'], time())
                : null;
            if ($claims === null) {
                $this->sendJson($id, ['type' => 'error', 'code' => 'BAD_TICKET', 'message' => 'Live collaboration could not start. Reopen the note.']);
                $this->closeConnection($id, 4401, 'Bad ticket');

                return;
            }
            $this->connections[$id]['state'] = 'open';
            $this->hub->join($id, $claims, $this->now());

            return;
        }
        try {
            $this->hub->message($id, $message, $this->now());
        } catch (\Throwable $exception) {
            $this->logger?->error('Realtime message failed.', ['error' => $exception->getMessage()]);
            $this->sendJson($id, ['type' => 'error', 'code' => 'SERVER_ERROR']);
        }
    }

    /** @param array<string, mixed> $message */
    private function sendJson(int $id, array $message): void
    {
        if (! isset($this->connections[$id]) || $this->connections[$id]['closing']) {
            return;
        }
        $this->queue($id, $this->frame(0x1, json_encode($message, JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES | JSON_THROW_ON_ERROR)));
    }

    private function queue(int $id, string $bytes): void
    {
        if (! isset($this->connections[$id])) {
            return;
        }
        $this->connections[$id]['out'] .= $bytes;
        // A client that stops reading must not grow memory without bound.
        if (strlen($this->connections[$id]['out']) > 8 * self::MAX_MESSAGE_BYTES) {
            $this->drop($id);

            return;
        }
        $this->flush($id);
    }

    private function flush(int $id): void
    {
        if (! isset($this->connections[$id]) || $this->connections[$id]['out'] === '') {
            return;
        }
        $written = @fwrite($this->connections[$id]['socket'], $this->connections[$id]['out']);
        if ($written === false) {
            $this->drop($id);

            return;
        }
        $this->connections[$id]['out'] = (string) substr($this->connections[$id]['out'], $written);
        if ($this->connections[$id]['out'] === '' && $this->connections[$id]['closing']) {
            $this->drop($id);
        }
    }

    private function frame(int $opcode, string $payload): string
    {
        $length = strlen($payload);
        $header = chr(0x80 | $opcode);
        if ($length < 126) {
            $header .= chr($length);
        } elseif ($length < 65536) {
            $header .= chr(126).pack('n', $length);
        } else {
            $header .= chr(127).pack('J', $length);
        }

        return $header.$payload;
    }

    private function closeConnection(int $id, int $code, string $reason): void
    {
        if (! isset($this->connections[$id]) || $this->connections[$id]['closing']) {
            return;
        }
        if ($this->connections[$id]['state'] !== 'handshake') {
            $this->queue($id, $this->frame(0x8, pack('n', $code).substr($reason, 0, 120)));
        }
        if (! isset($this->connections[$id])) {
            return;
        }
        $this->connections[$id]['closing'] = true;
        $this->hub->leave($id, $this->now());
        if ($this->connections[$id]['out'] === '') {
            $this->drop($id);
        }
    }

    private function reject(int $id, int $status, string $reason): void
    {
        $this->connections[$id]['out'] .= "HTTP/1.1 $status $reason\r\nConnection: close\r\nContent-Length: 0\r\n\r\n";
        $this->connections[$id]['closing'] = true;
        $this->flush($id);
    }

    private function drop(int $id): void
    {
        if (! isset($this->connections[$id])) {
            return;
        }
        $socket = $this->connections[$id]['socket'];
        unset($this->connections[$id], $this->bySocket[get_resource_id($socket)]);
        $this->hub->leave($id, $this->now());
        @fclose($socket);
    }

    private function housekeeping(int $now): void
    {
        foreach ($this->connections as $id => $connection) {
            if ($connection['state'] !== 'open' && $now - $connection['opened'] > self::AUTH_TIMEOUT_MS) {
                $this->closeConnection($id, 4408, 'Authentication timeout');
                $this->drop($id);
            } elseif ($now - $connection['seen'] > self::IDLE_TIMEOUT_MS) {
                $this->drop($id);
            } elseif ($connection['state'] === 'open' && $now - $connection['pinged'] > self::PING_EVERY_MS) {
                $this->connections[$id]['pinged'] = $now;
                $this->queue($id, $this->frame(0x9, ''));
            }
        }
    }

    /** @param resource $socket */
    private function idFor($socket): ?int
    {
        return $this->bySocket[get_resource_id($socket)] ?? null;
    }

    private function now(): int
    {
        return intdiv(hrtime(true), 1_000_000);
    }
}
