<?php

declare(strict_types=1);

namespace Planner\Domain\Notes;

/**
 * Ranks Notes for a question. Lexical relevance is BM25 over accent-folded
 * words (so "ke hoach" still finds "kế hoạch"); semantic relevance is the
 * cosine similarity of embeddings. When embeddings are available the two are
 * blended, so a Note can be found by meaning even without a shared keyword.
 */
final class NoteRetrieval
{
    private const K1 = 1.2;

    private const B = 0.75;

    private const SEMANTIC_WEIGHT = 0.7;

    /** @return list<string> */
    public static function tokens(string $text): array
    {
        $folded = self::fold($text);
        preg_match_all('/[\p{L}\p{N}]{2,}/u', $folded, $matches);

        return $matches[0];
    }

    /** Lowercase and strip combining accents (đ → d as well). */
    public static function fold(string $text): string
    {
        $lower = mb_strtolower($text, 'UTF-8');
        $decomposed = \Normalizer::normalize($lower, \Normalizer::FORM_D) ?: $lower;
        $stripped = preg_replace('/\p{Mn}+/u', '', $decomposed) ?? $decomposed;

        return str_replace('đ', 'd', $stripped);
    }

    /**
     * BM25 scores normalized to 0..1 (the best document scores 1).
     *
     * @param array<string, string> $documents id => text
     * @return array<string, float>
     */
    public static function lexical(string $query, array $documents): array
    {
        $terms = array_values(array_unique(self::tokens($query)));
        if ($terms === [] || $documents === []) {
            return array_map(static fn (): float => 0.0, $documents);
        }
        $frequencies = [];
        $lengths = [];
        $documentFrequency = array_fill_keys($terms, 0);
        foreach ($documents as $id => $text) {
            $tokens = self::tokens($text);
            $lengths[$id] = max(1, count($tokens));
            $counts = array_count_values($tokens);
            $frequencies[$id] = $counts;
            foreach ($terms as $term) {
                if (isset($counts[$term])) {
                    $documentFrequency[$term]++;
                }
            }
        }
        $count = count($documents);
        $average = array_sum($lengths) / $count;
        $scores = [];
        foreach ($documents as $id => $_) {
            $score = 0.0;
            foreach ($terms as $term) {
                $frequency = $frequencies[$id][$term] ?? 0;
                if ($frequency === 0) {
                    continue;
                }
                $idf = log(1 + ($count - $documentFrequency[$term] + 0.5) / ($documentFrequency[$term] + 0.5));
                $score += $idf * ($frequency * (self::K1 + 1)) / ($frequency + self::K1 * (1 - self::B + self::B * $lengths[$id] / $average));
            }
            $scores[$id] = $score;
        }
        $max = max($scores);

        return array_map(static fn (float $score): float => $max > 0 ? $score / $max : 0.0, $scores);
    }

    /** @param list<float> $left @param list<float> $right */
    public static function cosine(array $left, array $right): float
    {
        $length = min(count($left), count($right));
        if ($length === 0) {
            return 0.0;
        }
        $dot = 0.0;
        $leftNorm = 0.0;
        $rightNorm = 0.0;
        for ($index = 0; $index < $length; $index++) {
            $dot += $left[$index] * $right[$index];
            $leftNorm += $left[$index] ** 2;
            $rightNorm += $right[$index] ** 2;
        }

        return $leftNorm > 0 && $rightNorm > 0 ? $dot / (sqrt($leftNorm) * sqrt($rightNorm)) : 0.0;
    }

    /**
     * Blends lexical scores with semantic similarities (null = no embeddings)
     * and returns the ids of the best $limit Notes, best first. Without
     * embeddings only Notes with a lexical match are returned.
     *
     * @param array<string, float> $lexical
     * @param array<string, float>|null $semantic
     * @return list<string>
     */
    public static function rank(array $lexical, ?array $semantic, int $limit): array
    {
        $combined = [];
        foreach ($lexical as $id => $score) {
            $combined[$id] = $semantic === null
                ? $score
                : self::SEMANTIC_WEIGHT * max(0.0, $semantic[$id] ?? 0.0) + (1 - self::SEMANTIC_WEIGHT) * $score;
        }
        if ($semantic === null) {
            $combined = array_filter($combined, static fn (float $score): bool => $score > 0);
        }
        // Stable order: higher score first, then the caller's (recency) order.
        $order = array_flip(array_map('strval', array_keys($lexical)));
        uksort($combined, static fn (string|int $a, string|int $b): int => [$combined[$b], $order[(string) $a]] <=> [$combined[$a], $order[(string) $b]]);

        return array_slice(array_map('strval', array_keys($combined)), 0, $limit);
    }
}
