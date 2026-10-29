<?php

declare(strict_types=1);

namespace Planner\Infrastructure\Mail;

use Planner\Application\Account\MessageDelivery;
use Planner\Application\Account\PasswordResetDelivery;
use RuntimeException;

/**
 * The application's single mailer. With SMTP configured every message goes
 * through it, in any environment. Otherwise production uses the system mail
 * transport and other environments keep messages in a private local outbox.
 */
final readonly class PasswordResetMailer implements PasswordResetDelivery, MessageDelivery
{
    public function __construct(
        private string $environment,
        private string $privateRoot,
        private string $from,
        private ?SmtpTransport $smtp = null,
        private string $fromName = 'Planner',
    ) {
    }

    public function send(string $email, string $url): void
    {
        $body = "Reset your Planner password using this link within 30 minutes:\n\n".$url."\n\nIf you did not request this, ignore this message.\n";
        $this->sendMessage($email, 'Reset your Planner password', $body);
    }

    /** Whether messages leave this machine (SMTP, or the system transport in production). */
    public function delivers(): bool
    {
        return $this->smtp !== null || $this->environment === 'production';
    }

    public function sendMessage(string $email, string $subject, string $body): void
    {
        if (strpbrk($this->from.$email.$this->fromName.$subject, "\r\n") !== false) {
            throw new RuntimeException('Mail headers cannot contain line breaks.');
        }
        if ($this->smtp !== null) {
            $this->requireSender();
            $this->smtp->send($this->from, [$email], $this->compose($email, $subject, $body, true));

            return;
        }
        if ($this->environment === 'production') {
            $this->requireSender();
            $headers = [
                'From' => $this->address($this->from, $this->fromName),
                'MIME-Version' => '1.0',
                'Content-Type' => 'text/plain; charset=UTF-8',
                'Content-Transfer-Encoding' => 'base64',
            ];
            if (!mail($email, $this->header($subject), chunk_split(base64_encode($body), 76, "\r\n"), $headers)) {
                throw new RuntimeException('Mail delivery failed.');
            }

            return;
        }

        $directory = $this->privateRoot.'/mail-outbox';
        if (is_link($directory) || is_link($this->privateRoot)) {
            throw new RuntimeException('The local mail outbox is not private.');
        }
        if (!is_dir($directory) && !mkdir($directory, 0700, true) && !is_dir($directory)) {
            throw new RuntimeException('The local mail outbox is unavailable.');
        }
        $path = $directory.'/'.gmdate('Ymd-His').'-'.bin2hex(random_bytes(8)).'.eml';
        $handle = fopen($path, 'x');
        if ($handle === false) {
            throw new RuntimeException('The local mail outbox is unavailable.');
        }
        try {
            chmod($path, 0600);
            // Unencoded body keeps local links readable in any text editor.
            $message = $this->compose($email, $subject, $body, false);
            if (fwrite($handle, $message) !== strlen($message)) {
                throw new RuntimeException('Mail delivery failed.');
            }
        } finally {
            fclose($handle);
        }
    }

    private function compose(string $to, string $subject, string $body, bool $base64): string
    {
        $domain = substr((string) strrchr($this->from !== '' ? $this->from : 'planner@localhost', '@'), 1) ?: 'localhost';
        $headers = [
            'Date: '.gmdate('D, d M Y H:i:s').' +0000',
            'From: '.$this->address($this->from !== '' ? $this->from : 'planner@localhost', $this->fromName),
            'To: <'.$to.'>',
            'Subject: '.$this->header($subject),
            'Message-ID: <'.bin2hex(random_bytes(16)).'@'.$domain.'>',
            'MIME-Version: 1.0',
            'Content-Type: text/plain; charset=UTF-8',
            'Content-Transfer-Encoding: '.($base64 ? 'base64' : '8bit'),
        ];
        $content = $base64 ? rtrim(chunk_split(base64_encode($body), 76, "\r\n")) : str_replace("\n", "\r\n", $body);

        return implode("\r\n", $headers)."\r\n\r\n".$content."\r\n";
    }

    private function header(string $text): string
    {
        return preg_match('/[^\x20-\x7E]/', $text) === 1 ? mb_encode_mimeheader($text, 'UTF-8', 'B', "\r\n ") : $text;
    }

    private function address(string $email, string $name): string
    {
        return $name === '' ? '<'.$email.'>' : $this->header($name).' <'.$email.'>';
    }

    private function requireSender(): void
    {
        if (filter_var($this->from, FILTER_VALIDATE_EMAIL) === false) {
            throw new RuntimeException('MAIL_FROM_ADDRESS must be a valid email address to send mail.');
        }
    }
}
