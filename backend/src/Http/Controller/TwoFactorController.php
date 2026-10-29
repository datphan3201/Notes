<?php

declare(strict_types=1);

namespace Planner\Http\Controller;

use Planner\Application\Account\AuthService;
use Planner\Application\Account\TwoFactorService;
use Planner\Http\Request;
use Planner\Http\Response;
use Planner\Http\Validation\InputValidator;
use Planner\Http\ValidationException;
use Planner\Http\View\ViewRenderer;
use Planner\Infrastructure\Session\SessionManager;

final readonly class TwoFactorController
{
    public function __construct(
        private AuthService $auth,
        private TwoFactorService $twoFactor,
        private InputValidator $input,
        private SessionManager $session,
        private ViewRenderer $views,
    ) {
    }

    public function page(Request $request): Response
    {
        $user = $this->auth->pendingTwoFactorUser();
        if ($user === null) {
            return Response::redirect('/login');
        }
        if ($user->twoFactorMethod === 'email' && $this->session->get('two_factor_sent') !== $user->id) {
            $this->twoFactor->sendEmailCode($user);
            $this->session->put('two_factor_sent', $user->id);
        }
        $errors = $this->session->pullFlash('errors', []);
        $status = $this->session->pullFlash('status');

        return Response::html($this->views->render('auth/two-factor', [
            'title' => 'Verification',
            'csrf_token' => $this->session->csrfToken(),
            'errors' => is_array($errors) ? $errors : [],
            'old' => [],
            'method' => $user->twoFactorMethod,
            'status' => is_string($status) ? $status : null,
            'locale' => \Planner\Http\GuestLocale::resolve($request, $this->session),
        ], 'layouts/guest'));
    }

    public function verify(Request $request): Response
    {
        $user = $this->auth->pendingTwoFactorUser();
        if ($user === null) {
            return Response::redirect('/login');
        }
        $code = is_string($request->form['code'] ?? null) ? $request->form['code'] : '';
        if (! $this->twoFactor->verify($user, $code)) {
            $this->session->flash('errors', ['code' => ['The code is incorrect or has expired.']]);

            return Response::redirect('/two-factor');
        }
        $this->session->forget('two_factor_sent');
        $this->auth->completeTwoFactor($user);

        return Response::redirect('/dashboard');
    }

    /** Email fallback for authenticator users, or a resend for email users. */
    public function sendEmail(Request $request): Response
    {
        $user = $this->auth->pendingTwoFactorUser();
        if ($user === null) {
            return Response::redirect('/login');
        }
        $this->twoFactor->sendEmailCode($user);
        $this->session->put('two_factor_sent', $user->id);
        $this->session->flash('status', 'We sent a new code to your email address.');

        return Response::redirect('/two-factor');
    }

    public function status(Request $request): Response
    {
        return Response::json(['data' => ['method' => $this->auth->requireUser()->twoFactorMethod]]);
    }

    public function beginTotp(Request $request): Response
    {
        $this->input->rejectUnknown($request->input(), []);

        return Response::json(['data' => $this->twoFactor->beginTotpSetup($this->auth->requireUser())]);
    }

    public function confirmTotp(Request $request): Response
    {
        $this->twoFactor->confirmTotp($this->auth->requireUser(), $this->code($request->input()));

        return Response::json(['data' => ['method' => 'totp']]);
    }

    public function sendSetupEmail(Request $request): Response
    {
        $this->input->rejectUnknown($request->input(), []);
        $this->twoFactor->sendEmailCode($this->auth->requireUser());

        return Response::json(['data' => ['sent' => true]]);
    }

    public function confirmEmail(Request $request): Response
    {
        $this->twoFactor->confirmEmail($this->auth->requireUser(), $this->code($request->input()));

        return Response::json(['data' => ['method' => 'email']]);
    }

    public function disable(Request $request): Response
    {
        $input = $request->input();
        $this->input->rejectUnknown($input, ['password']);
        $this->twoFactor->disable($this->auth->requireUser(), is_string($input['password'] ?? null) ? $input['password'] : '');

        return Response::json(['data' => ['method' => null]]);
    }

    /** @param array<string, mixed> $input */
    private function code(array $input): string
    {
        $this->input->rejectUnknown($input, ['code']);
        if (! is_string($input['code'] ?? null) || $input['code'] === '') {
            throw new ValidationException(['code' => ['Enter the six-digit code.']]);
        }

        return $input['code'];
    }
}
