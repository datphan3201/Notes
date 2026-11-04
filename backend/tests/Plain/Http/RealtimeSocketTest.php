<?php

declare(strict_types=1);

namespace Tests\Plain\Http;

use PDO;
use PHPUnit\Framework\TestCase;
use Planner\Infrastructure\Database\MigrationRunner;
use Planner\Infrastructure\Persistence\Pdo\Account\PdoAccountRepository;
use Planner\Infrastructure\Realtime\RealtimeTicket;
use Ramsey\Uuid\Uuid;
use RuntimeException;

/**
 * Runs bin/realtime.php as a real process against goals_test and talks
 * RFC 6455 to it over TCP: origin check, ticket auth, OT ack and broadcast.
 */
final class RealtimeSocketTest extends TestCase
{
    /** @var array<string, mixed> */
    private array $runtime;

    private PDO $pdo;

    /** @var resource|null */
    private $process = null;

    private int $port;

    private string $errorLog = '';

    protected function setUp(): void
    {
        if (session_status() === PHP_SESSION_ACTIVE) {
            session_write_close();
        }
        session_id('');
        $_SESSION = [];
        $this->runtime = require dirname(__DIR__, 3).'/bootstrap/http.php';
        $this->pdo = $this->runtime['pdo'];
        self::assertSame('goals_test', $this->pdo->query('SELECT DATABASE()')->fetchColumn());
        $this->wipe();
        (new MigrationRunner($this->pdo, dirname(__DIR__, 3).'/database/plain-migrations', 'goals_test'))->migrate();

        $this->port = random_int(20000, 39999);
        $env = [
            ...getenv(),
            'APP_ENV' => 'testing',
            'PLANNER_DB_DATABASE' => 'goals_test',
            'PLANNER_DB_ALLOWED' => 'goals_test',
            'APP_URL' => 'http://localhost:8000',
            'REALTIME_LISTEN' => '127.0.0.1:'.$this->port,
            'REALTIME_ENABLED' => 'true',
            'SESSION_ENCRYPTION_KEY' => (string) getenv('SESSION_ENCRYPTION_KEY'),
            'AI_ENABLED' => 'false',
        ];
        $this->process = proc_open(
            [PHP_BINARY, dirname(__DIR__, 3).'/bin/realtime.php'],
            // stderr goes to a file: an unread pipe could fill up and block the server.
            [0 => ['pipe', 'r'], 1 => ['pipe', 'w'], 2 => ['file', $this->errorLog = (string) tempnam(sys_get_temp_dir(), 'realtime-'), 'w']],
            $pipes,
            dirname(__DIR__, 3),
            $env,
        );
        self::assertIsResource($this->process);
        $line = fgets($pipes[1]);
        self::assertIsString($line, (string) file_get_contents($this->errorLog));
        self::assertStringContainsString('listening', $line);
    }

    protected function tearDown(): void
    {
        if (is_resource($this->process)) {
            proc_terminate($this->process);
            proc_close($this->process);
        }
        if ($this->errorLog !== '') {
            @unlink($this->errorLog);
        }
        $this->runtime['session']->close();
        session_id('');
        $_SESSION = [];
    }

    public function test_handshake_auth_operation_and_broadcast_over_tcp(): void
    {
        $accounts = new PdoAccountRepository($this->pdo);
        $owner = $accounts->insertUser('owner@example.test', 'Owner', password_hash('x-password-1', PASSWORD_BCRYPT), '2026-11-01 08:00:00.000000')->id;
        $noteId = strtolower(Uuid::uuid4()->toString());
        $this->pdo->prepare("INSERT INTO notes (id, user_id, title, content, color, version, created_at, updated_at) VALUES (?, ?, 'Plan', 'abc', 'neutral', 1, UTC_TIMESTAMP(6), UTC_TIMESTAMP(6))")->execute([$noteId, $owner]);
        /** @var RealtimeTicket $tickets */
        $tickets = $this->runtime['realtime_tickets'];
        $claims = ['user_id' => $owner, 'name' => 'Owner', 'owner_id' => $owner, 'note_id' => $noteId, 'permission' => 'owner'];

        [$rejected, $status] = $this->connect('https://evil.example');
        self::assertStringContainsString('403', $status);
        fclose($rejected);

        [$bad] = $this->connect('http://localhost:8000');
        $this->sendFrame($bad, json_encode(['type' => 'auth', 'ticket' => 'forged.ticket']));
        self::assertSame('BAD_TICKET', $this->readJson($bad)['code']);
        fclose($bad);

        [$first] = $this->connect('http://localhost:8000');
        $this->sendFrame($first, json_encode(['type' => 'auth', 'ticket' => $tickets->issue($claims, time())]));
        $init = $this->readJson($first);
        self::assertSame('init', $init['type']);
        self::assertSame('abc', $init['content']);

        [$second] = $this->connect('http://localhost:8000');
        $this->sendFrame($second, json_encode(['type' => 'auth', 'ticket' => $tickets->issue($claims, time())]));
        self::assertSame('init', $this->readJson($second)['type']);
        self::assertSame('peers', $this->readJson($first)['type']);

        // A long Vietnamese insert exercises the 16-bit length frame encoding.
        $insert = str_repeat('Kế hoạch ', 30);
        $this->sendFrame($first, json_encode(['type' => 'op', 'field' => 'content', 'rev' => 0, 'op' => [3, $insert]], JSON_UNESCAPED_UNICODE));
        self::assertSame(['type' => 'ack', 'field' => 'content', 'rev' => 1], $this->readJson($first));
        $broadcast = $this->readJson($second);
        self::assertSame('op', $broadcast['type']);
        self::assertSame([3, $insert], $broadcast['op']);

        // Leaving saves the merged text.
        fclose($first);
        fclose($second);
        $deadline = microtime(true) + 5;
        do {
            usleep(100_000);
            $content = $this->pdo->query("SELECT content FROM notes WHERE id = '$noteId'")->fetchColumn();
        } while ($content === 'abc' && microtime(true) < $deadline);
        self::assertSame('abc'.$insert, $content);
    }

    /** @return array{0:resource,1:string} */
    private function connect(string $origin): array
    {
        $socket = null;
        for ($attempt = 0; $attempt < 50 && ! is_resource($socket); $attempt++) {
            $socket = @stream_socket_client('tcp://127.0.0.1:'.$this->port, $code, $message, 1);
            if (! is_resource($socket)) {
                usleep(50_000);
            }
        }
        self::assertIsResource($socket);
        stream_set_timeout($socket, 3);
        $key = base64_encode(random_bytes(16));
        fwrite($socket, "GET /realtime HTTP/1.1\r\nHost: localhost\r\nUpgrade: websocket\r\nConnection: Upgrade\r\nSec-WebSocket-Key: $key\r\nSec-WebSocket-Version: 13\r\nOrigin: $origin\r\n\r\n");
        $response = '';
        while (! str_contains($response, "\r\n\r\n") && ! feof($socket)) {
            $chunk = fread($socket, 1);
            if ($chunk === false || $chunk === '') {
                break;
            }
            $response .= $chunk;
        }
        if (str_contains($response, '101')) {
            self::assertStringContainsString('Sec-WebSocket-Accept: '.base64_encode(sha1($key.'258EAFA5-E914-47DA-95CA-C5AB0DC85B11', true)), $response);
        }

        return [$socket, strtok($response, "\r\n") ?: ''];
    }

    /** @param resource $socket */
    private function sendFrame($socket, string $payload): void
    {
        $length = strlen($payload);
        $header = chr(0x81);
        if ($length < 126) {
            $header .= chr(0x80 | $length);
        } elseif ($length < 65536) {
            $header .= chr(0x80 | 126).pack('n', $length);
        } else {
            $header .= chr(0x80 | 127).pack('J', $length);
        }
        $mask = random_bytes(4);
        $masked = $payload ^ str_repeat($mask, intdiv($length, 4) + 1);
        fwrite($socket, $header.$mask.substr($masked, 0, $length));
    }

    /** @param resource $socket @return array<string, mixed> */
    private function readJson($socket): array
    {
        while (true) {
            $head = $this->readExactly($socket, 2);
            $opcode = ord($head[0]) & 0x0F;
            $length = ord($head[1]) & 0x7F;
            if ($length === 126) {
                $length = unpack('n', $this->readExactly($socket, 2))[1];
            } elseif ($length === 127) {
                $length = unpack('J', $this->readExactly($socket, 8))[1];
            }
            $payload = $length > 0 ? $this->readExactly($socket, $length) : '';
            if ($opcode === 0x1) {
                return json_decode($payload, true, flags: JSON_THROW_ON_ERROR);
            }
        }
    }

    /** @param resource $socket */
    private function readExactly($socket, int $length): string
    {
        $data = '';
        while (strlen($data) < $length) {
            $chunk = fread($socket, $length - strlen($data));
            if ($chunk === false || $chunk === '') {
                throw new RuntimeException('Socket closed or timed out.');
            }
            $data .= $chunk;
        }

        return $data;
    }

    private function wipe(): void
    {
        $tables = $this->pdo->query("SELECT table_name FROM information_schema.tables WHERE table_schema = 'goals_test' AND table_type = 'BASE TABLE'")->fetchAll(PDO::FETCH_COLUMN);
        $this->pdo->exec('SET FOREIGN_KEY_CHECKS = 0');
        try {
            foreach ($tables as $table) {
                if (! is_string($table) || preg_match('/^[a-z0-9_]+$/', $table) !== 1) {
                    throw new RuntimeException('Unsafe table.');
                }
                $this->pdo->exec("DROP TABLE `$table`");
            }
        } finally {
            $this->pdo->exec('SET FOREIGN_KEY_CHECKS = 1');
        }
    }
}
