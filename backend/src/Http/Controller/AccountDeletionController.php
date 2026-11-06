<?php

declare(strict_types=1);

namespace Planner\Http\Controller;

use Planner\Application\Account\AccountDeletionService;
use Planner\Application\Account\AuthService;
use Planner\Http\Request;
use Planner\Http\Response;
use Planner\Http\Validation\InputValidator;

/** Deleting an account for good: your own (Settings › Security) or another one (Administration). */
final readonly class AccountDeletionController
{
    public function __construct(
        private AuthService $auth,
        private AccountDeletionService $deletion,
        private InputValidator $input,
    ) {
    }

    public function own(Request $request): Response
    {
        $user = $this->auth->requireUser();
        $input = $request->input();
        $this->input->rejectUnknown($input, ['password']);
        $this->deletion->deleteOwn($user, $input);
        // The account and its sessions are gone; end this browser's session too.
        $this->auth->logout();

        return Response::json(['data' => ['deleted' => true, 'redirect' => '/login']]);
    }

    /** @param array<string, string> $parameters */
    public function admin(Request $request, array $parameters): Response
    {
        $admin = $this->auth->requireAdmin();
        $input = $request->input();
        $this->input->rejectUnknown($input, ['confirm_email']);
        if (! ctype_digit($parameters['id'] ?? '')) {
            $this->input->throwIfErrors(['user' => ['The account is invalid.']]);
        }

        return Response::json(['data' => $this->deletion->deleteByAdmin($admin->id, (int) $parameters['id'], $input)]);
    }
}
