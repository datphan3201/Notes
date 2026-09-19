<?php

declare(strict_types=1);

namespace Planner\Application\AI;

use DateInterval;
use Planner\Application\Planning\PlanningService;
use Planner\Application\Reviews\ReviewService;
use Planner\Http\HttpException;
use Planner\Http\ValidationException;
use Planner\Infrastructure\Database\TransactionManager;
use Planner\Infrastructure\Persistence\Pdo\AI\PdoAIActionRepository;
use Planner\Infrastructure\Persistence\Pdo\Planning\PdoPlanningRepository;
use Planner\Support\Clock;
use Planner\Support\Timestamp;
use Planner\Support\UuidGenerator;

final readonly class AIActionService
{
    private const CAPABILITIES = ['suggest_goals','suggest_milestones','suggest_tasks','review_goal','review_task','break_down_goal','help_plan','draft_review'];

    public function __construct(
        private AIProviderInterface $provider,
        private ProposalValidator $validator,
        private PdoAIActionRepository $actions,
        private PdoPlanningRepository $planningRepository,
        private PlanningService $planning,
        private ReviewService $reviews,
        private TransactionManager $transactions,
        private UuidGenerator $uuid,
        private Clock $clock,
    ) {}

    /** @param array<string,mixed> $input @return array<string,mixed> */
    public function generate(int $userId, array $input): array
    {
        $this->keys($input, ['capability','instruction','context','consent']);
        $capability = $input['capability'] ?? null;
        if (!is_string($capability) || !in_array($capability, self::CAPABILITIES, true)) throw new ValidationException(['capability' => ['The AI capability is invalid.']]);
        $instruction = $input['instruction'] ?? '';
        if (!is_string($instruction) || mb_strlen($instruction) > 5_000) throw new ValidationException(['instruction' => ['The instructions are invalid.']]);
        if (($input['consent'] ?? false) !== true) throw new ValidationException(['consent' => ['Consent is required before selected context is sent to the AI provider.']]);
        $contexts = $this->loadContext($userId, $input['context'] ?? null);
        $encoded = json_encode($contexts['objects'], JSON_UNESCAPED_UNICODE | JSON_THROW_ON_ERROR);
        if (strlen($encoded) > 102_400) throw new ValidationException(['context' => ['The selected context exceeds 100 KiB.']]);
        if (!$this->actions->consented($userId)) {
            $this->transactions->run(function () use ($userId): void { $this->planningRepository->lockOwner($userId); $this->actions->consent($userId, $this->now()); });
        }
        // The external request is deliberately outside a database transaction.
        $generated = $this->provider->generate(new GenerationRequest($capability, $instruction, $contexts['objects']));
        $validated = $this->validator->validate($generated->proposalJson);
        return $this->transactions->run(function () use ($userId, $capability, $contexts, $validated): array {
            $this->planningRepository->lockOwner($userId);
            $now = $this->now();
            $row = $this->actions->insert([
                'id' => $this->uuid->generate(), 'user_id' => $userId, 'capability' => $capability,
                'status' => 'Proposed', 'provider' => $this->provider->name(), 'model' => $this->provider->model(),
                'proposal' => $validated['canonical'], 'proposal_hash' => $validated['hash'],
                'context_versions' => json_encode($contexts['versions'], JSON_THROW_ON_ERROR),
                'created_ids' => null, 'expires_at' => Timestamp::database($this->clock->now()->add(new DateInterval('PT24H'))),
                'version' => 1, 'safe_error_code' => null, 'created_at' => $now, 'updated_at' => $now,
            ]);
            return $this->serialize($row);
        });
    }

    public function show(int $userId, string $id): array
    {
        return $this->serialize($this->owned($userId, $id));
    }

    /** @param array<string,mixed> $input @return array<string,mixed> */
    public function apply(int $userId, string $id, array $input): array
    {
        $this->keys($input, ['base_version','proposal_hash']);
        $version = $input['base_version'] ?? null; $hash = $input['proposal_hash'] ?? null;
        if (!is_int($version) || $version < 1 || !is_string($hash) || preg_match('/^[0-9a-f]{64}$/D', $hash) !== 1) throw new ValidationException(['approval' => ['The approval details are invalid.']]);
        return $this->transactions->run(function () use ($userId, $id, $version, $hash): array {
            $this->planningRepository->lockOwner($userId);
            $action = $this->owned($userId, $id, true);
            if (!hash_equals((string) $action['proposal_hash'], $hash)) throw new HttpException(409, 'AI_PROPOSAL_CHANGED', 'The proposal does not match the version you reviewed.');
            if ($action['status'] === 'Applied') return $this->serialize($action);
            if ($action['status'] !== 'Proposed') throw new ValidationException(['status' => ['The proposal can no longer be applied.']]);
            if ((int) $action['version'] !== $version) throw new HttpException(409, 'VERSION_CONFLICT', 'The proposal has changed.');
            if ((string) $action['expires_at'] <= $this->now()) throw new ValidationException(['status' => ['The proposal has expired; generate a new one.']]);
            $validated = $this->validator->validate((string) $action['proposal']);
            if (!hash_equals($hash, $validated['hash'])) throw new HttpException(409, 'AI_PROPOSAL_CHANGED', 'The stored proposal is no longer valid.');
            $versions = json_decode((string) $action['context_versions'], true, 512, JSON_THROW_ON_ERROR);
            $allowedReferences = [];
            foreach ($versions as $reference) {
                $this->assertReferenceVersion($userId, $reference);
                $allowedReferences[$this->referenceKey((string) $reference['type'], (string) $reference['id'])] = $reference;
            }
            $created = $this->execute($userId, $validated['proposal']['operations'], $allowedReferences);
            $updated = $this->actions->update($userId, $id, ['status' => 'Applied', 'created_ids' => json_encode($created, JSON_THROW_ON_ERROR)], $this->now());
            return $this->serialize($updated);
        });
    }

    public function reject(int $userId, string $id, array $input): array
    {
        $this->keys($input, ['base_version']); $version = $input['base_version'] ?? null;
        if (!is_int($version) || $version < 1) throw new ValidationException(['base_version' => ['The version is invalid.']]);
        return $this->transactions->run(function () use ($userId, $id, $version): array {
            $this->planningRepository->lockOwner($userId); $current = $this->owned($userId, $id, true);
            if ($current['status'] === 'Rejected') return $this->serialize($current);
            if ($current['status'] !== 'Proposed') throw new ValidationException(['status' => ['The proposal cannot be rejected.']]);
            if ((int) $current['version'] !== $version) throw new HttpException(409, 'VERSION_CONFLICT', 'The proposal has changed.');
            return $this->serialize($this->actions->update($userId, $id, ['status' => 'Rejected'], $this->now()));
        });
    }

    /** @return array{objects:list<array<string,mixed>>,versions:list<array{type:string,id:string,version:int}>} */
    private function loadContext(int $userId, mixed $requested): array
    {
        if (!is_array($requested) || !array_is_list($requested) || count($requested) > 50) throw new ValidationException(['context' => ['The selected context is invalid.']]);
        $objects = []; $versions = [];
        foreach ($requested as $item) {
            if (!is_array($item) || array_diff(array_keys($item), ['type','id']) !== [] || !is_string($item['type'] ?? null) || !is_string($item['id'] ?? null)) throw new ValidationException(['context' => ['The selected context is invalid.']]);
            $type = $item['type']; $id = $item['id'];
            if (in_array($type, ['area','goal','milestone','task'], true)) $data = $this->planning->show($type, $userId, $id);
            elseif ($type === 'review') $data = $this->reviews->show($userId, $id);
            else throw new ValidationException(['context' => ['This context type is not allowed.']]);
            $allowed = array_intersect_key($data, array_flip(['id','name','description','expected_result','completion_criteria','importance','status','deadline','progress','kind','period_start','period_end','snapshot','version']));
            $objects[] = ['type' => $type, 'data' => $allowed];
            $versions[] = ['type' => $type, 'id' => $id, 'version' => (int) $data['version']];
        }
        return compact('objects','versions');
    }

    /**
     * @param list<array<string, mixed>> $operations
     * @param array<string, array{type:string,id:string,version:int}> $allowedReferences
     * @return array<string, string>
     */
    private function execute(int $userId, array $operations, array $allowedReferences): array
    {
        $locals = [];
        $existing = $allowedReferences;

        foreach ($operations as $operation) {
            $op = $operation['op'];
            if (str_starts_with($op, 'create_')) {
                $parent = $this->resolve($operation['parent'], $locals, $existing, $allowedReferences);
                $this->assertParentType($op, $parent);
                $fields = $operation['fields'];
                $created = match ($op) {
                    'create_goal' => $this->planning->create('goal', $userId, [...$fields, 'area_id' => $parent['type'] === 'area' ? $parent['id'] : null, 'parent_goal_id' => $parent['type'] === 'goal' ? $parent['id'] : null]),
                    'create_milestone' => $this->planning->create('milestone', $userId, [...$fields, 'goal_id' => $parent['id']]),
                    'create_task' => $this->planning->create('task', $userId, [...$fields, 'goal_id' => $parent !== null && $parent['type'] === 'goal' ? $parent['id'] : null, 'milestone_id' => $parent !== null && $parent['type'] === 'milestone' ? $parent['id'] : null]),
                };
                $locals[$operation['local_id']] = ['type' => substr($op, 7), 'id' => (string) $created['id'], 'version' => (int) $created['version']];
            } elseif ($op === 'add_contribution') {
                $source = $this->resolve($operation['source'], $locals, $existing, $allowedReferences);
                $target = $this->resolve($operation['target'], $locals, $existing, $allowedReferences);
                if (!in_array($source['type'], ['goal', 'milestone', 'task'], true) || $target['type'] !== 'goal') {
                    throw new ValidationException(['operations' => ['The contribution relationship has an invalid object type.']]);
                }
                $updated = $this->planning->addContribution($source['type'], $userId, $source['id'], ['goal_id' => $target['id'], 'base_version' => $source['version']]);
                $this->refreshReference($locals, $existing, $source['type'], $source['id'], (int) $updated['version']);
            } else {
                $source = $this->resolve($operation['source'], $locals, $existing, $allowedReferences);
                $target = $this->resolve($operation['target'], $locals, $existing, $allowedReferences);
                if ($source['type'] !== 'milestone' || $target['type'] !== 'milestone') {
                    throw new ValidationException(['operations' => ['A Milestone dependency must connect two Milestones.']]);
                }
                $updated = $this->planning->addDependency($userId, $source['id'], ['prerequisite_id' => $target['id'], 'base_version' => $source['version']]);
                $this->refreshReference($locals, $existing, $source['type'], $source['id'], (int) $updated['version']);
            }
        }

        return array_map(static fn (array $value): string => $value['id'], $locals);
    }

    /**
     * Existing references are constrained to the immutable context selected by
     * the user. The mutable copy carries version increments between operations.
     *
     * @param array<string, array{type:string,id:string,version:int}> $locals
     * @param array<string, array{type:string,id:string,version:int}> $existing
     * @param array<string, array{type:string,id:string,version:int}> $allowedReferences
     * @return array{type:string,id:string,version:int}|null
     */
    private function resolve(mixed $reference, array $locals, array $existing, array $allowedReferences): ?array
    {
        if ($reference === null) {
            return null;
        }
        if (isset($reference['local_id'])) {
            return $locals[$reference['local_id']];
        }

        $type = (string) $reference['type'];
        $id = (string) $reference['existing_id'];
        $key = $this->referenceKey($type, $id);
        $selected = $allowedReferences[$key] ?? null;
        if ($selected === null || (int) $selected['version'] !== (int) $reference['version']) {
            throw new ValidationException(['reference' => ['AI may reference only data explicitly selected by the user.']]);
        }

        return $existing[$key];
    }

    /** @param array{type:string,id:string,version:int}|null $parent */
    private function assertParentType(string $operation, ?array $parent): void
    {
        $valid = match ($operation) {
            'create_goal' => $parent !== null && in_array($parent['type'], ['area', 'goal'], true),
            'create_milestone' => $parent !== null && $parent['type'] === 'goal',
            'create_task' => $parent === null || in_array($parent['type'], ['goal', 'milestone'], true),
            default => false,
        };
        if (!$valid) {
            throw new ValidationException(['operations' => ['The parent object in the AI operation is invalid.']]);
        }
    }
    private function assertReferenceVersion(int $userId, array $reference): void
    {
        $type=$reference['type']; $id=$reference['id'];
        $current = in_array($type,['area','goal','milestone','task'],true) ? $this->planning->show($type,$userId,$id) : ($type==='review' ? $this->reviews->show($userId,$id) : null);
        if ($current===null || (int)$current['version'] !== (int)$reference['version']) throw new HttpException(409,'AI_CONTEXT_STALE','The selected AI context has changed; generate a new proposal.');
    }
    /**
     * @param array<string, array{type:string,id:string,version:int}> $locals
     * @param array<string, array{type:string,id:string,version:int}> $existing
     */
    private function refreshReference(array &$locals, array &$existing, string $type, string $id, int $version): void
    {
        foreach ($locals as &$local) {
            if ($local['type'] === $type && $local['id'] === $id) {
                $local['version'] = $version;
            }
        }
        unset($local);

        $key = $this->referenceKey($type, $id);
        if (isset($existing[$key])) {
            $existing[$key]['version'] = $version;
        }
    }

    private function referenceKey(string $type, string $id): string
    {
        return $type."\0".$id;
    }
    private function owned(int $userId,string $id,bool $lock=false): array { return $this->actions->find($userId,$id,$lock)??throw new HttpException(404,'NOT_FOUND','The requested resource was not found.'); }
    private function serialize(array $row): array { $row['version']=(int)$row['version']; $row['proposal']=json_decode((string)$row['proposal'],true,512,JSON_THROW_ON_ERROR); $row['context_versions']=json_decode((string)$row['context_versions'],true,512,JSON_THROW_ON_ERROR); $row['created_ids']=$row['created_ids']===null?null:json_decode((string)$row['created_ids'],true,512,JSON_THROW_ON_ERROR); foreach(['created_at','updated_at','expires_at'] as $f)$row[$f]=Timestamp::api((string)$row[$f]); unset($row['user_id']); return $row; }
    private function keys(array $input,array $allowed): void { if(array_diff(array_keys($input),$allowed)!==[])throw new ValidationException(['_unknown'=>['The request contains an unsupported field.']]); }
    private function now(): string { return Timestamp::database($this->clock->now()); }
}
