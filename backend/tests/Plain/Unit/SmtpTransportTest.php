<?php

declare(strict_types=1);

namespace Tests\Plain\Unit;

use PHPUnit\Framework\TestCase;
use Planner\Infrastructure\Mail\PasswordResetMailer;
use Planner\Infrastructure\Mail\SmtpTransport;
use RuntimeException;

final class SmtpTransportTest extends TestCase
{
    /** @var resource|null */
    private $process = null;
    private string $directory;

    protected function setUp(): void
    {
        $this->directory = sys_get_temp_dir().'/planner-smtp-'.bin2hex(random_bytes(6));
        mkdir($this->directory, 0700, true);
    }

    protected function tearDown(): void
    {
        if (is_resource($this->process)) {
            proc_terminate($this->process);
            proc_close($this->process);
        }
        array_map('unlink', glob($this->directory.'/*') ?: []);
        rmdir($this->directory);
    }

    public function test_mailer_sends_an_encoded_utf8_message_through_authenticated_smtp(): void
    {
        $port = $this->startServer('accept');
        $mailer = new PasswordResetMailer('local', $this->directory, 'planner@example.test',
            new SmtpTransport('127.0.0.1', $port, 'none', 'mailer', 's3cret', 'planner.test', 5), 'Planner');

        $mailer->sendMessage('owner@example.test', 'Nhắc việc: Đọc sách', "Xin chào!\n.leading dot line\nhttps://planner.test/tasks/1\n");
        $transcript = $this->transcript();

        self::assertStringContainsString("EHLO planner.test\r\n", $transcript);
        self::assertStringContainsString('AUTH PLAIN '.base64_encode("\0mailer\0s3cret")."\r\n", $transcript);
        self::assertStringContainsString("MAIL FROM:<planner@example.test>\r\n", $transcript);
        self::assertStringContainsString("RCPT TO:<owner@example.test>\r\n", $transcript);
        self::assertStringContainsString('Subject: =?UTF-8?B?', $transcript);
        self::assertStringContainsString("Content-Transfer-Encoding: base64\r\n", $transcript);
        self::assertStringEndsWith("QUIT\r\n", $transcript);
        $body = explode("\r\n\r\n", $transcript, 2)[1];
        $encoded = trim(substr($body, 0, (int) strpos($body, "\r\n.\r\n")));
        self::assertSame("Xin chào!\n.leading dot line\nhttps://planner.test/tasks/1\n", base64_decode(str_replace("\r\n", '', $encoded), true));
        self::assertTrue($mailer->delivers());
    }

    public function test_transport_dot_stuffs_lines_and_reports_a_rejected_login(): void
    {
        $port = $this->startServer('accept');
        (new SmtpTransport('127.0.0.1', $port, 'none', null, null, 'planner.test', 5))
            ->send('from@example.test', ['to@example.test'], "Subject: Plain\r\n\r\n.starts with a dot\r\nend");
        $transcript = $this->transcript();
        self::assertStringNotContainsString('AUTH', $transcript);
        self::assertStringContainsString("\r\n..starts with a dot\r\nend\r\n.\r\n", $transcript);

        $port = $this->startServer('reject-auth');
        $this->expectException(RuntimeException::class);
        $this->expectExceptionMessage('Authentication failed');
        (new SmtpTransport('127.0.0.1', $port, 'none', 'mailer', 'wrong', 'planner.test', 5))
            ->send('from@example.test', ['to@example.test'], 'Subject: x');
    }

    public function test_without_smtp_local_mail_is_kept_in_the_private_outbox(): void
    {
        $mailer = new PasswordResetMailer('local', $this->directory, '');
        $mailer->sendMessage('owner@example.test', 'Xác nhận email', "Link: https://planner.test/verify-email?token=abc\n");
        $files = glob($this->directory.'/mail-outbox/*.eml') ?: [];
        self::assertCount(1, $files);
        $message = (string) file_get_contents($files[0]);
        self::assertStringContainsString('To: <owner@example.test>', $message);
        self::assertStringContainsString('https://planner.test/verify-email?token=abc', $message);
        self::assertFalse($mailer->delivers());
        array_map('unlink', $files);
        rmdir($this->directory.'/mail-outbox');
    }

    private function startServer(string $mode): int
    {
        if (is_resource($this->process)) {
            proc_close($this->process);
        }
        $portFile = $this->directory.'/port';
        @unlink($portFile);
        $this->process = proc_open(
            [PHP_BINARY, dirname(__DIR__).'/Fixtures/fake-smtp-server.php', $portFile, $this->directory.'/transcript', $mode],
            [0 => ['pipe', 'r'], 1 => ['pipe', 'w'], 2 => ['pipe', 'w']],
            $pipes,
        );
        for ($attempt = 0; $attempt < 100 && (!is_file($portFile) || filesize($portFile) === 0); $attempt++) {
            usleep(50_000);
        }
        $port = (int) file_get_contents($portFile);
        self::assertGreaterThan(0, $port, 'The fake SMTP server did not start.');

        return $port;
    }

    private function transcript(): string
    {
        // The server closes its log after QUIT; wait for the process to finish.
        for ($attempt = 0; $attempt < 100 && proc_get_status($this->process)['running']; $attempt++) {
            usleep(50_000);
        }

        return (string) file_get_contents($this->directory.'/transcript');
    }
}
