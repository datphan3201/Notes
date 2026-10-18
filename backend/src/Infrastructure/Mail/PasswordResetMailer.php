<?php

declare(strict_types=1);

namespace Planner\Infrastructure\Mail;

use Planner\Application\Account\PasswordResetDelivery;
use RuntimeException;

final readonly class PasswordResetMailer implements PasswordResetDelivery
{
    public function __construct(private string $environment, private string $privateRoot, private string $from)
    {
    }

    public function send(string $email, string $url): void
    {
        $body = "Reset your Planner password using this link within 30 minutes:\n\n".$url."\n\nIf you did not request this, ignore this message.\n";
        $this->sendMessage($email, 'Reset your Planner password', $body);
    }

    public function sendMessage(string $email, string $subject, string $body): void
    {
        if ($this->environment === 'production') {
            if (filter_var($this->from, FILTER_VALIDATE_EMAIL) === false || strpbrk($this->from.$email, "\r\n") !== false) {
                throw new RuntimeException('Password recovery mail is not configured.');
            }
            if (!mail($email, $subject, $body, ['From' => $this->from, 'Content-Type' => 'text/plain; charset=UTF-8'])) {
                throw new RuntimeException('Password recovery delivery failed.');
            }
            return;
        }

        $directory = $this->privateRoot.'/mail-outbox';
        if (is_link($directory) || is_link($this->privateRoot)) {
            throw new RuntimeException('Password recovery outbox is not private.');
        }
        if (!is_dir($directory) && !mkdir($directory, 0700, true) && !is_dir($directory)) {
            throw new RuntimeException('Password recovery outbox is unavailable.');
        }
        $path = $directory.'/'.bin2hex(random_bytes(16)).'.eml';
        $handle = fopen($path, 'x');
        if ($handle === false) {
            throw new RuntimeException('Password recovery outbox is unavailable.');
        }
        try {
            chmod($path, 0600);
            $message = 'To: '.$email."\nSubject: ".$subject."\n\n".$body;
            if (fwrite($handle, $message) !== strlen($message)) {
                throw new RuntimeException('Password recovery delivery failed.');
            }
        } finally {
            fclose($handle);
        }
    }
}
