<?php

declare(strict_types=1);

namespace Planner\Application\Admin;

use Planner\Application\Notes\NoteShareService;
use Planner\Application\Notifications\NotificationService;
use Planner\Http\HttpException;
use Planner\Http\ValidationException;
use Planner\Infrastructure\Database\TransactionManager;
use Planner\Infrastructure\Persistence\Pdo\Account\PdoAccountRepository;
use Planner\Infrastructure\Persistence\Pdo\Admin\PdoReportRepository;
use Planner\Infrastructure\Persistence\Pdo\Admin\PdoSystemSettingRepository;
use Planner\Support\Clock;
use Planner\Support\Timestamp;
use Planner\Support\UuidGenerator;

/** Reports on shared Notes, account locking and administrator settings. */
final readonly class ReportService
{
    public function __construct(
        private PdoReportRepository $reports,
        private PdoSystemSettingRepository $settings,
        private PdoAccountRepository $accounts,
        private NoteShareService $shares,
        private NotificationService $notifications,
        private TransactionManager $transactions,
        private UuidGenerator $uuid,
        private Clock $clock,
    ) {
    }

    /** Only accepted recipients can report; admins see a snapshot, not the live Note. */
    public function report(int $reporterId, string $noteId, string $reason): void
    {
        $this->transactions->run(function () use ($reporterId, $noteId, $reason): void {
            $reporter = $this->accounts->findById($reporterId, true) ?? throw new \RuntimeException('User disappeared.');
            [$note] = $this->shares->accessible($reporterId, $noteId);
            if ($this->reports->hasOpenReport($reporterId, $noteId)) {
                throw new ValidationException(['reason' => ['You already reported this note. An administrator will review it.']]);
            }
            $id = $this->uuid->generate();
            $this->reports->insert([
                'id' => $id,
                'reporter_id' => $reporterId,
                'note_owner_id' => $note->userId,
                'note_id' => $noteId,
                'note_title' => $note->title,
                'note_excerpt' => mb_substr($note->content, 0, 2000, 'UTF-8'),
                'reason' => $reason,
                'created_at' => $this->now(),
            ]);
            foreach ($this->accounts->adminIds() as $adminId) {
                $this->notifications->notify($adminId, 'report_new', $id, [
                    'title' => $reporter->displayName.' reported a note',
                    'body' => $note->title.' — '.mb_substr($reason, 0, 200, 'UTF-8'),
                    'url' => '/admin',
                ], always: true);
            }
        });
    }

    /** @return list<array<string, mixed>> */
    public function list(string $status): array
    {
        return array_map(static fn (array $row): array => [
            'id' => (string) $row['id'],
            'status' => (string) $row['status'],
            'reason' => (string) $row['reason'],
            'response' => $row['response'] === null ? null : (string) $row['response'],
            'note' => ['id' => (string) $row['note_id'], 'title' => (string) $row['note_title'], 'excerpt' => (string) $row['note_excerpt']],
            'reporter' => ['id' => (string) $row['reporter_id'], 'display_name' => (string) $row['reporter_name'], 'email' => (string) $row['reporter_email']],
            'owner' => ['id' => (string) $row['note_owner_id'], 'display_name' => (string) $row['owner_name'], 'email' => (string) $row['owner_email'], 'locked' => $row['owner_locked_at'] !== null],
            'created_at' => Timestamp::api((string) $row['created_at']),
            'resolved_at' => Timestamp::api($row['resolved_at'] === null ? null : (string) $row['resolved_at']),
        ], $this->reports->list($status));
    }

    public function resolve(int $adminId, string $reportId, string $status, ?string $response): void
    {
        $this->transactions->run(function () use ($adminId, $reportId, $status, $response): void {
            $report = $this->reports->find($reportId, true) ?? throw new HttpException(404, 'NOT_FOUND', 'The requested resource was not found.');
            if ($report['status'] !== 'open') {
                throw new ValidationException(['status' => ['This report was already handled.']]);
            }
            $this->reports->resolve($reportId, $status, $response, $adminId, $this->now());
            foreach ($this->accounts->adminIds() as $otherAdmin) {
                $this->notifications->resolveSubject($otherAdmin, 'report_new', $reportId);
            }
            $this->notifications->notify((int) $report['reporter_id'], 'report_resolved', $reportId, [
                'title' => $status === 'resolved' ? 'Your report was reviewed and action was taken' : 'Your report was reviewed',
                'body' => $response ?? (string) $report['note_title'],
                'url' => '/',
            ]);
        });
    }

    public function setLocked(int $adminId, int $userId, bool $locked, ?string $reason): void
    {
        if ($adminId === $userId) {
            throw new ValidationException(['user' => ['You cannot lock your own account.']]);
        }
        $this->transactions->run(function () use ($userId, $locked, $reason): void {
            $this->accounts->findById($userId, true) ?? throw new HttpException(404, 'NOT_FOUND', 'The requested resource was not found.');
            $now = $this->now();
            $this->accounts->setLocked($userId, $locked ? $now : null, $locked ? $reason : null, $now);
            if ($locked) {
                $this->accounts->deleteSessions($userId);
            }
        });
    }

    /** @return list<array<string, mixed>> */
    public function users(string $query): array
    {
        return array_map(static fn (array $row): array => [
            'id' => (string) $row['id'],
            'email' => (string) $row['email'],
            'display_name' => (string) $row['display_name'],
            'role' => (string) $row['role'],
            'locked' => $row['locked_at'] !== null,
            'locked_reason' => $row['locked_reason'] === null ? null : (string) $row['locked_reason'],
            'created_at' => Timestamp::api((string) $row['created_at']),
        ], $this->accounts->adminUserList($query));
    }

    /** @return array{history_limit:int} */
    public function settings(): array
    {
        return ['history_limit' => $this->settings->historyLimit()];
    }

    /** @return array{history_limit:int} */
    public function updateSettings(int $historyLimit): array
    {
        $this->transactions->run(fn () => $this->settings->setHistoryLimit($historyLimit, $this->now()));

        return $this->settings();
    }

    private function now(): string
    {
        return Timestamp::database($this->clock->now());
    }
}
