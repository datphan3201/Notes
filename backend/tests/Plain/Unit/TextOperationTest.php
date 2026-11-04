<?php

declare(strict_types=1);

namespace Tests\Plain\Unit;

use PHPUnit\Framework\TestCase;
use Planner\Domain\Realtime\TextOperation;

final class TextOperationTest extends TestCase
{
    public function test_apply_counts_utf16_units_like_browsers(): void
    {
        $op = TextOperation::fromWire([3, 'ạ', -1, 2]);
        self::assertSame('Kếtạ ok', TextOperation::fromWire([3, 'ạ', 3])?->apply('Kết ok'));
        self::assertSame('Kếtạok', $op?->apply('Kết ok'));
        // An emoji is two UTF-16 units; retaining across it keeps it whole.
        self::assertSame('😀!', TextOperation::fromWire([2, '!'])?->apply('😀'));
        self::assertNull(TextOperation::fromWire([1, '!', 1])?->apply('😀'), 'splitting a surrogate pair is rejected');
        self::assertNull(TextOperation::fromWire([5])?->apply('abc'), 'base length must match');
    }

    public function test_malformed_wire_data_is_rejected(): void
    {
        self::assertNull(TextOperation::fromWire('abc'));
        self::assertNull(TextOperation::fromWire([0]));
        self::assertNull(TextOperation::fromWire(['']));
        self::assertNull(TextOperation::fromWire([1.5]));
        self::assertNull(TextOperation::fromWire(['a' => 1]));
        self::assertNull(TextOperation::fromWire(["\xff"]));
        self::assertSame([3, 'xy', -2], TextOperation::fromWire([1, 2, 'x', 'y', -1, -1])?->components);
    }

    public function test_concurrent_inserts_at_one_position_are_ordered_deterministically(): void
    {
        $a = TextOperation::fromWire([2, 'A', 1]);
        $b = TextOperation::fromWire([2, 'B', 1]);
        [$aPrime, $bPrime] = TextOperation::transform($a, $b);
        self::assertSame('abABc', $bPrime->apply($a->apply('abc')));
        self::assertSame('abABc', $aPrime->apply($b->apply('abc')));
    }

    public function test_random_concurrent_operations_converge(): void
    {
        mt_srand(20261104);
        $alphabet = ['a', 'b', 'c', ' ', "\n", 'ế', 'ạ', 'đ', 'Ư'];
        for ($round = 0; $round < 400; $round++) {
            $document = '';
            for ($k = mt_rand(0, 30); $k > 0; $k--) {
                $document .= $alphabet[mt_rand(0, count($alphabet) - 1)];
            }
            $a = $this->randomOperation($document, $alphabet);
            $b = $this->randomOperation($document, $alphabet);
            $pair = TextOperation::transform($a, $b);
            self::assertNotNull($pair);
            [$aPrime, $bPrime] = $pair;
            $left = $bPrime->apply((string) $a->apply($document));
            $right = $aPrime->apply((string) $b->apply($document));
            self::assertNotNull($left);
            self::assertSame($left, $right, "round $round on ".json_encode($document));
        }
    }

    /** @param list<string> $alphabet */
    private function randomOperation(string $document, array $alphabet): TextOperation
    {
        $length = TextOperation::length($document);
        $components = [];
        $position = 0;
        while ($position < $length) {
            $span = mt_rand(1, max(1, $length - $position));
            switch (mt_rand(0, 2)) {
                case 0:
                    $components[] = $span;
                    $position += $span;
                    break;
                case 1:
                    $components[] = -$span;
                    $position += $span;
                    break;
                default:
                    $components[] = $alphabet[mt_rand(0, count($alphabet) - 1)].$alphabet[mt_rand(0, count($alphabet) - 1)];
            }
        }
        if (mt_rand(0, 1) === 1) {
            $components[] = 'z';
        }
        $operation = TextOperation::fromWire($components === [] ? ['x'] : $components);
        self::assertNotNull($operation);

        return $operation;
    }
}
