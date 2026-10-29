<?php

declare(strict_types=1);

namespace Planner\Http\Controller;

use Planner\Application\Account\AccountValidator;
use Planner\Application\Account\AuthService;
use Planner\Application\Account\EmailVerificationService;
use Planner\Http\GuestLocale;
use Planner\Http\Request;
use Planner\Http\Response;
use Planner\Http\ValidationException;
use Planner\Http\View\ViewRenderer;
use Planner\Infrastructure\Mail\PasswordResetMailer;
use Planner\Infrastructure\Persistence\Pdo\Account\PdoAccountRepository;
use Planner\Infrastructure\Session\SessionManager;

final readonly class EmailController
{
    public function __construct(
        private AuthService $auth,
        private EmailVerificationService $emails,
        private AccountValidator $validator,
        private PdoAccountRepository $accounts,
        private PasswordResetMailer $mailer,
        private ViewRenderer $views,
        private SessionManager $session,
    ) {
    }

    /** GET /verify-email?token= — the link from the verification message. */
    public function verify(Request $request): Response
    {
        try {
            $this->emails->verify($this->token($request));

            return $this->result($request, 'Email verified', 'Your email address is confirmed. Thank you!', true);
        } catch (ValidationException $error) {
            return $this->result($request, 'Link not valid', (string) array_values($error->errors)[0][0], false, 422);
        }
    }

    /** GET /confirm-email?token= — the link sent to a new address. */
    public function confirmChange(Request $request): Response
    {
        try {
            $this->emails->confirmChange($this->token($request));

            return $this->result($request, 'Email changed', 'Your account now uses this email address to sign in.', true);
        } catch (ValidationException $error) {
            return $this->result($request, 'Link not valid', (string) array_values($error->errors)[0][0], false, 422);
        }
    }

    /** POST /api/v1/email/verification */
    public function resend(Request $request): Response
    {
        $user = $this->auth->requireUser();
        $this->emails->sendVerification($user->id);

        return Response::json(['data' => ['sent' => true, 'delivered' => $this->mailer->delivers()]]);
    }

    /** GET /api/v1/email */
    public function status(Request $request): Response
    {
        $user = $this->auth->requireUser();

        return Response::json(['data' => [
            'email' => $user->email,
            'verified' => $user->emailVerifiedAt !== null,
            'pending_email' => $this->emails->pendingChange($user->id),
            'delivered' => $this->mailer->delivers(),
        ]]);
    }

    /** POST /api/v1/email/change {current_password, email} */
    public function change(Request $request): Response
    {
        $user = $this->auth->requireUser();
        $input = $this->validator->emailChange($request->input());
        $this->emails->requestChange($user->id, $input['current_password'], $input['email']);

        return Response::json(['data' => ['pending_email' => $input['email'], 'delivered' => $this->mailer->delivers()]], 202);
    }

    private function token(Request $request): string
    {
        $token = $request->query['token'] ?? '';

        return is_string($token) ? $token : '';
    }

    private function result(Request $request, string $title, string $message, bool $success, int $status = 200): Response
    {
        $signedIn = $this->auth->currentUser();
        $locale = $signedIn === null
            ? GuestLocale::resolve($request, $this->session)
            : (string) $this->accounts->preferences($signedIn->id)['locale'];

        return Response::html($this->views->render('auth/email-result', [
            'title' => $title,
            'message' => $message,
            'success' => $success,
            'signed_in' => $signedIn !== null,
            'locale' => $locale,
            'csrf_token' => $this->session->csrfToken(),
        ], 'layouts/guest'), $status)->withHeaders(['Referrer-Policy' => 'no-referrer']);
    }
}
