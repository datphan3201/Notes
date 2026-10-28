<?php

declare(strict_types=1);
namespace Planner\Application\Planning;

use Planner\Infrastructure\Persistence\Pdo\Planning\PdoReminderRepository;
use Planner\Infrastructure\Persistence\Pdo\Account\PdoAccountRepository;
use Planner\Infrastructure\Database\TransactionManager;
use Planner\Infrastructure\Mail\PasswordResetMailer;
use Planner\Support\Clock;
use Planner\Support\Timestamp;

final readonly class TaskReminderService
{
    public function __construct(private PdoReminderRepository $reminders, private PdoAccountRepository $accounts, private TransactionManager $transactions, private PasswordResetMailer $mail, private Clock $clock, private string $appUrl)
    {
    }

    /** @return list<array<string,mixed>> */
    public function due(int $userId): array
    {
        if (!$this->accounts->preferences($userId)['notifications_enabled']) {
            return [];
        }
        $now = Timestamp::database($this->clock->now());
        $personal = array_map(static fn (array $row): array => [...$row, 'reminder_at' => Timestamp::api($row['reminder_at']), 'url' => '/tasks/'.$row['id']], $this->reminders->due($userId, $now));
        $team = array_map(static fn (array $row): array => ['id' => $row['id'], 'name' => $row['name'], 'reminder_at' => Timestamp::api($row['reminder_at']), 'url' => '/teamwork?goal='.$row['team_goal_id']], $this->reminders->teamDue($userId, $now));

        return [...$personal, ...$team];
    }

    /** @return array{sent:int,failed:int} */
    public function send(): array
    {
        $sent = 0;
        $failed = 0;
        $now = Timestamp::database($this->clock->now());
        foreach ($this->reminders->owners($now) as $userId) {
            try {
                $sent += $this->transactions->run(function () use ($userId, $now): int {
                    $user = $this->accounts->findById($userId, true);
                    $prefs = $this->accounts->preferences($userId);
                    if ($user === null || !$prefs['notifications_enabled'] || !$prefs['email_notifications']) {
                        return 0;
                    }
                    $count = 0;
                    foreach ($this->reminders->due($userId, $now, true) as $task) {
                        $this->mail->sendMessage($user->email, 'Planner task reminder', 'Task: '.$task['name']."\n".$this->appUrl.'/tasks/'.$task['id']);
                        $this->reminders->sent($userId, $task['id'], $now);
                        $count++;
                    }
                    return $count;
                });
            } catch (\Throwable) {
                $failed++;
            }
        }
        return ['sent' => $sent, 'failed' => $failed];
    }
}
