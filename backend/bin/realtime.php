#!/usr/bin/env php
<?php

declare(strict_types=1);

/*
 * Live collaboration server for shared Notes (WebSocket, RFC 6455).
 *
 *   php bin/realtime.php            listens on REALTIME_LISTEN (default 127.0.0.1:8090)
 *
 * Browsers connect to REALTIME_PUBLIC_URL, or to /realtime on the app origin when a
 * reverse proxy (Apache, Nginx, Cloudflare Tunnel) forwards that path here. Run it
 * under a supervisor (systemd) so it restarts after a crash or a lost database link.
 */

use Planner\Application\Notes\NoteCollaborationService;
use Planner\Application\Notes\NoteValidator;
use Planner\Http\Validation\InputValidator;
use Planner\Infrastructure\Logging\LoggerFactory;
use Planner\Infrastructure\Persistence\Pdo\Notes\PdoNoteShareRepository;
use Planner\Infrastructure\Realtime\CollaborationHub;
use Planner\Infrastructure\Realtime\WebSocketServer;

$runtime = require dirname(__DIR__).'/bootstrap/http.php';
$config = $runtime['config'];
if (! $config->bool('realtime.enabled') || $runtime['realtime_tickets'] === null) {
    fwrite(STDERR, "Live collaboration is disabled (REALTIME_ENABLED=false).\n");
    exit(1);
}

$logger = (new LoggerFactory($config))->create();
$collaboration = new NoteCollaborationService(
    $runtime['note_repository'],
    new PdoNoteShareRepository($runtime['pdo']),
    $runtime['note_service'],
    new NoteValidator(new InputValidator),
);

// Browsers send their page origin; only the app's own origin may connect.
$appUrl = parse_url($config->string('app.url'));
$origins = [$appUrl['scheme'].'://'.$appUrl['host'].(isset($appUrl['port']) ? ':'.$appUrl['port'] : '')];

$server = new WebSocketServer(
    $config->string('realtime.listen'),
    $origins,
    $runtime['realtime_tickets'],
    static fn (Closure $send, Closure $close): CollaborationHub => new CollaborationHub($collaboration, $send, $close, $logger),
    $logger,
    // Keeps the long-lived MySQL connection from idling out; a failure exits so the supervisor restarts us.
    static function () use ($runtime, $logger): void {
        try {
            $runtime['pdo']->query('SELECT 1');
        } catch (Throwable $exception) {
            $logger->critical('Realtime database link lost; exiting for restart.', ['error' => $exception->getMessage()]);
            exit(1);
        }
    },
);

if (function_exists('pcntl_async_signals')) {
    pcntl_async_signals(true);
    pcntl_signal(SIGTERM, static fn () => $server->stop());
    pcntl_signal(SIGINT, static fn () => $server->stop());
}

fwrite(STDOUT, 'Realtime server listening on '.$config->string('realtime.listen').' for '.implode(', ', $origins).PHP_EOL);
$server->run();
