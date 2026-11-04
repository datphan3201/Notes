<?php

declare(strict_types=1);

namespace Tests\Plain\Unit;

use PHPUnit\Framework\TestCase;
use Planner\Domain\Notes\NoteRetrieval;

final class NoteRetrievalTest extends TestCase
{
    public function test_folding_matches_vietnamese_text_with_or_without_accents(): void
    {
        self::assertSame(['ke', 'hoach', 'di', 'da', 'lat'], NoteRetrieval::tokens('Kế hoạch đi Đà Lạt!'));
        $scores = NoteRetrieval::lexical('ke hoach da lat', [
            'trip' => 'Kế hoạch đi Đà Lạt tháng sau',
            'work' => 'Báo cáo công việc quý ba',
        ]);
        self::assertSame(1.0, $scores['trip']);
        self::assertSame(0.0, $scores['work']);
    }

    public function test_rare_terms_outweigh_common_ones(): void
    {
        $scores = NoteRetrieval::lexical('budget meeting', [
            'a' => 'meeting notes meeting agenda',
            'b' => 'budget review',
            'c' => 'meeting about lunch',
        ]);
        self::assertGreaterThan($scores['a'], $scores['b']);
    }

    public function test_semantic_scores_find_a_note_without_shared_keywords(): void
    {
        $lexical = ['cats' => 0.0, 'cars' => 0.0, 'recent' => 0.0];
        self::assertSame([], NoteRetrieval::rank($lexical, null, 3));
        $semantic = ['cats' => 0.91, 'cars' => 0.12, 'recent' => -0.3];
        self::assertSame(['cats', 'cars', 'recent'], NoteRetrieval::rank($lexical, $semantic, 3));
        self::assertSame(['cats'], NoteRetrieval::rank($lexical, $semantic, 1));
    }

    public function test_ties_keep_the_callers_recency_order(): void
    {
        self::assertSame(['new', 'old'], NoteRetrieval::rank(['new' => 0.5, 'old' => 0.5], null, 5));
        self::assertSame(['b', 'a'], NoteRetrieval::rank(['a' => 0.2, 'b' => 0.9], null, 5));
    }

    public function test_cosine_similarity(): void
    {
        self::assertEqualsWithDelta(1.0, NoteRetrieval::cosine([1.0, 2.0], [2.0, 4.0]), 1e-9);
        self::assertEqualsWithDelta(0.0, NoteRetrieval::cosine([1.0, 0.0], [0.0, 1.0]), 1e-9);
        self::assertSame(0.0, NoteRetrieval::cosine([], [1.0]));
        self::assertSame(0.0, NoteRetrieval::cosine([0.0, 0.0], [1.0, 1.0]));
    }
}
