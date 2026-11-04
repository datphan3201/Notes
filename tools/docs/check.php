<?php

declare(strict_types=1);

namespace Planner\Documentation;

require_once __DIR__.'/sync.php';

$root = dirname(__DIR__, 2);
$errors = [];
$catalog = catalog();
$routes = routes();
$names = array_column($routes, 'name');
if (count($names) !== count(array_unique($names))) {
    $errors[] = 'Duplicate route name in declarations.';
}
foreach (array_diff($names, array_keys($catalog['route_documents'])) as $name) {
    $errors[] = 'Unmapped route: '.$name;
}
foreach (array_diff(array_keys($catalog['route_documents']), $names) as $name) {
    $errors[] = 'Retired route still mapped: '.$name;
}
foreach ($catalog['route_documents'] as $name => $document) {
    if (!is_file($root.'/'.$document)) {
        $errors[] = 'Missing route owner: '.$name.' → '.$document;
    }
}
$ids = [];
$sources = [];
$documents = [];
foreach ($catalog['pages'] as $page) {
    if (in_array($page['document'], $documents, true)) {
        $errors[] = 'Duplicate UI document: '.$page['document'];
    }
    $documents[] = $page['document'];
    foreach ($page['components'] as $component) {
        if (isset($ids[$component['id']])) {
            $errors[] = 'Duplicate component: '.$component['id'];
        }
        $ids[$component['id']] = true;
        foreach (['ui', 'styles', 'client', 'server', 'storage', 'tests'] as $layer) {
            foreach ($component[$layer] ?? [] as $source) {
                $sources[$source['path']] = true;
                if (!is_file($root.'/'.$source['path'])) {
                    $errors[] = 'Missing source: '.$source['path'];
                } elseif (!str_contains(file_get_contents($root.'/'.$source['path']), $source['symbol'])) {
                    $errors[] = 'Missing symbol: '.$source['path'].' :: '.$source['symbol'];
                } elseif (substr_count(file_get_contents($root.'/'.$source['path']), $source['symbol']) !== 1) {
                    $errors[] = 'Ambiguous symbol: '.$source['path'].' :: '.$source['symbol'];
                }
            }
        }
        foreach ($component['routes'] ?? [] as $name) {
            if (!in_array($name, $names, true)) {
                $errors[] = 'Unknown component route: '.$component['id'].' → '.$name;
            }
        }
    }
}
foreach (new \RecursiveIteratorIterator(new \RecursiveDirectoryIterator($root.'/frontend/src/views', \FilesystemIterator::SKIP_DOTS)) as $file) {
    if ($file->getExtension() === 'php') {
        $path = substr($file->getPathname(), strlen($root) + 1);
        if (!isset($sources[$path])) {
            $errors[] = 'UI template has no trace component: '.$path;
        }
    }
}
$files = [];
foreach (['docs', 'backend/.ai/rules'] as $directory) {
    if (!is_dir($root.'/'.$directory)) {
        continue;
    }
    foreach (new \RecursiveIteratorIterator(new \RecursiveDirectoryIterator($root.'/'.$directory, \FilesystemIterator::SKIP_DOTS)) as $file) {
        if ($file->getExtension() === 'md') {
            $files[] = $file->getPathname();
        }
    }
}
foreach (['README.md', 'CHANGELOG.md', 'AGENTS.md', 'CLAUDE.md'] as $file) {
    $files[] = $root.'/'.$file;
}

/** @return list<string> */
function anchors(string $markdown): array
{
    preg_match_all('/^#{1,6}\s+(.+)$/m', $markdown, $headings);
    $slugs = [];
    $duplicates = [];
    foreach ($headings[1] as $heading) {
        $slug = preg_replace('/[^\p{L}\p{N}\s_-]/u', '', mb_strtolower(strip_tags($heading)));
        $slug = str_replace(' ', '-', trim($slug));
        $count = $duplicates[$slug] ?? 0;
        $duplicates[$slug] = $count + 1;
        $slugs[] = $slug.($count > 0 ? '-'.$count : '');
    }

    return $slugs;
}
$links = 0;
foreach ($files as $file) {
    $markdown = file_get_contents($file);
    preg_match_all('/\[[^\]\n]*\]\(([^)\s]+)\)/', $markdown, $matches);
    foreach ($matches[1] as $target) {
        if (preg_match('#^(?:https?://|mailto:|app://|plugin://)#', $target)) {
            continue;
        }
        ++$links;
        [$path, $anchor] = array_pad(explode('#', trim($target, '<>'), 2), 2, null);
        $resolved = realpath($path === '' ? $file : dirname($file).'/'.rawurldecode($path));
        if ($resolved === false || !str_starts_with($resolved, $root.'/')) {
            $errors[] = 'Broken/outside link in '.substr($file, strlen($root) + 1).': '.$target;
            continue;
        }
        if ($anchor !== null && $anchor !== '' && is_file($resolved)) {
            if (preg_match('/^L(\d+)(?:-L\d+)?$/', $anchor, $line)) {
                if ((int) $line[1] > count(file($resolved))) {
                    $errors[] = 'Source line out of bounds: '.$target;
                }
            } elseif (str_ends_with($resolved, '.md') && !in_array($anchor, anchors(file_get_contents($resolved)), true)) {
                $errors[] = 'Missing heading anchor in '.substr($file, strlen($root) + 1).': '.$target;
            }
        }
    }
}
try {
    foreach (generated() as $path => $bytes) {
        if (!is_file($root.'/'.$path) || file_get_contents($root.'/'.$path) !== $bytes) {
            $errors[] = 'Stale generated output: '.$path.' (run php tools/docs/sync.php --write)';
        }
    }
} catch (\Throwable $exception) {
    $errors[] = $exception->getMessage();
}
foreach (['docs/plan', '.archify', 'PLAN.md', 'agent.md', 'docs/implementation-status.md', 'docs/verification.md', 'docs/testing/known-issues.md'] as $retired) {
    if (file_exists($root.'/'.$retired)) {
        $errors[] = 'Retired documentation remains: '.$retired;
    }
}
$diagrams = 0;
foreach (glob($root.'/docs/diagrams/*/candidate.json') as $candidatePath) {
    ++$diagrams;
    $directory = dirname($candidatePath);
    $receiptPath = $directory.'/index.finalize-summary.json';
    if (!is_file($receiptPath) || !is_file($directory.'/index.html')) {
        $errors[] = 'Diagram has no final artifact/receipt: '.$directory;
        continue;
    }
    $receipt = json_decode(file_get_contents($receiptPath), true, flags: JSON_THROW_ON_ERROR);
    if (($receipt['ok'] ?? false) !== true || count($receipt['gates'] ?? []) !== 4 || array_filter($receipt['gates'], static fn (string $gate): bool => $gate !== 'pass') !== []) {
        $errors[] = 'Diagram gates did not all pass: '.$directory;
    }
    if (($receipt['specification']['sha256'] ?? '') !== hash_file('sha256', $candidatePath)
        || ($receipt['artifact']['sha256'] ?? '') !== hash_file('sha256', $directory.'/index.html')) {
        $errors[] = 'Diagram changed after final receipt: '.$directory;
    }
}
$checklist = file_get_contents($root.'/docs/testing/manual-checklist.md');
preg_match_all('/^- \[ \] ([A-Z]+\d+)\b/m', $checklist, $cases);
if (count($cases[1]) !== count(array_unique($cases[1]))) {
    $errors[] = 'Duplicate manual checklist case ID.';
}
if ($errors !== []) {
    fwrite(STDERR, implode(PHP_EOL, array_unique($errors)).PHP_EOL);
    exit(1);
}
printf("PASS: %d routes (%d method/path pairs), %d UI documents, %d components, %d source files, %d Markdown links, %d diagram receipts, %d unique manual cases. No database or web server was booted.\n", count($routes), array_sum(array_map(static fn (array $route): int => count($route['methods']), $routes)), count($documents), count($ids), count($sources), $links, $diagrams, count($cases[1]));
