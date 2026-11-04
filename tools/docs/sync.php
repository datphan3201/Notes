<?php

declare(strict_types=1);

namespace Planner\Documentation;

require_once __DIR__.'/routes.php';

/** @return array<string, mixed> */
function catalog(): array
{
    return json_decode(file_get_contents(dirname(__DIR__, 2).'/docs/traceability.json'), true, flags: JSON_THROW_ON_ERROR);
}

/** @param array{path:string,symbol:string} $reference */
function referenceLink(array $reference, string $document): string
{
    $root = dirname(__DIR__, 2);
    $source = file_get_contents($root.'/'.$reference['path']);
    $count = substr_count($source, $reference['symbol']);
    if ($count === 0) {
        throw new \RuntimeException('Missing source symbol: '.$reference['path'].' :: '.$reference['symbol']);
    }
    if ($count !== 1) {
        throw new \RuntimeException('Ambiguous source symbol ('.$count.' matches): '.$reference['path'].' :: '.$reference['symbol']);
    }
    $offset = strpos($source, $reference['symbol']);
    $line = substr_count(substr($source, 0, $offset), "\n") + 1;
    $prefix = str_repeat('../', count(explode('/', dirname($document))));
    $label = htmlspecialchars(basename($reference['path']).' · '.($reference['label'] ?? $reference['symbol']), ENT_NOQUOTES | ENT_SUBSTITUTE, 'UTF-8');
    $label = str_replace(['|', '[', ']'], ['&#124;', '&#91;', '&#93;'], $label);

    return '['.$label.']('.$prefix.$reference['path'].'#L'.$line.')';
}

/** @return array<string,string> Repository-relative output path => bytes. */
function generated(): array
{
    $root = dirname(__DIR__, 2);
    $catalog = catalog();
    $routes = routes();
    $byName = array_column($routes, null, 'name');
    $outputs = [];
    foreach ($catalog['pages'] as $page) {
        $document = $page['document'];
        if (array_key_exists($document, $outputs)) {
            throw new \RuntimeException('Duplicate UI document: '.$document);
        }
        $body = "<!-- BEGIN GENERATED TRACE -->\n";
        foreach ($page['components'] as $component) {
            $body .= "\n### ".$component['label']."\n\n";
            $body .= '**Trace ID:** `'.$component['id']."`\n\n".$component['behavior']."\n\n";
            $body .= "| Layer | Entry point |\n| --- | --- |\n";
            foreach (['ui' => 'UI / DOM', 'styles' => 'CSS', 'client' => 'Browser logic', 'server' => 'Controller / service / domain', 'storage' => 'Persistence', 'tests' => 'Relevant tests (not a pass claim)'] as $key => $label) {
                if (($component[$key] ?? []) !== []) {
                    $body .= '| '.$label.' | '.implode('<br>', array_map(static fn (array $reference): string => referenceLink($reference, $document), $component[$key]))." |\n";
                }
            }
            if (isset($component['test_scope'])) {
                $body .= '| Coverage limit | '.$component['test_scope']." |\n";
            }
            if (($component['routes'] ?? []) !== []) {
                $body .= '| HTTP | '.implode('<br>', array_map(static function (string $name) use ($byName, $document): string {
                    if (!isset($byName[$name])) {
                        throw new \RuntimeException('Unknown route name: '.$name);
                    }
                    $route = $byName[$name];

                    $prefix = str_repeat('../', count(explode('/', dirname($document))));
                    $handler = str_replace('Planner\\Http\\Controller\\', '', $route['handler']);

                    return '`'.implode('/', $route['methods']).' '.$route['path'].'` (`'.$name.'`) → ['.$handler.']('.$prefix.$route['handler_path'].'#L'.$route['handler_line'].')';
                }, $component['routes']))." |\n";
            }
        }
        $body .= "\n<!-- END GENERATED TRACE -->";
        $original = file_get_contents($root.'/'.$document);
        if (!str_contains($original, '<!-- BEGIN GENERATED TRACE -->')) {
            throw new \RuntimeException('Missing generated block in '.$document);
        }
        // One final newline: trailing blank lines after the generated block are not kept (ISSUE-007).
        $outputs[$document] = rtrim(preg_replace_callback('/<!-- BEGIN GENERATED TRACE -->.*?<!-- END GENERATED TRACE -->/s', static fn (): string => $body, $original))."\n";
    }
    $inventory = "# HTTP route inventory\n\nGenerated from route declarations without application/database bootstrap.\nUse the owning UI document to understand behavior; API URLs are not browser pages.\n\n| Methods | Path | Name | Auth | CSRF | Rate bucket | Owner document |\n| --- | --- | --- | --- | --- | --- | --- |\n";
    $csv = fopen('php://temp', 'r+');
    fputcsv($csv, ['route_id', 'methods', 'path', 'route_name', 'auth', 'csrf', 'rate_limit', 'handler', 'document', 'result', 'actual_status', 'notes'], escape: '');
    foreach ($routes as $index => $route) {
        $document = $catalog['route_documents'][$route['name']] ?? throw new \RuntimeException('Unmapped route: '.$route['name']);
        $inventory .= '| '.implode('&#124;', $route['methods']).' | `'.$route['path'].'` | `'.$route['name'].'` | '.($route['auth'] ? 'yes' : 'no').' | '.($route['csrf'] ? 'yes' : 'no').' | '.($route['rate_limit'] ?? '—').' | ['.basename($document).'](../'.substr($document, 5).") |\n";
        fputcsv($csv, [sprintf('R%03d', $index + 1), implode('|', $route['methods']), $route['path'], $route['name'], $route['auth'] ? 'yes' : 'no', $route['csrf'] ? 'yes' : 'no', $route['rate_limit'] ?? '', $route['handler'], $document, '', '', ''], escape: '');
    }
    rewind($csv);
    $outputs['docs/reference/routes.csv'] = "\xEF\xBB\xBF".stream_get_contents($csv);
    $outputs['docs/reference/routes.md'] = $inventory;

    // Navigation-only indexes share the registry; feature behavior stays in its
    // owning document rather than being copied into another maintained contract.
    $components = "# Component lookup\n\n[Documentation home](../README.md) · [Source-file lookup](source-index.md)\n\nGenerated from the trace registry. Find a visible label or stable Trace ID, then open its owning component.\n\n| Trace ID | Visible component | Page |\n| --- | --- | --- |\n";
    $sourceComponents = [];
    foreach ($catalog['pages'] as $page) {
        foreach ($page['components'] as $component) {
            $slug = preg_replace('/[^\p{L}\p{N}\s_-]/u', '', mb_strtolower($component['label']));
            $slug = str_replace(' ', '-', trim($slug));
            $target = '../'.substr($page['document'], 5).'#'.$slug;
            $components .= '| `'.$component['id'].'` | ['.$component['label'].']('.$target.') | '.$page['title']." |\n";
            foreach (['ui', 'styles', 'client', 'server', 'storage', 'tests'] as $layer) {
                foreach ($component[$layer] ?? [] as $source) {
                    $sourceComponents[$source['path']][$component['id']] = '['.$component['id'].']('.$target.')';
                }
            }
        }
    }
    ksort($sourceComponents);
    $inverse = "# Source-file lookup\n\n[Documentation home](../README.md) · [Component lookup](components.md)\n\nUse this index when a changed source file is known and the affected UI components are not. This is a registry-backed lookup, not a complete static dependency graph. Read imports/call sites for transitive effects.\n\n| Source file | Component traces |\n| --- | --- |\n";
    foreach ($sourceComponents as $path => $targets) {
        ksort($targets);
        $inverse .= '| ['.$path.'](../../'.$path.') | '.implode('<br>', $targets)." |\n";
    }
    $outputs['docs/reference/components.md'] = $components;
    $outputs['docs/reference/source-index.md'] = $inverse;

    return $outputs;
}

if (realpath($_SERVER['SCRIPT_FILENAME'] ?? '') === __FILE__) {
    $write = in_array('--write', $argv, true);
    $stale = [];
    foreach (generated() as $path => $bytes) {
        $fullPath = dirname(__DIR__, 2).'/'.$path;
        if (!is_file($fullPath) || file_get_contents($fullPath) !== $bytes) {
            $stale[] = $path;
            if ($write) {
                if (!is_dir(dirname($fullPath))) {
                    mkdir(dirname($fullPath), 0o755, true);
                }
                file_put_contents($fullPath, $bytes);
            }
        }
    }
    echo ($write ? 'Updated' : 'Stale').': '.count($stale).' generated documents.'.PHP_EOL;
    if (!$write && $stale !== []) {
        echo implode(PHP_EOL, $stale).PHP_EOL;
        exit(1);
    }
}
