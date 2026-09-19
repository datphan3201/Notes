<?php

declare(strict_types=1);

namespace Tests\Plain\Unit;

use PHPUnit\Framework\TestCase;
use Planner\Http\View\AssetManifest;
use Planner\Http\View\ViewContext;
use Planner\Http\View\ViewRenderer;
use RuntimeException;

final class ViewTest extends TestCase
{
    private string $root;

    protected function setUp(): void
    {
        $this->root = sys_get_temp_dir().'/planner-view-'.bin2hex(random_bytes(8));
        mkdir($this->root.'/public/build/assets', 0o700, true);
        mkdir($this->root.'/views/layouts', 0o700, true);
        file_put_contents($this->root.'/public/build/assets/app.css', 'body{}');
        file_put_contents($this->root.'/public/build/assets/app.js', 'export{}');
        file_put_contents($this->root.'/public/build/manifest.json', json_encode([
            'src/css/app.css' => ['file' => 'assets/app.css', 'isEntry' => true],
            'src/js/app.js' => ['file' => 'assets/app.js', 'isEntry' => true, 'css' => ['assets/app.css']],
        ], JSON_THROW_ON_ERROR));
    }

    protected function tearDown(): void
    {
        $iterator = new \RecursiveIteratorIterator(
            new \RecursiveDirectoryIterator($this->root, \FilesystemIterator::SKIP_DOTS),
            \RecursiveIteratorIterator::CHILD_FIRST,
        );

        foreach ($iterator as $item) {
            $item->isDir() ? rmdir($item->getPathname()) : unlink($item->getPathname());
        }

        rmdir($this->root);
    }

    public function test_manifest_emits_each_asset_once_and_rejects_unsafe_paths(): void
    {
        $assets = new AssetManifest($this->root.'/public', null, 'production');
        $tags = $assets->tags(['src/css/app.css', 'src/js/app.js']);

        self::assertSame(1, substr_count($tags, '/build/assets/app.css'));
        self::assertSame(1, substr_count($tags, '/build/assets/app.js'));

        file_put_contents($this->root.'/public/build/manifest.json', json_encode([
            'src/js/app.js' => ['file' => '../secret.js'],
        ], JSON_THROW_ON_ERROR));

        $this->expectException(RuntimeException::class);
        $assets->tags(['src/js/app.js']);
    }

    public function test_manifest_rejects_missing_invalid_and_nonlocal_development_configuration(): void
    {
        unlink($this->root.'/public/build/manifest.json');

        try {
            (new AssetManifest($this->root.'/public', null, 'production'))->tags(['src/js/app.js']);
            self::fail('Missing manifests must be rejected.');
        } catch (RuntimeException $exception) {
            self::assertStringContainsString('missing', $exception->getMessage());
        }

        file_put_contents($this->root.'/public/build/manifest.json', '{');

        try {
            (new AssetManifest($this->root.'/public', null, 'production'))->tags(['src/js/app.js']);
            self::fail('Invalid manifests must be rejected.');
        } catch (RuntimeException $exception) {
            self::assertStringContainsString('invalid', $exception->getMessage());
        }

        $this->expectException(RuntimeException::class);
        (new AssetManifest($this->root.'/public', 'https://example.test:5173', 'local'))
            ->tags(['src/js/app.js']);
    }

    public function test_renderer_escapes_html_and_bootstrap_json_attributes(): void
    {
        file_put_contents($this->root.'/views/page.php', <<<'PHP'
<p><?= $view->e($name) ?></p><meta data-json="<?= $view->jsonAttribute($bootstrap) ?>">
PHP);
        $renderer = new ViewRenderer(
            $this->root.'/views',
            new ViewContext(new AssetManifest($this->root.'/public', null, 'production')),
        );
        $html = $renderer->render('page', [
            'name' => '<script>alert(1)</script>',
            'bootstrap' => ['name' => '</meta><script>alert(2)</script>'],
        ]);

        self::assertStringNotContainsString('<script>alert', $html);
        self::assertStringContainsString('&lt;script&gt;alert(1)&lt;/script&gt;', $html);
        self::assertStringContainsString('\\u003C\\/meta\\u003E\\u003Cscript\\u003E', html_entity_decode($html));
    }
}
