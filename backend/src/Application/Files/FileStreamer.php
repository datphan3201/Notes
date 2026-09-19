<?php

declare(strict_types=1);

namespace Planner\Application\Files;

use Planner\Domain\Files\AttachmentRecord;
use Planner\Http\HttpException;
use Planner\Http\Request;
use Planner\Http\Response;

final class FileStreamer
{
    public function attachment(AttachmentRecord $attachment, string $path, Request $request, bool $preview): Response
    {
        if ($preview && ! in_array($attachment->kind, ['image', 'video'], true)) {
            throw new HttpException(404, 'NOT_FOUND', 'The requested resource was not found.');
        }

        $size = filesize($path);

        if (! is_int($size)) {
            throw new HttpException(404, 'NOT_FOUND', 'The requested resource was not found.');
        }

        $range = $this->range($request->header('range'), $size);
        $headers = [
            'Content-Type' => $preview ? $attachment->mimeType : 'application/octet-stream',
            'Content-Disposition' => $preview ? 'inline' : $this->downloadDisposition($attachment->originalName),
            'Accept-Ranges' => 'bytes',
        ];

        if ($range === null) {
            return new Response(416, [
                ...$headers,
                'Content-Range' => 'bytes */'.$size,
                'Content-Length' => '0',
            ]);
        }

        [$start, $end, $partial] = $range;
        $length = $end >= $start ? $end - $start + 1 : 0;
        $status = $partial ? 206 : 200;
        $headers['Content-Length'] = (string) $length;

        if ($partial) {
            $headers['Content-Range'] = "bytes $start-$end/$size";
        }

        return Response::stream(
            static function () use ($path, $start, $length): void {
                $handle = @fopen($path, 'rb');

                if ($handle === false) {
                    return;
                }

                try {
                    if ($start > 0) {
                        fseek($handle, $start);
                    }

                    $remaining = $length;

                    while ($remaining > 0 && ! feof($handle)) {
                        $chunk = fread($handle, min(65_536, $remaining));

                        if ($chunk === false || $chunk === '') {
                            break;
                        }

                        echo $chunk;
                        $remaining -= strlen($chunk);
                    }
                } finally {
                    fclose($handle);
                }
            },
            $status,
            $headers,
        );
    }

    public function avatar(string $path): Response
    {
        $size = filesize($path);

        if (! is_int($size)) {
            throw new HttpException(404, 'NOT_FOUND', 'The requested resource was not found.');
        }

        return Response::stream(static function () use ($path): void {
            $handle = @fopen($path, 'rb');

            if ($handle === false) {
                return;
            }

            try {
                fpassthru($handle);
            } finally {
                fclose($handle);
            }
        }, headers: [
            'Content-Type' => 'image/jpeg',
            'Content-Disposition' => 'inline',
            'Content-Length' => (string) $size,
        ]);
    }

    /** @return ?array{int,int,bool} */
    private function range(?string $header, int $size): ?array
    {
        if ($header === null || trim($header) === '') {
            return [0, max(0, $size - 1), false];
        }

        if ($size < 1 || str_contains($header, ',')
            || preg_match('/^bytes=(\d*)-(\d*)$/D', trim($header), $match) !== 1
            || ($match[1] === '' && $match[2] === '')) {
            return null;
        }

        if ($match[1] === '') {
            $suffix = (int) $match[2];

            if ($suffix < 1) {
                return null;
            }

            $start = max(0, $size - $suffix);
            $end = $size - 1;
        } else {
            $start = (int) $match[1];
            $end = $match[2] === '' ? $size - 1 : (int) $match[2];

            if ($start >= $size || $end < $start) {
                return null;
            }

            $end = min($end, $size - 1);
        }

        return [$start, $end, true];
    }

    private function downloadDisposition(string $name): string
    {
        $safeName = preg_replace('/[\x00-\x1F\x7F"\\\\]/u', '_', $name) ?: 'download';
        $ascii = iconv('UTF-8', 'ASCII//TRANSLIT//IGNORE', $safeName);
        $ascii = is_string($ascii) ? preg_replace('/[^A-Za-z0-9._ -]/', '_', $ascii) : null;
        $ascii = trim((string) $ascii, ' .');

        if ($ascii === '') {
            $ascii = 'download';
        }

        return 'attachment; filename="'.$ascii.'"; filename*=UTF-8\'\''.rawurlencode($safeName);
    }
}
