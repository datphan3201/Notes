<?php

declare(strict_types=1);

/**
 * Exercise the real documentation commands in an isolated repository fixture.
 * The fixture has no environment secrets, installed packages, database or server.
 * Negative cases must fail for the intended diagnostic, not an unrelated error.
 */
$root = dirname(__DIR__, 3);
$fixture = sys_get_temp_dir().'/planner-docs-tests-'.bin2hex(random_bytes(8));
mkdir($fixture, 0o700);

function copyFixture(string $source, string $target): void
{
    if (is_link($source)) {
        // Retain repository-local skill discovery links in the isolated tree.
        global $root;
        $resolved = realpath($source);
        if ($resolved !== false && str_starts_with($resolved, $root.DIRECTORY_SEPARATOR)) {
            symlink(readlink($source), $target);
        }

        return;
    }
    if (is_dir($source)) {
        if (in_array(basename($source), ['vendor', 'node_modules', 'storage', 'build', '.phpunit.cache', '.venv', '.next', '__pycache__', '.pytest_cache', '.ruff_cache', '.private', 'test-results', 'playwright-report'], true)) {
            return;
        }
        if (!is_dir($target)) {
            mkdir($target, 0o700, true);
        }
        foreach (scandir($source) as $child) {
            if ($child !== '.' && $child !== '..') {
                copyFixture($source.'/'.$child, $target.'/'.$child);
            }
        }
    } elseif (!str_starts_with(basename($source), '.env') || basename($source) === '.env.example') {
        copy($source, $target);
    }
}

function removeFixture(string $path): void
{
    if (is_link($path) || !is_dir($path)) {
        unlink($path);

        return;
    }
    foreach (scandir($path) as $child) {
        if ($child !== '.' && $child !== '..') {
            removeFixture($path.'/'.$child);
        }
    }
    rmdir($path);
}

/** @return array{int,string} */
function command(string $fixture, string $script, array $arguments = []): array
{
    $process = proc_open([PHP_BINARY, $fixture.'/'.$script, ...$arguments], [0 => ['pipe', 'r'], 1 => ['pipe', 'w'], 2 => ['pipe', 'w']], $pipes, $fixture);
    fclose($pipes[0]);
    $output = stream_get_contents($pipes[1]).stream_get_contents($pipes[2]);
    fclose($pipes[1]);
    fclose($pipes[2]);

    return [proc_close($process), $output];
}

$saved = [];
$passed = 0;
$failed = 0;
$remember = static function (string $path) use (&$saved, $fixture): void {
    if (!array_key_exists($path, $saved)) {
        $saved[$path] = is_file($fixture.'/'.$path) ? file_get_contents($fixture.'/'.$path) : null;
    }
};
$write = static function (string $path, string $bytes) use ($remember, $fixture): void {
    $remember($path);
    file_put_contents($fixture.'/'.$path, $bytes);
};
$registry = static function (callable $edit) use ($fixture, $write): void {
    $data = json_decode(file_get_contents($fixture.'/docs/traceability.json'), true, flags: JSON_THROW_ON_ERROR);
    $edit($data);
    $write('docs/traceability.json', json_encode($data, JSON_PRETTY_PRINT | JSON_UNESCAPED_SLASHES | JSON_THROW_ON_ERROR).PHP_EOL);
};
$scenario = static function (string $name, callable $edit, string $expected, bool $success = false, string $script = 'tools/docs/check.php') use (&$saved, &$passed, &$failed, $fixture): void {
    try {
        $edit();
        [$code, $output] = command($fixture, $script);
        if (($code === 0) !== $success || !str_contains($output, $expected)) {
            throw new RuntimeException('Unexpected exit/output: '.$code.PHP_EOL.$output);
        }
        ++$passed;
        echo 'PASS '.$name.PHP_EOL;
    } catch (Throwable $error) {
        ++$failed;
        fwrite(STDERR, 'FAIL '.$name.': '.$error->getMessage().PHP_EOL);
    } finally {
        foreach ($saved as $path => $bytes) {
            if ($bytes === null) {
                unlink($fixture.'/'.$path);
            } else {
                file_put_contents($fixture.'/'.$path, $bytes);
            }
        }
        $saved = [];
    }
};

try {
    foreach (['docs', 'frontend', 'backend', 'apps', 'tools', '.github', '.agents', '.claude', 'compose.yaml', 'AGENTS.md', 'README.md', 'CHANGELOG.md', 'CLAUDE.md'] as $path) {
        copyFixture($root.'/'.$path, $fixture.'/'.$path);
    }
    symlink('backend/.ai', $fixture.'/.ai');
    mkdir($fixture.'/backend/vendor', 0o700);
    file_put_contents($fixture.'/backend/vendor/autoload.php', <<<'PHP'
<?php
spl_autoload_register(static function (string $class): void {
    if (str_starts_with($class, 'Planner'.chr(92))) {
        $path = dirname(__DIR__).'/src/'.str_replace(chr(92), '/', substr($class, 8)).'.php';
        if (is_file($path)) {
            require $path;
        }
    }
});
PHP);
    foreach (['app.php', 'http.php'] as $bootstrap) {
        file_put_contents($fixture.'/backend/bootstrap/'.$bootstrap, "<?php throw new RuntimeException('Application bootstrap is forbidden in documentation tests');\n");
    }
    $scenario('healthy docs work without application bootstrap or database', static fn () => null, 'PASS:', true);
    $scenario('missing source symbol is rejected', static function () use ($registry): void {
        $registry(static function (array &$data): void { $data['pages'][0]['components'][0]['ui'][0]['symbol'] = 'missing-fixture-symbol'; });
    }, 'Missing symbol:');
    $scenario('ambiguous source is rejected even if the old first match still exists', static function () use ($fixture, $write): void {
        $path = 'frontend/src/views/planning/tasks.php';
        $write($path, file_get_contents($fixture.'/'.$path)."\n<!-- data-tasks-page -->\n");
    }, 'Ambiguous symbol:');
    $scenario('generator also refuses an ambiguous source', static function () use ($fixture, $write): void {
        $path = 'frontend/src/views/planning/tasks.php';
        $write($path, file_get_contents($fixture.'/'.$path)."\n<!-- data-tasks-page -->\n");
    }, 'Ambiguous source symbol', script: 'tools/docs/sync.php');
    $scenario('a newly declared route needs explicit documentation ownership', static function () use ($fixture, $write): void {
        $path = 'backend/routes/web.php';
        $bytes = file_get_contents($fixture.'/'.$path);
        $needle = "        new Route(['GET'], '/up',";
        $addition = "        new Route(['GET'], '/fixture-undocumented', 'fixture.undocumented', static fn (): Response => Response::json(['data' => []])),\n";
        $write($path, str_replace($needle, $addition.$needle, $bytes));
    }, 'Unmapped route: fixture.undocumented');
    $scenario('a retired mapped route is rejected', static function () use ($registry): void {
        $registry(static function (array &$data): void { $data['route_documents']['fixture.retired'] = 'docs/ui/tasks/README.md'; });
    }, 'Retired route still mapped:');
    $scenario('duplicate component IDs are rejected', static function () use ($registry): void {
        $registry(static function (array &$data): void { $data['pages'][0]['components'][1]['id'] = $data['pages'][0]['components'][0]['id']; });
    }, 'Duplicate component:');
    $scenario('duplicate owning documents cannot silently overwrite a generated page', static function () use ($registry): void {
        $registry(static function (array &$data): void { $data['pages'][1]['document'] = $data['pages'][0]['document']; });
    }, 'Duplicate UI document:');
    $scenario('generator refuses duplicate owning documents before writing', static function () use ($registry): void {
        $registry(static function (array &$data): void { $data['pages'][1]['document'] = $data['pages'][0]['document']; });
    }, 'Duplicate UI document:', script: 'tools/docs/sync.php');
    $scenario('a broken relative link is rejected', static function () use ($fixture, $write): void {
        $write('README.md', file_get_contents($fixture.'/README.md')."\n[Broken](docs/fixture-missing.md)\n");
    }, 'Broken/outside link');
    $scenario('a missing heading anchor is rejected', static function () use ($fixture, $write): void {
        $write('README.md', file_get_contents($fixture.'/README.md')."\n[Broken heading](docs/issues.md#fixture-missing-heading)\n");
    }, 'Missing heading anchor');
    $scenario('a new untraced PHP view is rejected', static function () use ($write): void {
        $write('frontend/src/views/fixture-untraced.php', '<section>Fixture</section>');
    }, 'UI template has no trace component:');
    $scenario('retired duplicate issue documentation cannot be reintroduced silently', static function () use ($write): void {
        $write('docs/testing/known-issues.md', '# Retired duplicate issue fixture');
    }, 'Retired documentation remains: docs/testing/known-issues.md');
    $scenario('editing a generated block is detected', static function () use ($fixture, $write): void {
        $path = 'docs/ui/tasks/README.md';
        $write($path, str_replace('<!-- BEGIN GENERATED TRACE -->', "<!-- BEGIN GENERATED TRACE -->\nFixture drift", file_get_contents($fixture.'/'.$path)));
    }, 'Stale generated output:');
    $scenario('editing a diagram after delivery invalidates its receipt', static function () use ($fixture, $write): void {
        $path = 'docs/diagrams/system/candidate.json';
        $write($path, file_get_contents($fixture.'/'.$path)."\n");
    }, 'Diagram changed after final receipt:');
    $scenario('duplicate manual checklist IDs are rejected', static function () use ($fixture, $write): void {
        $path = 'docs/testing/manual-checklist.md';
        $write($path, file_get_contents($fixture.'/'.$path)."\n- [ ] P01 — Duplicate fixture.\n");
    }, 'Duplicate manual checklist case ID.');
    $scenario('regeneration repairs a legitimate label/anchor change across indexes', static function () use ($fixture, $registry, $remember): void {
        $data = json_decode(file_get_contents($fixture.'/docs/traceability.json'), true, flags: JSON_THROW_ON_ERROR);
        foreach ([...array_column($data['pages'], 'document'), 'docs/reference/routes.csv', 'docs/reference/routes.md', 'docs/reference/components.md', 'docs/reference/source-index.md'] as $path) {
            $remember($path);
        }
        $registry(static function (array &$data): void { $data['pages'][0]['components'][0]['label'] = 'Fixture collection heading'; });
        [$code, $output] = command($fixture, 'tools/docs/sync.php', ['--write']);
        if ($code !== 0) {
            throw new RuntimeException($output);
        }
    }, 'PASS:', true);
    printf("%d passed; %d failed. Application data and live repository fixtures were not mutated.\n", $passed, $failed);
} finally {
    removeFixture($fixture);
}
exit($failed === 0 ? 0 : 1);
