<?php

declare(strict_types=1);

namespace Planner\Http\Controller;

use Planner\Application\Account\AccountValidator;
use Planner\Application\Account\PasswordResetService;
use Planner\Http\Request;
use Planner\Http\Response;
use Planner\Http\ValidationException;
use Planner\Http\View\ViewRenderer;
use Planner\Infrastructure\Session\SessionManager;

final readonly class PasswordResetController
{
    public function __construct(private PasswordResetService $resets, private AccountValidator $validator, private ViewRenderer $views, private SessionManager $session)
    {
    }

    public function page(Request $request): Response
    {
        $reset = $request->path === '/reset-password';
        return Response::html($this->views->render('auth/recovery', [
            'title' => $reset ? 'Reset password' : 'Forgot password',
            'reset' => $reset,
            'email' => is_string($request->query['email'] ?? null) ? $request->query['email'] : '',
            'token' => is_string($request->query['token'] ?? null) ? $request->query['token'] : '',
            'csrf_token' => $this->session->csrfToken(),
            'errors' => $this->session->pullFlash('errors', []),
            'notice' => $this->session->pullFlash('notice', ''),
            'locale' => \Planner\Http\GuestLocale::resolve($request, $this->session),
        // same-origin keeps the reset token out of other sites' Referer while the
        // form's own POST still carries its Origin; no-referrer made browsers send
        // "Origin: null", which the CSRF guard rejects with 419.
        ], 'layouts/guest'))->withHeaders(['Referrer-Policy' => 'same-origin']);
    }

    public function request(Request $request): Response
    {
        try {
            $email = $this->validator->recoveryEmail($request->input());
            $this->resets->request($email, $request->clientIp());
            $this->session->flash('notice', 'If that account exists, a password reset link has been sent. Check your inbox.');
        } catch (ValidationException $error) {
            $this->session->flash('errors', $error->errors);
        }
        return Response::redirect('/forgot-password');
    }

    public function reset(Request $request): Response
    {
        $input = $request->input();
        try {
            $values = $this->validator->passwordReset($input);
            $this->resets->reset($values['email'], $values['token'], $values['password'], $request->clientIp());
        } catch (ValidationException $error) {
            $this->session->flash('errors', $error->errors);
            return Response::redirect('/reset-password?'.http_build_query([
                'email' => is_string($input['email'] ?? null) ? $input['email'] : '',
                'token' => is_string($input['token'] ?? null) ? $input['token'] : '',
            ]));
        }
        $this->session->invalidate();
        return Response::redirect('/login');
    }
}
