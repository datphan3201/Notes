<?php
// The guide's text lives in one file per interface language; screenshots come from the demo
// accounts made by tools/guide (backend/public/guide/<language>/<name>.webp).
$language = ($preferences['locale'] ?? 'en') === 'vi' ? 'vi' : 'en';
/** A screenshot that opens full size in a new tab. */
$shot = static function (string $name, string $alt, string $caption = '') use ($view, $language): string {
    $src = '/guide/'.$language.'/'.$name.'.webp';
    $figure = '<figure class="guide-shot"><a href="'.$view->e($src).'" target="_blank" rel="noopener">'
        .'<img src="'.$view->e($src).'" alt="'.$view->e($alt).'" width="1280" height="800" loading="lazy" decoding="async"></a>';
    if ($caption !== '') {
        $figure .= '<figcaption>'.$view->e($caption).'</figcaption>';
    }

    return $figure.'</figure>';
};
/** A phone screenshot, shown narrower. */
$phone = static function (string $name, string $alt) use ($view, $language): string {
    $src = '/guide/'.$language.'/'.$name.'.webp';

    return '<figure class="guide-shot is-phone"><img src="'.$view->e($src).'" alt="'.$view->e($alt).'" width="390" height="844" loading="lazy" decoding="async"></figure>';
};
?>
<article class="guide-page" data-guide-page lang="<?= $language ?>">
    <?php require __DIR__.'/guide-'.$language.'.php'; ?>
</article>
