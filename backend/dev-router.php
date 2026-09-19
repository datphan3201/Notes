<?php

declare(strict_types=1);

$path = parse_url((string) ($_SERVER['REQUEST_URI'] ?? '/'), PHP_URL_PATH);
$publicPath = __DIR__.'/public'.(is_string($path) ? $path : '/');

if (is_string($path) && $path !== '/' && is_file($publicPath)) {
    return false;
}

require __DIR__.'/public/index.php';
