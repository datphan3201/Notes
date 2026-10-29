<?php

declare(strict_types=1);

// A one-connection SMTP server for transport tests.
// Usage: php fake-smtp-server.php <port-file> <transcript-file> [accept|reject-auth]
$mode = $argv[3] ?? 'accept';
$server = stream_socket_server('tcp://127.0.0.1:0', $code, $error);
if ($server === false) {
    fwrite(STDERR, $error);
    exit(1);
}
$name = (string) stream_socket_get_name($server, false);
file_put_contents($argv[1], substr((string) strrchr($name, ':'), 1));
$client = stream_socket_accept($server, 10);
if ($client === false) {
    exit(1);
}
$log = fopen($argv[2], 'w');
$send = static function (string $reply) use ($client): void {
    fwrite($client, $reply."\r\n");
};
$send('220 fake.test ESMTP ready');
$inData = false;
while (($line = fgets($client)) !== false) {
    fwrite($log, $line);
    if ($inData) {
        if ($line === ".\r\n") {
            $inData = false;
            $send('250 2.0.0 queued');
        }
        continue;
    }
    $upper = strtoupper($line);
    if (str_starts_with($upper, 'EHLO')) {
        $send("250-fake.test greets you\r\n250-AUTH PLAIN LOGIN\r\n250 8BITMIME");
    } elseif (str_starts_with($upper, 'AUTH')) {
        $send($mode === 'reject-auth' ? '535 5.7.8 Authentication failed' : '235 2.7.0 Accepted');
    } elseif (str_starts_with($upper, 'MAIL FROM') || str_starts_with($upper, 'RCPT TO')) {
        $send('250 2.1.0 OK');
    } elseif (str_starts_with($upper, 'DATA')) {
        $inData = true;
        $send('354 End data with <CR><LF>.<CR><LF>');
    } elseif (str_starts_with($upper, 'QUIT')) {
        $send('221 2.0.0 Bye');
        break;
    } else {
        $send('500 5.5.1 Unknown command');
    }
}
fclose($log);
fclose($client);
