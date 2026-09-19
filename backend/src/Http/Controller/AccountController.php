<?php

declare(strict_types=1);

namespace Planner\Http\Controller;

use Planner\Application\Account\AccountSerializer;
use Planner\Application\Account\AccountService;
use Planner\Application\Account\AccountValidator;
use Planner\Application\Account\AuthService;
use Planner\Http\Request;
use Planner\Http\Response;
use Planner\Http\ValidationException;
use Planner\Http\View\ViewRenderer;
use Planner\Infrastructure\Persistence\Pdo\Account\PdoAccountRepository;
use Planner\Infrastructure\Session\SessionManager;

final readonly class AccountController
{
    public function __construct(
        private AuthService $auth,
        private AccountService $accounts,
        private AccountValidator $validator,
        private AccountSerializer $serializer,
        private PdoAccountRepository $repository,
        private SessionManager $session,
        private ViewRenderer $views,
    ) {}

    public function loginPage(Request $request): Response
    {
        if ($this->auth->currentUser() !== null) {
            return Response::redirect('/');
        }

        return Response::html($this->renderAuth('auth/login', 'Sign in'));
    }

    public function login(Request $request): Response
    {
        try {
            $credentials = $this->validator->login($request->input());

            if (! $this->auth->attempt($credentials['email'], $credentials['password'], $request->clientIp())) {
                throw new ValidationException(['email' => ['The email or password is incorrect.']]);
            }
        } catch (ValidationException $exception) {
            $this->session->flash('errors', $exception->errors);
            $this->session->flash('old', [
                'email' => is_string($request->form['email'] ?? null) ? $request->form['email'] : '',
            ]);

            return Response::redirect('/login');
        }

        return Response::redirect('/');
    }

    public function registerPage(Request $request): Response
    {
        if ($this->auth->currentUser() !== null) {
            return Response::redirect('/');
        }

        return Response::html($this->renderAuth('auth/register', 'Create account'));
    }

    public function register(Request $request): Response
    {
        try {
            $input = $this->validator->registration($request->input());
            $this->auth->register($input['email'], $input['display_name'], $input['password']);
        } catch (ValidationException $exception) {
            $this->session->flash('errors', $exception->errors);
            $this->session->flash('old', [
                'display_name' => is_string($request->form['display_name'] ?? null) ? $request->form['display_name'] : '',
                'email' => is_string($request->form['email'] ?? null) ? $request->form['email'] : '',
            ]);

            return Response::redirect('/register');
        }

        return Response::redirect('/');
    }

    public function logout(Request $request): Response
    {
        $this->auth->logout();

        return Response::redirect('/login');
    }

    public function session(Request $request): Response
    {
        $user = $this->auth->requireUser();

        return Response::json(['data' => [
            'user' => $this->serializer->user($user),
            'preferences' => $this->repository->preferences($user->id),
            'csrf_token' => $this->session->csrfToken(),
        ]]);
    }

    public function profile(Request $request): Response
    {
        return Response::json(['data' => $this->serializer->user($this->auth->requireUser())]);
    }

    public function updateProfile(Request $request): Response
    {
        $user = $this->auth->requireUser();
        $displayName = $this->validator->profile($request->input());
        $updated = $this->accounts->updateDisplayName($user->id, $displayName);

        return Response::json(['data' => $this->serializer->user($updated)]);
    }

    public function preferences(Request $request): Response
    {
        $user = $this->auth->requireUser();

        return Response::json(['data' => $this->accounts->preferences($user->id)]);
    }

    public function updatePreferences(Request $request): Response
    {
        $user = $this->auth->requireUser();
        $changes = $this->validator->preferences($request->input());

        return Response::json(['data' => $this->accounts->updatePreferences($user->id, $changes)]);
    }

    public function changePassword(Request $request): Response
    {
        $user = $this->auth->requireUser();
        $input = $this->validator->passwordChange($request->input());
        $this->auth->changePassword($user, $input['current_password'], $input['password']);

        return Response::json(['data' => ['redirect_to' => '/login']]);
    }

    public function notesShell(Request $request): Response
    {
        return Response::html($this->renderApplicationPage('notes/index', 'Notes', 'notes.index'));
    }

    public function settingsPage(Request $request): Response
    {
        $page = match ($request->path) {
            '/settings/profile' => ['settings/profile', 'Profile', 'settings.profile'],
            '/settings/preferences' => ['settings/preferences', 'Appearance', 'settings.preferences'],
            '/settings/password' => ['settings/password', 'Change password', 'settings.password'],
            default => throw new \LogicException('Unexpected settings route.'),
        };

        return Response::html($this->renderApplicationPage(...$page));
    }

    public function planningPage(Request $request): Response
    {
        [$template, $title, $route] = match (true) {
            $request->path === '/goals' => ['planning/goals', 'Goals', 'planning.goals'],
            str_starts_with($request->path, '/goals/') => ['planning/goal', 'Goal details', 'planning.goals'],
            $request->path === '/tasks' => ['planning/tasks', 'Tasks', 'planning.tasks'],
            str_starts_with($request->path, '/tasks/') => ['planning/task', 'Task details', 'planning.tasks'],
            $request->path === '/habits' => ['planning/habits', 'Habits', 'planning.habits'],
            $request->path === '/dashboard' => ['planning/dashboard', 'Dashboard', 'planning.dashboard'],
            $request->path === '/reviews' => ['planning/reviews', 'Reviews', 'planning.reviews'],
            $request->path === '/ai' => ['planning/ai', 'AI assistant', 'planning.ai'],
            default => throw new \LogicException('Unexpected planning page route.'),
        };
        $extra = [];

        if (str_starts_with($request->path, '/goals/')) {
            $extra['goal_id'] = rawurldecode(substr($request->path, strlen('/goals/')));
        }
        if (str_starts_with($request->path, '/tasks/')) {
            $extra['task_id'] = rawurldecode(substr($request->path, strlen('/tasks/')));
        }

        return Response::html($this->renderApplicationPage($template, $title, $route, $extra));
    }

    private function renderAuth(string $template, string $title): string
    {
        $errors = $this->session->pullFlash('errors', []);
        $old = $this->session->pullFlash('old', []);

        return $this->views->render($template, [
            'title' => $title,
            'csrf_token' => $this->session->csrfToken(),
            'errors' => is_array($errors) ? $errors : [],
            'old' => is_array($old) ? $old : [],
        ], 'layouts/guest');
    }

    /** @param array<string, mixed> $extra */
    private function renderApplicationPage(string $template, string $title, string $route, array $extra = []): string
    {
        $user = $this->serializer->user($this->auth->requireUser());
        $preferences = $this->repository->preferences((int) $user['id']);
        $csrf = $this->session->csrfToken();
        $bootstrapPreferences = [
            'theme' => $preferences['theme'],
            'note_font_size' => $preferences['note_font_size'],
            'default_note_color' => $preferences['default_note_color'],
            'notes_view' => $preferences['notes_view'],
        ];

        return $this->views->render($template, [
            'title' => $title,
            'user' => $user,
            'preferences' => $preferences,
            'csrf_token' => $csrf,
            'current_route' => $route,
            'bootstrap' => [
                'user' => $user,
                'preferences' => $bootstrapPreferences,
                'csrf_token' => $csrf,
            ],
            ...$extra,
        ], 'layouts/app');
    }
}
