<?php

declare(strict_types=1);

namespace Planner\Application\AI;

use Planner\Http\ValidationException;

final readonly class ProposalValidator
{
    /** @return array{proposal:array<string,mixed>,canonical:string,hash:string} */
    public function validate(string $json): array
    {
        if (strlen($json) > 102_400) throw new ValidationException(['proposal' => ['The proposal exceeds 100 KiB.']]);
        $this->rejectDuplicateKeys($json);
        try { $proposal = json_decode($json, true, 512, JSON_THROW_ON_ERROR); }
        catch (\JsonException) { throw new ValidationException(['proposal' => ['The proposal JSON is invalid.']]); }
        if (!is_array($proposal) || count($proposal) !== 3 || array_diff(array_keys($proposal), ['schema_version', 'summary', 'operations']) !== []) throw new ValidationException(['proposal' => ['The proposal structure is invalid.']]);
        if ($proposal['schema_version'] !== 1 || !is_string($proposal['summary']) || mb_strlen($proposal['summary']) > 2_000 || !is_array($proposal['operations']) || !array_is_list($proposal['operations']) || count($proposal['operations']) > 50) throw new ValidationException(['proposal' => ['The proposal structure is invalid.']]);
        $locals = [];
        foreach ($proposal['operations'] as $index => $operation) {
            if (!is_array($operation)) throw new ValidationException(['operations' => ["Operation $index is invalid."]]);
            $op = $operation['op'] ?? null;
            if (!in_array($op, ['create_goal','create_milestone','create_task','add_contribution','add_milestone_dependency'], true)) throw new ValidationException(['operations' => ["Operation $index is not supported."]]);
            $allowed = str_starts_with($op, 'create_') ? ['op','local_id','parent','fields'] : ['op','source','target'];
            if (array_diff(array_keys($operation), $allowed) !== []) throw new ValidationException(['operations' => ["Operation $index contains an unsupported field."]]);
            if (str_starts_with($op, 'create_')) {
                $local = $operation['local_id'] ?? null;
                if (!is_string($local) || preg_match('/^[a-z][a-z0-9_-]{0,31}$/D', $local) !== 1 || isset($locals[$local])) throw new ValidationException(['operations' => ["The local_id in operation $index is invalid."]]);
                $this->reference($operation['parent'] ?? null, $locals, $op === 'create_task');
                $this->fields($op, $operation['fields'] ?? null);
                $locals[$local] = $op;
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
        if (array_diff(array_keys($reference), ['type','existing_id','version']) !== [] || !isset($reference['type'], $reference['existing_id'], $reference['version']) || !in_array($reference['type'], ['area','goal','milestone','task'], true) || !is_string($reference['existing_id']) || preg_match('/^[0-9a-f-]{36}$/D', $reference['existing_id']) !== 1 || !is_int($reference['version']) || $reference['version'] < 1) throw new ValidationException(['reference' => ['The existing-object reference is invalid.']]);
    }

    private function fields(string $op, mixed $fields): void
    {
        if (!is_array($fields)) throw new ValidationException(['fields' => ['The create fields are invalid.']]);
        $allowed = match ($op) {
            'create_goal' => ['name','description','expected_result','completion_criteria','importance','deadline'],
            'create_milestone' => ['name','description','completion_criteria','importance','deadline'],
            'create_task' => ['name','description','expected_result','completion_criteria','importance','start_date','deadline','scheduled_start','scheduled_end'],
        };
        if (array_diff(array_keys($fields), $allowed) !== [] || !isset($fields['name']) || !is_string($fields['name'])) throw new ValidationException(['fields' => ['The create fields are invalid.']]);
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
        $stack = []; $length = strlen($json); $index = 0;
        while ($index < $length) {
            $char = $json[$index];
            if ($char === '{') { $stack[] = ['type' => 'object', 'keys' => []]; $index++; continue; }
            if ($char === '[') { $stack[] = ['type' => 'array', 'keys' => []]; $index++; continue; }
            if ($char === '}' || $char === ']') { array_pop($stack); $index++; continue; }
            if ($char !== '"') { $index++; continue; }
            $start = $index; $index++;
            while ($index < $length) { if ($json[$index] === '\\') { $index += 2; continue; } if ($json[$index] === '"') break; $index++; }
            if ($index >= $length) return;
            $token = substr($json, $start, $index - $start + 1); $index++;
            $look = $index; while ($look < $length && ctype_space($json[$look])) $look++;
            $top = array_key_last($stack);
            if ($look < $length && $json[$look] === ':' && $top !== null && $stack[$top]['type'] === 'object') {
                try { $key = json_decode($token, true, 512, JSON_THROW_ON_ERROR); } catch (\JsonException) { return; }
                if (isset($stack[$top]['keys'][$key])) throw new ValidationException(['proposal' => ['The JSON contains a duplicate key.']]);
                $stack[$top]['keys'][$key] = true;
            }
        }
    }
}
