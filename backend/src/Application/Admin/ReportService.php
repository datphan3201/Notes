<?php

declare(strict_types=1);

namespace Planner\Application\Admin;

use Planner\Application\Notes\NoteShareService;
use Planner\Application\Notifications\NotificationService;
use Planner\Http\HttpException;
use Planner\Http\ValidationException;
use Planner\Infrastructure\Database\TransactionManager;
use Planner\Infrastructure\Persistence\Pdo\Account\PdoAccountRepository;
use Planner\Infrastructure\Persistence\Pdo\Admin\PdoRegistrationInviteRepository;
use Planner\Infrastructure\Persistence\Pdo\Admin\PdoReportRepository;
use Planner\Infrastructure\Persistence\Pdo\Admin\PdoSystemSettingRepository;
use Planner\Support\Clock;
use Planner\Support\Timestamp;
use Planner\Support\UuidGenerator;

/** Reports on shared Notes, account locking, registration and administrator settings. */
final readonly class ReportService
{
    public function __construct(
        private PdoReportRepository $reports,
        private PdoSystemSettingRepository $settings,
        private PdoRegistrationInviteRepository $invitations,
        private PdoAccountRepository $accounts,
        private NoteShareService $shares,
        private AccountLockService $locks,
        private AdminActionLog $log,
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
            'actions' => ReportOutcome::decode($row['actions'] ?? null),
            'note' => ['id' => (string) $row['note_id'], 'title' => (string) $row['note_title'], 'excerpt' => (string) $row['note_excerpt']],
            'reporter' => ['id' => (string) $row['reporter_id'], 'display_name' => (string) $row['reporter_name'], 'email' => (string) $row['reporter_email']],
            'owner' => ['id' => (string) $row['note_owner_id'], 'display_name' => (string) $row['owner_name'], 'email' => (string) $row['owner_email'], 'locked' => $row['owner_locked_at'] !== null],
            'created_at' => Timestamp::api((string) $row['created_at']),
            'resolved_at' => Timestamp::api($row['resolved_at'] === null ? null : (string) $row['resolved_at']),
        ], $this->reports->list($status));
    }

    /**
     * Resolving means acting: revoke the Note's shares and/or lock its owner, or confirm that
     * the owner is already locked. Dismissing takes no action. The reporter is told which.
     *
     * @param list<string> $actions revoke_shares, warn_owner, lock_owner
     */
    public function resolve(int $adminId, string $reportId, string $status, ?string $response, array $actions = []): void
    {
        $this->transactions->run(function () use ($adminId, $reportId, $status, $response, $actions): void {
            $report = $this->reports->find($reportId, true) ?? throw new HttpException(404, 'NOT_FOUND', 'The requested resource was not found.');
            if ($report['status'] !== 'open') {
                throw new ValidationException(['status' => ['This report was already handled.']]);
            }
            $ownerId = (int) $report['note_owner_id'];
            ReportOutcome::assertConsistent($status, $actions, $this->locks->isLocked($ownerId));
            $taken = [];
            if (in_array('revoke_shares', $actions, true)) {
                $removed = $this->shares->revokeAll($ownerId, (string) $report['note_id']);
                $taken[] = 'revoke_shares';
                $this->log->record($adminId, 'note.revoke_shares', 'note', (string) $report['note_id'], $report['note_title'].' — '.count($removed).' recipient(s)');
            }
            if (in_array('warn_owner', $actions, true)) {
                // The warning never names the reporter.
                $this->notifications->notify($ownerId, 'admin_warning', $reportId, [
                    'title' => 'An administrator reviewed a report about your shared note',
                    'body' => (string) $report['note_title'].' — please follow the community rules when sharing.',
                    'url' => '/',
                ], always: true);
                $taken[] = 'warn_owner';
                $this->log->record($adminId, 'account.warn', 'user', (string) $ownerId, (string) $report['note_title']);
            }
            if (in_array('lock_owner', $actions, true)) {
                $this->locks->lock($adminId, $ownerId, 'Note report: '.mb_substr((string) $report['reason'], 0, 200, 'UTF-8'));
                $taken[] = 'lock_owner';
            }
            $this->reports->resolve($reportId, $status, $response, $adminId, $this->now(), $taken);
            $this->log->record($adminId, 'report.'.$status, 'note_report', $reportId, $report['note_title'].($taken === [] ? '' : ' — '.ReportOutcome::describe($taken)));
            foreach ($this->accounts->adminIds() as $otherAdmin) {
                $this->notifications->resolveSubject($otherAdmin, 'report_new', $reportId);
            }
            $this->notifications->notify((int) $report['reporter_id'], 'report_resolved', $reportId, [
                'title' => ReportOutcome::title($status),
                'body' => $response ?? (string) $report['note_title'],
                'url' => '/',
            ]);
        });
    }

    public function setLocked(int $adminId, int $userId, bool $locked, ?string $reason): void
    {
        $locked ? $this->locks->lock($adminId, $userId, $reason) : $this->locks->unlock($adminId, $userId);
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
            'locked_by' => $row['locked_at'] === null || $row['locked_by_name'] === null ? null : (string) $row['locked_by_name'],
            'locked_at' => Timestamp::api($row['locked_at'] === null ? null : (string) $row['locked_at']),
            'created_at' => Timestamp::api((string) $row['created_at']),
        ], $this->accounts->adminUserList($query));
    }

    /** @return array{history_limit:int,registration_mode:string} */
    public function settings(): array
    {
        return ['history_limit' => $this->settings->historyLimit(), 'registration_mode' => $this->settings->registrationMode()];
    }

    /**
     * @param array{history_limit?:int,registration_mode?:string} $changes
     *
     * @return array{history_limit:int,registration_mode:string}
     */
    public function updateSettings(int $adminId, array $changes): array
    {
        $this->transactions->run(function () use ($adminId, $changes): void {
            $current = $this->settings();
            $now = $this->now();
            if (isset($changes['history_limit']) && $changes['history_limit'] !== $current['history_limit']) {
                $this->settings->setHistoryLimit($changes['history_limit'], $now);
                $this->log->record($adminId, 'settings.history_limit', 'setting', 'history_limit', $current['history_limit'].' → '.$changes['history_limit']);
            }
            if (isset($changes['registration_mode']) && $changes['registration_mode'] !== $current['registration_mode']) {
                $this->settings->setRegistrationMode($changes['registration_mode'], $now);
                $this->log->record($adminId, 'settings.registration_mode', 'setting', 'registration_mode', $current['registration_mode'].' → '.$changes['registration_mode']);
            }
        });

        return $this->settings();
    }

    /** @return list<array<string, mixed>> */
    public function invites(): array
    {
        return array_map(static fn (array $row): array => [
            'email' => (string) $row['email'],
            'used' => $row['used_at'] !== null,
            'used_by' => $row['used_at'] === null ? null : (string) ($row['used_by_name'] ?? ''),
            'created_at' => Timestamp::api((string) $row['created_at']),
            'used_at' => Timestamp::api($row['used_at'] === null ? null : (string) $row['used_at']),
        ], $this->invitations->list());
    }

    /** @return list<array<string, mixed>> */
    public function invite(int $adminId, string $email): array
    {
        $this->transactions->run(function () use ($adminId, $email): void {
            if ($this->accounts->findByEmail($email) !== null) {
                throw new ValidationException(['email' => ['An account already uses this email.']]);
            }
            if ($this->invitations->add($email, $adminId, $this->now())) {
                $this->log->record($adminId, 'registration.invite', 'email', $email, $email);
            }
        });

        return $this->invites();
    }

    /** @return list<array<string, mixed>> */
    public function removeInvite(int $adminId, string $email): array
    {
        $this->transactions->run(function () use ($adminId, $email): void {
            if ($this->invitations->remove($email)) {
                $this->log->record($adminId, 'registration.uninvite', 'email', $email, $email);
            }
        });

        return $this->invites();
    }

    private function now(): string
    {
        return Timestamp::database($this->clock->now());
    }
}
