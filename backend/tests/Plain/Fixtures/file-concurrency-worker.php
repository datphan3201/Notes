#!/usr/bin/env php
<?php

declare(strict_types=1);

use Planner\Domain\Files\UploadedFile;
use Planner\Http\HttpException;

$runtime = require dirname(__DIR__, 3).'/bootstrap/http.php';
$operation = $argv[1] ?? '';
$barrier = $argv[2] ?? '';
$userId = (int) ($argv[3] ?? 0);
$noteId = $argv[4] ?? '';
$attachmentId = $argv[5] ?? '';
$uploadPath = $argv[6] ?? '';
$deadline = microtime(true) + 10;

while (! file_exists($barrier) && microtime(true) < $deadline) {
    usleep(1_000);
}

if (! file_exists($barrier)) {
    fwrite(STDOUT, json_encode(['status' => 500, 'code' => 'BARRIER_TIMEOUT'], JSON_THROW_ON_ERROR));
    exit(1);
}

try {
    if ($operation === 'upload') {
        $size = filesize($uploadPath);
        $upload = new UploadedFile('concurrent.txt', $uploadPath, UPLOAD_ERR_OK, is_int($size) ? $size : -1);
        $inspected = $runtime['upload_validator']->inspectAttachment($upload);
        $result = $runtime['file_service']->uploadAttachment(
            $userId,
            $noteId,
            $attachmentId,
            $inspected,
        );
        $status = $result['replayed'] ? 200 : 201;
    } elseif ($operation === 'delete') {
        $runtime['file_service']->deleteAttachment($userId, $noteId, $attachmentId);
        $status = 204;
    } else {
        throw new RuntimeException('Unknown worker operation.');
    }

    fwrite(STDOUT, json_encode(['status' => $status], JSON_THROW_ON_ERROR));
} catch (HttpException $exception) {
    fwrite(STDOUT, json_encode([
        'status' => $exception->status,
        'code' => $exception->errorCode,
    ], JSON_THROW_ON_ERROR));
}
