<?php

declare(strict_types=1);

namespace Planner\Application\Reviews;

use DateTimeImmutable;
use DateTimeZone;
use PDOException;
use Planner\Http\HttpException;
use Planner\Http\ValidationException;
use Planner\Infrastructure\Database\TransactionManager;
use Planner\Infrastructure\Persistence\Pdo\Planning\PdoPlanningRepository;
use Planner\Infrastructure\Persistence\Pdo\Reviews\PdoReviewRepository;
use Planner\Support\Clock;
use Planner\Support\TextNormalizer;
use Planner\Support\Timestamp;
use Planner\Support\UuidGenerator;

final readonly class ReviewService
{
    public function __construct(
        private PdoReviewRepository $reviews,
        private PdoPlanningRepository $planning,
        private TransactionManager $transactions,
        private UuidGenerator $uuid,
        private Clock $clock,
    ) {}

    public function list(int $userId): array { return array_map($this->serialize(...), $this->reviews->list($userId)); }
    public function show(int $userId, string $id): array { return $this->serialize($this->owned($userId, $id)); }

    public function create(int $userId, array $input): array
    {
        $this->keys($input, ['kind', 'date']);
        $kind = $input['kind'] ?? null;
        if (!in_array($kind, ['Daily', 'Weekly', 'Monthly'], true)) throw new ValidationException(['kind' => ['The Review type is invalid.']]);
        $timezone = $this->planning->ownerTimezone($userId);
        $date = $this->date($input['date'] ?? $this->clock->now()->setTimezone(new DateTimeZone($timezone))->format('Y-m-d'));
        [$start, $end] = $this->period($kind, $date, $timezone);
        try {
            return $this->transactions->run(function () use ($userId, $kind, $timezone, $start, $end): array {
                $this->planning->lockOwner($userId);
                $snapshot = $this->snapshot($userId, $start, $end, $timezone);
                $row = $this->reviews->insert($userId, $this->uuid->generate(), [
                    'kind' => $kind, 'period_start' => $start, 'period_end' => $end,
                    'timezone' => $timezone, 'snapshot_schema_version' => 1,
                    'snapshot' => json_encode($snapshot, JSON_THROW_ON_ERROR),
                    'reflection' => '', 'went_well' => '', 'went_wrong' => '', 'change_next' => '',
                    'status' => 'Draft', 'finalized_at' => null,
                ], $this->now());
                return $this->serialize($row);
            });
        } catch (PDOException $exception) {
            if ((string) $exception->getCode() === '23000') throw new ValidationException(['period' => ['A Review already exists for this period.']]);
            throw $exception;
        }
    }

    public function update(int $userId, string $id, array $input): array
    {
        $this->keys($input, ['base_version', 'reflection', 'went_well', 'went_wrong', 'change_next']);
        $version = $this->version($input); unset($input['base_version']);
        $changes = []; foreach ($input as $field => $value) $changes[$field] = $this->text($value, $field);
        return $this->mutateDraft($userId, $id, $version, $changes);
    }

    public function transition(int $userId, string $id, string $action, array $input): array
    {
        $this->keys($input, ['base_version']); $version = $this->version($input);
        return $this->transactions->run(function () use ($userId, $id, $action, $version): array {
            $this->planning->lockOwner($userId); $current = $this->owned($userId, $id, true);
            $this->assertVersion($current, $version);
            $changes = match ($action) {
                'refresh' => $current['status'] === 'Draft' ? ['snapshot' => json_encode($this->snapshot($userId, (string) $current['period_start'], (string) $current['period_end'], (string) $current['timezone']), JSON_THROW_ON_ERROR)] : throw new ValidationException(['status' => ['Only a draft Review can be refreshed.']]),
                'finalize' => $current['status'] === 'Draft' ? ['status' => 'Finalized', 'finalized_at' => $this->now()] : throw new ValidationException(['status' => ['The Review is already finalized.']]),
                'reopen' => $current['status'] === 'Finalized' ? ['status' => 'Draft', 'finalized_at' => null] : throw new ValidationException(['status' => ['The Review is already a draft.']]),
                default => throw new HttpException(404, 'NOT_FOUND', 'The operation was not found.'),
            };
            return $this->serialize($this->reviews->update($userId, $id, $changes, $this->now()));
        });
    }

    private function mutateDraft(int $userId, string $id, int $version, array $changes): array
    {
        return $this->transactions->run(function () use ($userId, $id, $version, $changes): array {
            $this->planning->lockOwner($userId); $current = $this->owned($userId, $id, true);
            if ($current['status'] !== 'Draft') throw new ValidationException(['status' => ['A finalized Review is read-only.']]);
            $same = true; foreach ($changes as $key => $value) if ($current[$key] !== $value) $same = false;
            if ($same) return $this->serialize($current);
            $this->assertVersion($current, $version);
            return $this->serialize($this->reviews->update($userId, $id, $changes, $this->now()));
        });
    }

    private function snapshot(int $userId, string $start, string $end, string $timezone): array
    {
        return ['schema_version' => 1, 'generated_at' => Timestamp::api($this->now()), 'timezone' => $timezone, 'period_start' => $start, 'period_end' => $end, ...$this->reviews->facts($userId, $start, $end)];
    }
    private function period(string $kind, string $date, string $timezone): array
    {
        $value = new DateTimeImmutable($date, new DateTimeZone($timezone));
        return match ($kind) { 'Daily' => [$date, $date], 'Weekly' => [$value->modify('monday this week')->format('Y-m-d'), $value->modify('sunday this week')->format('Y-m-d')], 'Monthly' => [$value->modify('first day of this month')->format('Y-m-d'), $value->modify('last day of this month')->format('Y-m-d')] };
    }
    private function owned(int $userId, string $id, bool $lock = false): array { return $this->reviews->find($userId, $id, $lock) ?? throw new HttpException(404, 'NOT_FOUND', 'The requested resource was not found.'); }
    private function serialize(array $row): array { $row['version'] = (int) $row['version']; $snapshot = json_decode((string) $row['snapshot'], true, flags: JSON_THROW_ON_ERROR); if (!is_array($snapshot) || ($snapshot['schema_version'] ?? null) !== 1) throw new \RuntimeException('Unsupported Review snapshot schema.'); $row['snapshot'] = $snapshot; foreach (['created_at','updated_at','finalized_at'] as $field) $row[$field] = Timestamp::api($row[$field] === null ? null : (string) $row[$field]); unset($row['user_id']); return $row; }
    private function assertVersion(array $row, int $version): void { if ((int) $row['version'] !== $version) throw new HttpException(409, 'VERSION_CONFLICT', 'The Review has changed.', payload: ['current' => $this->serialize($row)]); }
    private function version(array $input): int { $value = $input['base_version'] ?? null; if (!is_int($value) || $value < 1) throw new ValidationException(['base_version' => ['The version is invalid.']]); return $value; }
    private function date(mixed $value): string { $date = is_string($value) ? DateTimeImmutable::createFromFormat('!Y-m-d', $value) : false; if (!is_string($value) || preg_match('/^\d{4}-\d{2}-\d{2}$/D', $value) !== 1 || !$date instanceof DateTimeImmutable || $date->format('Y-m-d') !== $value) throw new ValidationException(['date' => ['The date is invalid.']]); return $value; }
    private function text(mixed $value, string $field): string { if (!is_string($value)) throw new ValidationException([$field => ['The value must be a string.']]); $value = TextNormalizer::body($value); if (mb_strlen($value) > 20_000) throw new ValidationException([$field => ['The content is too long.']]); return $value; }
    private function keys(array $input, array $allowed): void { if (array_diff(array_keys($input), $allowed) !== []) throw new ValidationException(['_unknown' => ['The request contains an unsupported field.']]); }
    private function now(): string { return Timestamp::database($this->clock->now()); }
}
