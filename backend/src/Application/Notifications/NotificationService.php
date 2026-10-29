<?php

declare(strict_types=1);

namespace Planner\Application\Notifications;

use Planner\Application\Planning\TaskReminderService;
use Planner\Infrastructure\Mail\PasswordResetMailer;
use Planner\Infrastructure\Persistence\Pdo\Account\PdoAccountRepository;
use Planner\Infrastructure\Persistence\Pdo\Notifications\PdoNotificationRepository;
use Planner\Support\Clock;
use Planner\Support\Timestamp;
use Planner\Support\UuidGenerator;
use Psr\Log\LoggerInterface;

final readonly class NotificationService
{
    /** Types that are also emailed when the recipient allows email notifications. */
    private const EMAILED = ['share_invite', 'team_invite', 'report_resolved', 'team_task_assigned'];

    public function __construct(
        private PdoNotificationRepository $notifications,
        private PdoAccountRepository $accounts,
        private TaskReminderService $reminders,
        private PasswordResetMailer $mail,
        private UuidGenerator $uuid,
        private Clock $clock,
        private LoggerInterface $logger,
        private string $appUrl,
    ) {
    }

    /**
     * Records a notification inside the caller's transaction. Users who turned
     * notifications off receive none unless $always (administrator duties).
     * $coalesce keeps a single unread item per subject (e.g. repeated edits).
     *
     * @param array<string, mixed> $payload title/body/url plus type-specific facts
     */
    public function notify(int $userId, string $type, ?string $subjectId, array $payload, bool $always = false, bool $coalesce = false): void
    {
        $preferences = $this->accounts->preferences($userId);
        if (! $always && ! $preferences['notifications_enabled']) {
            return;
        }
        if ($coalesce && $subjectId !== null && $this->notifications->hasUnread($userId, $type, $subjectId)) {
            return;
        }
        $this->notifications->insert($this->uuid->generate(), $userId, $type, $subjectId, $payload, Timestamp::database($this->clock->now()));

        if ($preferences['notifications_enabled'] && $preferences['email_notifications'] && in_array($type, self::EMAILED, true)) {
            $user = $this->accounts->findById($userId);
            try {
                if ($user !== null) {
                    $this->mail->sendMessage($user->email, 'Planner: '.(string) ($payload['title'] ?? 'Notification'), (string) ($payload['body'] ?? '')."\n\n".$this->appUrl.(string) ($payload['url'] ?? '/'));
                }
            } catch (\Throwable $exception) {
                // Email is a courtesy copy; the in-app notification is authoritative.
                $this->logger->warning('Notification email failed.', ['type' => $type, 'error' => $exception->getMessage()]);
            }
        }
    }

    /** @return array{items:list<array<string,mixed>>,unread:int,reminders:list<array<string,mixed>>} */
    public function inbox(int $userId): array
    {
        $items = array_map(static fn (array $row): array => [
            ...$row,
            'read_at' => $row['read_at'] === null ? null : Timestamp::api($row['read_at']),
            'created_at' => Timestamp::api($row['created_at']),
        ], $this->notifications->latest($userId));
        $reminders = $this->reminders->due($userId);

        return ['items' => $items, 'unread' => $this->notifications->unreadCount($userId) + count($reminders), 'reminders' => $reminders];
    }

    public function markRead(int $userId, ?string $id): void
    {
        $this->notifications->markRead($userId, $id, Timestamp::database($this->clock->now()));
        // "Mark all read" also clears due reminders from the bell.
        if ($id === null) {
            $this->reminders->markRead($userId);
        }
    }

    public function resolveSubject(int $userId, string $type, string $subjectId): void
    {
        $this->notifications->markSubjectRead($userId, $type, $subjectId, Timestamp::database($this->clock->now()));
    }
}
