<?php

// Converts the PNG screenshots made by capture.mjs to WebP for the user guide.
//
//   php tools/guide/publish.php <shots-dir>
//
// <shots-dir>/<lang>/<name>.png becomes backend/public/guide/<lang>/<name>.webp. Screenshots
// no longer produced are removed so the folder always matches the guide.

declare(strict_types=1);

$source = rtrim($argv[1] ?? exit("Usage: php tools/guide/publish.php <shots-dir>\n"), '/');
if (!function_exists('imagewebp')) {
    exit("PHP GD with WebP support is required.\n");
}
$target = dirname(__DIR__, 2).'/backend/public/guide';
foreach (['vi', 'en'] as $language) {
    $files = glob("$source/$language/*.png") ?: [];
    if ($files === []) {
        exit("No screenshots in $source/$language.\n");
    }
    @mkdir("$target/$language", 0775, true);
    $written = [];
    foreach ($files as $file) {
        $name = basename($file, '.png');
        $image = imagecreatefrompng($file) ?: exit("Cannot read $file\n");
        imagewebp($image, "$target/$language/$name.webp", 82);
        $written[] = "$name.webp";
    }
    foreach (glob("$target/$language/*.webp") ?: [] as $old) {
        if (!in_array(basename($old), $written, true)) {
            unlink($old);
        }
    }
    printf("%s: %d screenshots, %d KB\n", $language, count($written), array_sum(array_map(static fn (string $f): int => (int) filesize("$target/$language/$f"), $written)) / 1024);
}
