<?php

declare(strict_types=1);

namespace Planner\Infrastructure\Database;

use LogicException;
use PDO;
use Throwable;

final class TransactionManager
{
    private int $depth = 0;

    private bool $rollbackOnly = false;

    public function __construct(private readonly PDO $pdo) {}

    /** @template T @param callable(PDO): T $operation @return T */
    public function run(callable $operation): mixed
    {
        $outermost = $this->depth === 0;

        if ($outermost) {
            $this->pdo->beginTransaction();
            $this->rollbackOnly = false;
        }

        $this->depth++;

        try {
            $result = $operation($this->pdo);
            $this->depth--;

            if ($outermost) {
                if ($this->rollbackOnly) {
                    $this->pdo->rollBack();
                    throw new LogicException('Transaction was marked rollback-only by a nested operation.');
                }

                $this->pdo->commit();
            }

            return $result;
        } catch (Throwable $exception) {
            $this->depth--;
            $this->rollbackOnly = true;

            if ($outermost && $this->pdo->inTransaction()) {
                $this->pdo->rollBack();
            }

            throw $exception;
        }
    }
}
