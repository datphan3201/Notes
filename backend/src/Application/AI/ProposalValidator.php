<?php

declare(strict_types=1);

namespace Planner\Application\AI;

use Planner\Http\ValidationException;

final readonly class ProposalValidator
{
    private const CREATE = ['create_goal', 'create_milestone', 'create_task', 'create_note', 'create_habit'];
    /** Every change is applied only after the user confirms it. */
    private const CHANGE = [
        'update_task', 'complete_task', 'reopen_task', 'archive_task',
        'update_goal', 'complete_goal', 'reopen_goal', 'archive_goal',
        'update_habit', 'archive_habit', 'check_in_habit',
        'update_note', 'delete_note',
    ];
    private const TASK_UPDATE_FIELDS = ['name', 'description', 'expected_result', 'completion_criteria', 'importance', 'start_date', 'deadline'];
    private const GOAL_UPDATE_FIELDS = ['name', 'description', 'expected_result', 'completion_criteria', 'strategy_notes', 'importance', 'deadline'];
    private const HABIT_FIELDS = ['name', 'description', 'importance', 'period', 'target_frequency'];

    /** @return array{proposal:array<string,mixed>,canonical:string,hash:string} */
    public function validate(string $json): array
    {
        if (strlen($json) > 102_400) throw new ValidationException(['proposal' => ['The proposal exceeds 100 KiB.']]);
        $this->rejectDuplicateKeys($json);
        try {
            $proposal = json_decode($json, true, 512, JSON_THROW_ON_ERROR);
        } catch (\JsonException) {
            throw new ValidationException(['proposal' => ['The proposal JSON is invalid.']]);
        }
        if (!is_array($proposal) || count($proposal) !== 3 || array_diff(array_keys($proposal), ['schema_version', 'summary', 'operations']) !== []) throw new ValidationException(['proposal' => ['The proposal structure is invalid.']]);
        if ($proposal['schema_version'] !== 1 || !is_string($proposal['summary']) || mb_strlen($proposal['summary']) > 2_000 || !is_array($proposal['operations']) || !array_is_list($proposal['operations']) || count($proposal['operations']) > 50) throw new ValidationException(['proposal' => ['The proposal structure is invalid.']]);
        $locals = [];
        foreach ($proposal['operations'] as $index => $operation) {
            if (!is_array($operation)) throw new ValidationException(['operations' => ["Operation $index is invalid."]]);
            $op = $operation['op'] ?? null;
            if (!in_array($op, [...self::CREATE, ...self::CHANGE, 'add_contribution', 'add_milestone_dependency'], true)) throw new ValidationException(['operations' => ["Operation $index is not supported."]]);
            $allowed = match (true) {
                in_array($op, self::CREATE, true) => ['op','local_id','parent','fields'],
                in_array($op, self::CHANGE, true) => ['op','target','fields'],
                default => ['op','source','target'],
            };
            if (array_diff(array_keys($operation), $allowed) !== []) throw new ValidationException(['operations' => ["Operation $index contains an unsupported field."]]);
            if (in_array($op, self::CREATE, true)) {
                $local = $operation['local_id'] ?? null;
                if (!is_string($local) || preg_match('/^[a-z][a-z0-9_-]{0,31}$/D', $local) !== 1 || isset($locals[$local])) throw new ValidationException(['operations' => ["The local_id in operation $index is invalid."]]);
                $this->reference($operation['parent'] ?? null, $locals, in_array($op, ['create_task', 'create_note', 'create_habit'], true));
                $this->fields($op, $operation['fields'] ?? null);
                $locals[$local] = $op;
            } elseif (in_array($op, self::CHANGE, true)) {
                // Changes target only existing objects the server loaded for this proposal.
                $target = $operation['target'] ?? null;
                $this->reference($target, [], false);
                if ($target['type'] !== substr($op, strrpos($op, '_') + 1)) throw new ValidationException(['operations' => ["Operation $index targets the wrong object type."]]);
                $this->changeFields($op, $operation['fields'] ?? []);
            } else {
                $this->reference($operation['source'] ?? null, $locals, false);
                $this->reference($operation['target'] ?? null, $locals, false);
            }
        }
        $canonicalValue = $this->sortObjects($proposal);
        $canonical = json_encode($canonicalValue, JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES | JSON_THROW_ON_ERROR);
        return ['proposal' => $proposal, 'canonical' => $canonical, 'hash' => hash('sha256', $canonical)];
    }

    /** @param array<string,string> $locals */
    private function reference(mixed $reference, array $locals, bool $nullable): void
    {
        if ($reference === null && $nullable) return;
        if (!is_array($reference)) throw new ValidationException(['reference' => ['The reference is invalid.']]);
        if (array_key_exists('local_id', $reference)) {
            if (count($reference) !== 1 || !is_string($reference['local_id']) || !isset($locals[$reference['local_id']])) throw new ValidationException(['reference' => ['A local reference must point to an earlier operation.']]);
            return;
        }
        if (array_diff(array_keys($reference), ['type','existing_id','version']) !== [] || !isset($reference['type'], $reference['existing_id'], $reference['version']) || !in_array($reference['type'], ['area','goal','milestone','task','note','habit'], true) || !is_string($reference['existing_id']) || preg_match('/^[0-9a-f-]{36}$/D', $reference['existing_id']) !== 1 || !is_int($reference['version']) || $reference['version'] < 1) throw new ValidationException(['reference' => ['The existing-object reference is invalid.']]);
    }

    private function fields(string $op, mixed $fields): void
    {
        if (!is_array($fields)) throw new ValidationException(['fields' => ['The create fields are invalid.']]);
        $allowed = match ($op) {
            'create_goal' => ['name','description','expected_result','completion_criteria','strategy_notes','importance','deadline'],
            'create_milestone' => ['name','description','completion_criteria','importance','deadline'],
            'create_task' => ['name','description','expected_result','completion_criteria','importance','start_date','deadline','scheduled_start','scheduled_end'],
            'create_note' => ['title','content'],
            'create_habit' => [...self::HABIT_FIELDS, 'timezone'],
        };
        $required = $op === 'create_note' ? 'title' : 'name';
        if (array_diff(array_keys($fields), $allowed) !== [] || !isset($fields[$required]) || !is_string($fields[$required])) throw new ValidationException(['fields' => ['The create fields are invalid.']]);
        if ($op === 'create_note' && !is_string($fields['content'] ?? '')) throw new ValidationException(['fields' => ['The create fields are invalid.']]);
    }

    private function changeFields(string $op, mixed $fields): void
    {
        $allowed = match ($op) {
            'update_task' => self::TASK_UPDATE_FIELDS,
            'reopen_task' => ['deadline'],
            'update_goal' => self::GOAL_UPDATE_FIELDS,
            'update_habit' => self::HABIT_FIELDS,
            'check_in_habit' => ['date'],
            'update_note' => ['title', 'content'],
            default => [],
        };
        $valid = is_array($fields) && ($fields === [] || !array_is_list($fields)) && array_diff(array_keys($fields), $allowed) === [];
        if ($valid && in_array($op, ['update_task', 'update_goal', 'update_habit', 'update_note'], true) && $fields === []) $valid = false;
        if ($valid && $op === 'check_in_habit') $valid = is_string($fields['date'] ?? null) && preg_match('/^\d{4}-\d{2}-\d{2}$/D', $fields['date']) === 1;
        if ($valid && $op === 'update_note') {
            foreach ($fields as $value) $valid = $valid && is_string($value);
        }
        if (!$valid) throw new ValidationException(['fields' => ['The change fields are invalid.']]);
    }

    private function sortObjects(mixed $value): mixed
    {
        if (!is_array($value)) return $value;
        if (array_is_list($value)) return array_map($this->sortObjects(...), $value);
        ksort($value, SORT_STRING);
        foreach ($value as $key => $item) $value[$key] = $this->sortObjects($item);
        return $value;
    }

    private function rejectDuplicateKeys(string $json): void
    {
        $stack = [];
        $length = strlen($json);
        $index = 0;
        while ($index < $length) {
            $char = $json[$index];
            if ($char === '{') {
                $stack[] = ['type' => 'object', 'keys' => []];
                $index++;
                continue;
            }
            if ($char === '[') {
                $stack[] = ['type' => 'array', 'keys' => []];
                $index++;
                continue;
            }
            if ($char === '}' || $char === ']') {
                array_pop($stack);
                $index++;
                continue;
            }
            if ($char !== '"') {
                $index++;
                continue;
            }
            $start = $index;
            $index++;
            while ($index < $length) {
                if ($json[$index] === '\\') {
                    $index += 2;
                    continue;
                } if ($json[$index] === '"') break;
                $index++;
            }
            if ($index >= $length) return;
            $token = substr($json, $start, $index - $start + 1);
            $index++;
            $look = $index;
            while ($look < $length && ctype_space($json[$look])) $look++;
            $top = array_key_last($stack);
            if ($look < $length && $json[$look] === ':' && $top !== null && $stack[$top]['type'] === 'object') {
                try {
                    $key = json_decode($token, true, 512, JSON_THROW_ON_ERROR);
                } catch (\JsonException) {
                    return;
                }
                if (isset($stack[$top]['keys'][$key])) throw new ValidationException(['proposal' => ['The JSON contains a duplicate key.']]);
                $stack[$top]['keys'][$key] = true;
            }
        }
    }
}
