<?php

declare(strict_types=1);

namespace Planner\Application\Admin;

use Planner\Application\Files\ImageNormalizer;
use Planner\Application\Notifications\NotificationService;
use Planner\Domain\Files\UploadedFile;
use Planner\Http\HttpException;
use Planner\Http\ValidationException;
use Planner\Infrastructure\Database\TransactionManager;
use Planner\Infrastructure\Persistence\Pdo\Account\PdoAccountRepository;
use Planner\Infrastructure\Persistence\Pdo\Admin\PdoUserReportRepository;
use Planner\Infrastructure\Storage\LocalPrivateStorage;
use Planner\Support\Clock;
use Planner\Support\TextNormalizer;
use Planner\Support\Timestamp;
use Planner\Support\UuidGenerator;

/**
 * Reports about another user's behaviour, filed from Settings with optional
 * image evidence. The reporter names the person by email and always gets the
 * same answer, so the form cannot be used to discover which emails have
 * accounts; administrators see whether the email matched an account.
 */
final readonly class UserReportService
{
    public const MAX_EVIDENCE = 3;
    private const MAX_IMAGE_BYTES = 5_242_880;

    public function __construct(
        private PdoUserReportRepository $reports,
        private PdoAccountRepository $accounts,
        private NotificationService $notifications,
        private LocalPrivateStorage $storage,
        private TransactionManager $transactions,
        private UuidGenerator $uuid,
        private Clock $clock,
    ) {
    }

    /** @param list<UploadedFile> $evidence */
    public function report(int $reporterId, mixed $email, mixed $reason, array $evidence): void
    {
        $email = is_string($email) ? mb_strtolower(trim($email), 'UTF-8') : '';
        $reason = is_string($reason) ? trim(TextNormalizer::body($reason)) : '';
        $errors = [];
        if ($email === '' || mb_strlen($email, 'UTF-8') > 254 || filter_var($email, FILTER_VALIDATE_EMAIL) === false) {
            $errors['email'][] = 'Enter the email address of the person you are reporting.';
        }
        $length = TextNormalizer::codePoints($reason);
        if ($length < 10 || $length > 2000) {
            $errors['reason'][] = 'Describe what happened in 10 to 2000 characters.';
        }
        if (count($evidence) > self::MAX_EVIDENCE) {
            $errors['evidence'][] = 'Attach at most '.self::MAX_EVIDENCE.' images.';
        }
        if ($errors !== []) {
            throw new ValidationException($errors);
        }

        // Images are checked and re-encoded before anything is stored.
        $images = array_map(fn (UploadedFile $file): string => (new ImageNormalizer)->jpeg($file, 'evidence', self::MAX_IMAGE_BYTES, 2560), $evidence);
        $paths = [];
        try {
            foreach ($images as $bytes) {
                $paths[] = $this->storage->putBytes('reports', $bytes, 'jpg');
            }
            $this->transactions->run(function () use ($reporterId, $email, $reason, $paths): void {
                $reporter = $this->accounts->findById($reporterId, true) ?? throw new \RuntimeException('User disappeared.');
                if (mb_strtolower($reporter->email, 'UTF-8') === $email) {
                    throw new ValidationException(['email' => ['You cannot report yourself.']]);
                }
                if ($this->reports->hasOpenReport($reporterId, $email)) {
                    throw new ValidationException(['email' => ['You already have an open report about this person. An administrator will review it.']]);
                }
                $target = $this->accounts->findByEmail($email);
                $id = $this->uuid->generate();
                $now = $this->now();
                $this->reports->insert([
                    'id' => $id,
                    'reporter_id' => $reporterId,
                    'target_email' => $email,
                    'target_user_id' => $target?->id,
                    'reason' => $reason,
                    'created_at' => $now,
                ]);
                foreach ($paths as $index => $path) {
                    $this->reports->insertEvidence($id, $index + 1, $path, $now);
                }
                foreach ($this->accounts->adminIds() as $adminId) {
                    $this->notifications->notify($adminId, 'report_new', $id, [
                        'title' => $reporter->displayName.' reported a user',
                        'body' => $email.' — '.mb_substr($reason, 0, 200, 'UTF-8'),
                        'url' => '/admin',
                    ], always: true);
                }
            });
        } catch (\Throwable $error) {
            foreach ($paths as $path) {
                $this->storage->delete($path);
            }
            throw $error;
        }
    }

    /** @return list<array<string, mixed>> the reporter's own reports; never reveals whether the email matched */
    public function mine(int $reporterId): array
    {
        return array_map(static fn (array $row): array => [
            'id' => (string) $row['id'],
            'email' => (string) $row['target_email'],
            'reason' => (string) $row['reason'],
            'status' => (string) $row['status'],
            'response' => $row['response'] === null ? null : (string) $row['response'],
            'evidence_count' => (int) $row['evidence_count'],
            'created_at' => Timestamp::api((string) $row['created_at']),
            'resolved_at' => Timestamp::api($row['resolved_at'] === null ? null : (string) $row['resolved_at']),
        ], $this->reports->forReporter($reporterId));
    }

    /** @return list<array<string, mixed>> */
    public function list(string $status): array
    {
        return array_map(static fn (array $row): array => [
            'id' => (string) $row['id'],
            'status' => (string) $row['status'],
            'reason' => (string) $row['reason'],
            'response' => $row['response'] === null ? null : (string) $row['response'],
            'reported_email' => (string) $row['target_email'],
            'reporter' => ['id' => (string) $row['reporter_id'], 'display_name' => (string) $row['reporter_name'], 'email' => (string) $row['reporter_email']],
            'target' => $row['target_user_id'] === null ? null : [
                'id' => (string) $row['target_user_id'],
                'display_name' => (string) $row['target_name'],
                'email' => (string) $row['target_current_email'],
                'locked' => $row['target_locked_at'] !== null,
            ],
            // range(1, 0) would yield [1, 0], so an empty report needs the guard.
            'evidence' => (int) $row['evidence_count'] === 0 ? [] : array_map(
                static fn (int $position): string => '/admin/user-reports/'.$row['id'].'/evidence/'.$position,
                range(1, (int) $row['evidence_count']),
            ),
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
            foreach ($this->accounts->adminIds() as $admin) {
                $this->notifications->resolveSubject($admin, 'report_new', $reportId);
            }
            $this->notifications->notify((int) $report['reporter_id'], 'report_resolved', $reportId, [
                'title' => $status === 'resolved' ? 'Your report was reviewed and action was taken' : 'Your report was reviewed',
                'body' => $response ?? (string) $report['target_email'],
                'url' => '/settings/reports',
            ]);
        });
    }

    /** Absolute path of one evidence image; callers must already be administrators. */
    public function evidence(string $reportId, string $position): string
    {
        $path = ctype_digit($position) ? $this->reports->evidencePath($reportId, (int) $position) : null;

        return $this->storage->resolve($path ?? throw new HttpException(404, 'NOT_FOUND', 'The requested resource was not found.'));
    }

    private function now(): string
    {
        return Timestamp::database($this->clock->now());
    }
}
