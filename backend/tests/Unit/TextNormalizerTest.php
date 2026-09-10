<?php

namespace Tests\Unit;

use App\Support\NoteSnapshot;
use App\Support\TextNormalizer;
use PHPUnit\Framework\TestCase;

class TextNormalizerTest extends TestCase
{
    public function test_body_preserves_indentation_but_canonicalizes_line_endings(): void
    {
        self::assertSame("  dòng một\n\tdòng hai\n", TextNormalizer::body("  dòng một\r\n\tdòng hai\r"));
    }

    public function test_snapshot_sorts_and_deduplicates_label_ids(): void
    {
        self::assertSame([
            'title' => 'Tiêu đề',
            'content' => "Nội dung\n",
            'color' => 'mint',
            'is_pinned' => true,
            'label_ids' => ['2', '10'],
        ], NoteSnapshot::fromInput([
            'title' => '  Tiêu đề  ',
            'content' => "Nội dung\r\n",
            'color' => 'mint',
            'is_pinned' => 1,
            'label_ids' => [10, 2, 10],
        ]));
    }
}
