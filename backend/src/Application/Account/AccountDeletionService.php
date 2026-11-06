<?php

declare(strict_types=1);

namespace Planner\Application\Account;

use Planner\Application\Admin\AdminActionLog;
use Planner\Application\Files\ProcessFileDeletion;
use Planner\Domain\Account\UserRecord;
use Planner\Http\HttpException;
use Planner\Http\ValidationException;
use Planner\Infrastructure\Database\TransactionManager;
use Planner\Infrastructure\Persistence\Pdo\Account\PdoAccountRepository;
use Planner\Infrastructure\Persistence\Pdo\Files\PendingDeletionRepository;
use Planner\Infrastructure\Persistence\Pdo\PdoCascadeDeleter;
use Planner\Support\Clock;
use Planner\Support\Timestamp;

/**
 * Deletes an account for good: the user, everything they own (planning, habits, notes and
 * their files, reviews, shares, sessions) and what only existed for them (their shares with
 * others, team goals they created, reports they filed). Reports about them and administrator
 * history stay, with the link to the account cleared.
 *
 * An administrator deletes other ordinary accounts after typing the account's email; anyone may
 * delete their own account with their password. Administrator accounts are never deleted here:
 * their role is removed with the server console first, so the last administrator cannot vanish.
 */
final readonly class AccountDeletionService
{
    /** Private file paths held by rows that disappear with an account. */
    private const FILES = [
        'attachments' => 'path',
        'user_backgrounds' => 'path',
        'user_preferences' => 'background_path',
        'users' => 'avatar_path',
        'user_report_evidence' => 'path',
    ];

    public function __construct(
        private PdoAccountRepository $accounts,
        private PdoCascadeDeleter $deleter,
        private TransactionManager $transactions,
        private ProcessFileDeletion $files,
        private PendingDeletionRepository $pending,
        private AdminActionLog $log,
        private Clock $clock,
    ) {
    }

    /** @param array<string, mixed> $input {confirm_email} @return array{deleted: string} */
    public function deleteByAdmin(int $adminId, int $userId, array $input): array
    {
        if ($adminId === $userId) {
            throw new ValidationException(['user' => ['Delete your own account from Settings › Security instead.']]);
        }
        $paths = [];
        $email = $this->transactions->run(function () use ($adminId, $userId, $input, &$paths): string {
            $user = $this->accounts->findById($userId, true) ?? throw new HttpException(404, 'NOT_FOUND', 'The requested resource was not found.');
            if ($user->isAdmin()) {
                throw new ValidationException(['user' => ['Administrators cannot be deleted here. Remove the admin role with the server console first.']]);
            }
            $typed = is_string($input['confirm_email'] ?? null) ? mb_strtolower(trim($input['confirm_email'])) : '';
            if ($typed !== mb_strtolower($user->email)) {
                throw new ValidationException(['confirm_email' => ['Type the account’s email exactly to confirm.']]);
            }
            $paths = $this->deleteUser($user);
            $this->log->record($adminId, 'account.delete', 'user', (string) $userId, $user->email);

            return $user->email;
        });
        $this->files->handle($paths);

        return ['deleted' => $email];
    }

    /** @param array<string, mixed> $input {password} */
    public function deleteOwn(UserRecord $user, array $input): void
    {
        $password = $input['password'] ?? null;
        if (!is_string($password) || $password === '') {
            throw new ValidationException(['password' => ['Enter your password to delete your account.']]);
        }
        $paths = [];
        $this->transactions->run(function () use ($user, $password, &$paths): void {
            $current = $this->accounts->findById($user->id, true) ?? throw new HttpException(404, 'NOT_FOUND', 'The account was not found.');
            if ($current->isAdmin()) {
                throw new ValidationException(['password' => ['An administrator account cannot be deleted. Remove the admin role with the server console first.']]);
            }
            if (!password_verify($password, $current->passwordHash)) {
                throw new ValidationException(['password' => ['The password is incorrect.']]);
            }
            $paths = $this->deleteUser($current);
        });
        $this->files->handle($paths);
    }

    /**
     * Deletes the account's rows and queues its private files, which are removed after the
     * commit (a failed removal is retried by files:prune).
     *
     * @return list<string> the queued paths
     */
    private function deleteUser(UserRecord $user): array
    {
        $rows = $this->deleter->rows('users', 'id', [$user->id]);
        $paths = $this->deleter->delete('users', $rows, [], self::FILES)['files'];
        $now = Timestamp::database($this->clock->now());
        foreach ($paths as $path) {
            $this->pending->queue(null, $path, $now);
        }

        return $paths;
    }
}
