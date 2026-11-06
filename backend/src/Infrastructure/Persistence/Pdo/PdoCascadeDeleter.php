<?php

declare(strict_types=1);

namespace Planner\Infrastructure\Persistence\Pdo;

use PDO;
use RuntimeException;

/**
 * Deletes rows and everything that depends on them, following the schema's foreign keys
 * (read from information_schema, so new tables are covered without changes here).
 *
 * Children held by RESTRICT/NO ACTION or CASCADE keys are deleted first, recursively; SET NULL
 * keys are left to the database. `$keep` names references to clear instead of deleting the row
 * that holds them (for example a Habit that only links to a Goal being deleted). Foreign key
 * checks stay on, so anything this misses makes the database refuse and the caller's
 * transaction roll back rather than leave broken data. Call it inside a transaction.
 */
final class PdoCascadeDeleter
{
    private const CHUNK = 200;

    /** @var array<string, list<array{table:string, cols:list<string>, refs:list<string>, rule:string}>>|null children by parent table */
    private ?array $children = null;
    /** @var array<string, list<string>> */
    private array $primary = [];
    /** @var array<string, bool> "table.column" => nullable */
    private array $nullable = [];

    public function __construct(private readonly PDO $pdo)
    {
    }

    /**
     * @param list<array<string, mixed>> $rows full rows of $table to delete
     * @param array<string, list<string>> $keep table => columns to set to NULL instead of deleting the row
     * @param array<string, string> $fileColumns table => column holding a private file path to report
     * @param (callable(string, array<string, mixed>): void)|null $guard called for every row before it is deleted; throw to stop
     * @return array{counts: array<string, int>, files: list<string>}
     */
    public function delete(string $table, array $rows, array $keep = [], array $fileColumns = [], ?callable $guard = null): array
    {
        $this->load();
        $state = ['counts' => [], 'files' => [], 'seen' => [], 'guard' => $guard];
        $this->purge($table, $rows, $keep, $fileColumns, $state);
        ksort($state['counts']);

        return ['counts' => $state['counts'], 'files' => array_values(array_unique($state['files']))];
    }

    /** @return list<array<string, mixed>> full rows of $table where $column is one of $values */
    public function rows(string $table, string $column, array $values): array
    {
        $rows = [];
        foreach (array_chunk(array_values(array_unique($values)), self::CHUNK) as $chunk) {
            $statement = $this->pdo->prepare(sprintf('SELECT * FROM `%s` WHERE `%s` IN (%s)', $table, $column, implode(',', array_fill(0, count($chunk), '?'))));
            $statement->execute($chunk);
            array_push($rows, ...$statement->fetchAll(PDO::FETCH_ASSOC));
        }

        return $rows;
    }

    /**
     * @param list<array<string, mixed>> $rows
     * @param array<string, list<string>> $keep
     * @param array<string, string> $fileColumns
     * @param array{counts: array<string, int>, files: list<string>, seen: array<string, true>, guard: callable|null} $state
     */
    private function purge(string $table, array $rows, array $keep, array $fileColumns, array &$state): void
    {
        $primary = $this->primary[$table] ?? throw new RuntimeException("Table $table has no primary key.");
        $fresh = [];
        foreach ($rows as $row) {
            $key = $table.':'.implode("\0", array_map(static fn ($column) => (string) $row[$column], $primary));
            if (!isset($state['seen'][$key])) {
                $state['seen'][$key] = true;
                $fresh[] = $row;
            }
        }
        if ($fresh === []) {
            return;
        }

        foreach ($this->children[$table] ?? [] as $fk) {
            if ($fk['rule'] === 'SET NULL') {
                continue; // The database clears these when the parent goes.
            }
            $tuples = [];
            foreach ($fresh as $row) {
                $tuple = array_map(static fn ($column) => $row[$column], $fk['refs']);
                if (!in_array(null, $tuple, true)) {
                    $tuples[implode("\0", array_map('strval', $tuple))] = $tuple;
                }
            }
            if ($tuples === []) {
                continue;
            }
            $children = $this->matching($fk['table'], $fk['cols'], array_values($tuples));
            if ($children === []) {
                continue;
            }
            $clear = array_values(array_intersect($fk['cols'], $keep[$fk['table']] ?? []));
            if ($clear !== []) {
                $this->clear($fk['table'], $children, $clear, $state);
            } else {
                $this->purge($fk['table'], $children, $keep, $fileColumns, $state);
            }
        }

        if ($state['guard'] !== null) {
            foreach ($fresh as $row) {
                ($state['guard'])($table, $row);
            }
        }
        if (isset($fileColumns[$table])) {
            foreach ($fresh as $row) {
                if (is_string($row[$fileColumns[$table]] ?? null) && $row[$fileColumns[$table]] !== '') {
                    $state['files'][] = $row[$fileColumns[$table]];
                }
            }
        }
        $deleted = 0;
        foreach (array_chunk($fresh, self::CHUNK) as $chunk) {
            [$where, $values] = $this->tupleWhere($primary, array_map(static fn ($row) => array_map(static fn ($column) => $row[$column], $primary), $chunk));
            $statement = $this->pdo->prepare("DELETE FROM `$table` WHERE $where");
            $statement->execute($values);
            $deleted += $statement->rowCount();
        }
        $state['counts'][$table] = ($state['counts'][$table] ?? 0) + $deleted;
    }

    /**
     * @param list<array<string, mixed>> $rows
     * @param list<string> $columns
     * @param array{counts: array<string, int>} $state
     */
    private function clear(string $table, array $rows, array $columns, array &$state): void
    {
        foreach ($columns as $column) {
            if (!($this->nullable["$table.$column"] ?? false)) {
                throw new RuntimeException("$table.$column cannot be cleared.");
            }
        }
        $primary = $this->primary[$table];
        $set = implode(', ', array_map(static fn ($column) => "`$column` = NULL", $columns));
        foreach (array_chunk($rows, self::CHUNK) as $chunk) {
            [$where, $values] = $this->tupleWhere($primary, array_map(static fn ($row) => array_map(static fn ($column) => $row[$column], $primary), $chunk));
            $statement = $this->pdo->prepare("UPDATE `$table` SET $set WHERE $where");
            $statement->execute($values);
            $state['counts']["$table (link cleared)"] = ($state['counts']["$table (link cleared)"] ?? 0) + $statement->rowCount();
        }
    }

    /**
     * @param list<string> $columns
     * @param list<list<mixed>> $tuples
     * @return list<array<string, mixed>>
     */
    private function matching(string $table, array $columns, array $tuples): array
    {
        $rows = [];
        foreach (array_chunk($tuples, self::CHUNK) as $chunk) {
            [$where, $values] = $this->tupleWhere($columns, $chunk);
            $statement = $this->pdo->prepare("SELECT * FROM `$table` WHERE $where");
            $statement->execute($values);
            array_push($rows, ...$statement->fetchAll(PDO::FETCH_ASSOC));
        }

        return $rows;
    }

    /**
     * @param list<string> $columns
     * @param list<list<mixed>> $tuples
     * @return array{0: string, 1: list<mixed>}
     */
    private function tupleWhere(array $columns, array $tuples): array
    {
        $names = '('.implode(', ', array_map(static fn ($column) => "`$column`", $columns)).')';
        $one = '('.implode(', ', array_fill(0, count($columns), '?')).')';

        return ["$names IN (".implode(', ', array_fill(0, count($tuples), $one)).')', array_merge(...array_map('array_values', $tuples))];
    }

    private function load(): void
    {
        if ($this->children !== null) {
            return;
        }
        $keys = [];
        foreach ($this->pdo->query(
            "SELECT k.CONSTRAINT_NAME c, k.TABLE_NAME t, k.COLUMN_NAME col, k.REFERENCED_TABLE_NAME rt, k.REFERENCED_COLUMN_NAME rc, r.DELETE_RULE rule
            FROM information_schema.KEY_COLUMN_USAGE k
            JOIN information_schema.REFERENTIAL_CONSTRAINTS r
              ON r.CONSTRAINT_SCHEMA = k.CONSTRAINT_SCHEMA AND r.CONSTRAINT_NAME = k.CONSTRAINT_NAME AND r.TABLE_NAME = k.TABLE_NAME
            WHERE k.TABLE_SCHEMA = DATABASE() AND k.REFERENCED_TABLE_NAME IS NOT NULL
            ORDER BY k.TABLE_NAME, k.CONSTRAINT_NAME, k.ORDINAL_POSITION",
        ) as $row) {
            $id = $row['t'].'/'.$row['c'];
            $keys[$id] ??= ['parent' => $row['rt'], 'table' => $row['t'], 'cols' => [], 'refs' => [], 'rule' => $row['rule']];
            $keys[$id]['cols'][] = $row['col'];
            $keys[$id]['refs'][] = $row['rc'];
        }
        $this->children = [];
        foreach ($keys as $key) {
            $this->children[$key['parent']][] = ['table' => $key['table'], 'cols' => $key['cols'], 'refs' => $key['refs'], 'rule' => $key['rule']];
        }
        foreach ($this->pdo->query("SELECT TABLE_NAME, COLUMN_NAME FROM information_schema.KEY_COLUMN_USAGE WHERE TABLE_SCHEMA = DATABASE() AND CONSTRAINT_NAME = 'PRIMARY' ORDER BY TABLE_NAME, ORDINAL_POSITION") as $row) {
            $this->primary[$row['TABLE_NAME']][] = $row['COLUMN_NAME'];
        }
        foreach ($this->pdo->query("SELECT TABLE_NAME, COLUMN_NAME, IS_NULLABLE FROM information_schema.COLUMNS WHERE TABLE_SCHEMA = DATABASE()") as $row) {
            $this->nullable[$row['TABLE_NAME'].'.'.$row['COLUMN_NAME']] = $row['IS_NULLABLE'] === 'YES';
        }
    }
}
