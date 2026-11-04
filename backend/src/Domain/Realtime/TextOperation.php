<?php

declare(strict_types=1);

namespace Planner\Domain\Realtime;

/**
 * Operational-transformation text operation, wire-compatible with the
 * browser's text-operation.js.
 *
 * An operation is a list of components applied left to right over the whole
 * document: a positive int retains that many characters, a negative int
 * deletes that many, and a string inserts itself. Lengths are UTF-16 code
 * units because that is how browsers index strings; PHP converts to UTF-16LE
 * internally so both sides agree on every offset.
 */
final readonly class TextOperation
{
    /** @param list<int|string> $components normalized */
    private function __construct(public array $components, public int $baseLength, public int $targetLength)
    {
    }

    /**
     * Validates and normalizes wire data. Returns null for anything malformed.
     *
     * @param mixed $components
     */
    public static function fromWire(mixed $components, int $maxComponents = 10_000): ?self
    {
        if (! is_array($components) || ! array_is_list($components) || count($components) > $maxComponents) {
            return null;
        }
        $normalized = [];
        foreach ($components as $component) {
            if (is_int($component) && $component !== 0) {
                self::push($normalized, $component);
            } elseif (is_string($component) && $component !== '' && mb_check_encoding($component, 'UTF-8')) {
                self::push($normalized, $component);
            } else {
                return null;
            }
        }

        return self::build($normalized);
    }

    /** @param list<int|string> $components */
    private static function build(array $components): self
    {
        $base = 0;
        $target = 0;
        foreach ($components as $component) {
            if (is_string($component)) {
                $target += self::length($component);
            } elseif ($component > 0) {
                $base += $component;
                $target += $component;
            } else {
                $base -= $component;
            }
        }

        return new self($components, $base, $target);
    }

    public static function length(string $text): int
    {
        return intdiv(strlen(self::utf16($text)), 2);
    }

    /** Applies the operation; null when it does not fit the document. */
    public function apply(string $document): ?string
    {
        $source = self::utf16($document);
        if (intdiv(strlen($source), 2) !== $this->baseLength) {
            return null;
        }
        $result = '';
        $position = 0;
        foreach ($this->components as $component) {
            if (is_string($component)) {
                $result .= self::utf16($component);
            } elseif ($component > 0) {
                $result .= substr($source, $position * 2, $component * 2);
                $position += $component;
            } else {
                $position -= $component;
            }
        }
        $text = mb_convert_encoding($result, 'UTF-8', 'UTF-16LE');

        // An operation that splits a surrogate pair produces invalid UTF-16, which the
        // converter silently replaces; a round trip detects that.
        return is_string($text) && self::utf16($text) === $result ? $text : null;
    }

    /**
     * Transforms two concurrent operations on the same document so that
     * apply(apply(d, a), b') === apply(apply(d, b), a'). Returns [a', b'].
     * When both insert at one position, $a's insert goes first.
     *
     * @return array{0:self,1:self}|null null when the operations do not share a base
     */
    public static function transform(self $a, self $b): ?array
    {
        if ($a->baseLength !== $b->baseLength) {
            return null;
        }
        $aPrime = [];
        $bPrime = [];
        $left = $a->components;
        $right = $b->components;
        $i = 0;
        $j = 0;
        $x = $left[$i++] ?? null;
        $y = $right[$j++] ?? null;
        while ($x !== null || $y !== null) {
            if (is_string($x)) {
                self::push($aPrime, $x);
                self::push($bPrime, self::length($x));
                $x = $left[$i++] ?? null;
                continue;
            }
            if (is_string($y)) {
                self::push($aPrime, self::length($y));
                self::push($bPrime, $y);
                $y = $right[$j++] ?? null;
                continue;
            }
            if ($x === null || $y === null) {
                return null;
            }
            if ($x > 0 && $y > 0) {
                $min = min($x, $y);
                self::push($aPrime, $min);
                self::push($bPrime, $min);
                [$x, $y] = self::advance($x, $y, $min, $left, $right, $i, $j);
            } elseif ($x < 0 && $y < 0) {
                // Both delete the same text: nothing left to do for that span.
                $min = min(-$x, -$y);
                [$x, $y] = self::advance($x, $y, $min, $left, $right, $i, $j);
            } elseif ($x < 0 && $y > 0) {
                $min = min(-$x, $y);
                self::push($aPrime, -$min);
                [$x, $y] = self::advance($x, $y, $min, $left, $right, $i, $j);
            } else {
                $min = min($x, -$y);
                self::push($bPrime, -$min);
                [$x, $y] = self::advance($x, $y, $min, $left, $right, $i, $j);
            }
        }

        return [self::build($aPrime), self::build($bPrime)];
    }

    /**
     * Consumes $amount characters from the current components of both sides.
     *
     * @param list<int|string> $left
     * @param list<int|string> $right
     * @return array{0:int|string|null,1:int|string|null}
     */
    private static function advance(int $x, int $y, int $amount, array $left, array $right, int &$i, int &$j): array
    {
        $x = $x > 0 ? $x - $amount : $x + $amount;
        $y = $y > 0 ? $y - $amount : $y + $amount;
        if ($x === 0) {
            $x = $left[$i++] ?? null;
        }
        if ($y === 0) {
            $y = $right[$j++] ?? null;
        }

        return [$x, $y];
    }

    /** @param list<int|string> $components */
    private static function push(array &$components, int|string $component): void
    {
        if ($component === 0 || $component === '') {
            return;
        }
        $last = array_key_last($components);
        if ($last === null) {
            $components[] = $component;

            return;
        }
        $previous = $components[$last];
        if (is_string($component) && is_string($previous)) {
            $components[$last] = $previous.$component;
        } elseif (is_int($component) && is_int($previous) && ($component > 0) === ($previous > 0)) {
            $components[$last] = $previous + $component;
        } elseif (is_string($component) && is_int($previous) && $previous < 0) {
            // Keep inserts before deletes so equivalent operations compare equal.
            $beforeLast = $last - 1;
            if ($beforeLast >= 0 && is_string($components[$beforeLast])) {
                $components[$beforeLast] .= $component;
            } else {
                $components[$last] = $component;
                $components[] = $previous;
            }
        } else {
            $components[] = $component;
        }
    }

    private static function utf16(string $text): string
    {
        return $text === '' ? '' : (string) mb_convert_encoding($text, 'UTF-16LE', 'UTF-8');
    }
}
