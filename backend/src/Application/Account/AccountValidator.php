<?php

declare(strict_types=1);

namespace Planner\Application\Account;

use DateTimeZone;
use Egulias\EmailValidator\EmailValidator;
use Egulias\EmailValidator\Validation\RFCValidation;
use Planner\Http\Validation\InputValidator;
use Planner\Http\ValidationException;
use Planner\Support\TextNormalizer;

final readonly class AccountValidator
{
    public function __construct(
        private InputValidator $inputValidator,
        private EmailValidator $emailValidator,
    ) {}

    /** @param array<string, mixed> $input @return array{email: string, display_name: string, password: string} */
    public function registration(array $input): array
    {
        $this->inputValidator->rejectUnknown($input, [
            '_token', 'email', 'display_name', 'password', 'password_confirmation',
        ]);
        $email = TextNormalizer::email(is_string($input['email'] ?? null) ? $input['email'] : '');
        $displayName = TextNormalizer::displayName(is_string($input['display_name'] ?? null) ? $input['display_name'] : '');
        $password = is_string($input['password'] ?? null) ? $input['password'] : '';
        $confirmation = is_string($input['password_confirmation'] ?? null) ? $input['password_confirmation'] : '';
        $errors = [];

        $this->validateEmail($email, $errors);
        $this->validateDisplayName($displayName, $errors);
        $this->validatePassword($password, $errors);

        if ($password !== $confirmation) {
            $errors['password_confirmation'][] = 'The password confirmation does not match.';
        }

        $this->inputValidator->throwIfErrors($errors);

        return ['email' => $email, 'display_name' => $displayName, 'password' => $password];
    }

    /** @param array<string, mixed> $input @return array{email: string, password: string} */
    public function login(array $input): array
    {
        $this->inputValidator->rejectUnknown($input, ['_token', 'email', 'password']);
        $email = TextNormalizer::email(is_string($input['email'] ?? null) ? $input['email'] : '');
        $password = is_string($input['password'] ?? null) ? $input['password'] : '';

        if ($email === '' || strlen($email) > 254 || preg_match('/^[\x00-\x7F]+$/D', $email) !== 1
            || ! $this->emailValidator->isValid($email, new RFCValidation) || $password === '') {
            throw new ValidationException(['email' => ['The email or password is incorrect.']]);
        }

        return ['email' => $email, 'password' => $password];
    }

    /** @param array<string, mixed> $input */
    public function profile(array $input): string
    {
        $this->inputValidator->rejectUnknown($input, ['display_name']);
        $displayName = TextNormalizer::displayName(is_string($input['display_name'] ?? null) ? $input['display_name'] : '');
        $errors = [];
        $this->validateDisplayName($displayName, $errors, 'The display name is invalid.');
        $this->inputValidator->throwIfErrors($errors);

        return $displayName;
    }

    /** @param array<string, mixed> $input @return array<string, string|int> */
    public function preferences(array $input): array
    {
        $this->inputValidator->rejectUnknown($input, [
            'theme', 'note_font_size', 'default_note_color', 'notes_view', 'timezone',
        ]);

        if ($input === []) {
            throw new ValidationException(['_empty' => ['Select at least one preference.']]);
        }

        $rules = [
            'theme' => ['light', 'dark'],
            'note_font_size' => [14, 16, 18],
            'default_note_color' => ['neutral', 'lemon', 'mint', 'sky', 'rose'],
            'notes_view' => ['grid', 'list'],
        ];
        $errors = [];
        $changes = [];

        foreach ($rules as $field => $allowed) {
            if (array_key_exists($field, $input)) {
                if (! in_array($input[$field], $allowed, true)) {
                    $errors[$field][] = 'The value is invalid.';
                } else {
                    $changes[$field] = $input[$field];
                }
            }
        }

        if (array_key_exists('timezone', $input)) {
            $timezone = is_string($input['timezone']) ? $input['timezone'] : '';

            if (! in_array($timezone, DateTimeZone::listIdentifiers(), true) && $timezone !== 'UTC') {
                $errors['timezone'][] = 'The time zone is invalid.';
            } else {
                $changes['timezone'] = $timezone;
            }
        }

        $this->inputValidator->throwIfErrors($errors);

        return $changes;
    }

    /** @param array<string, mixed> $input @return array{current_password: string, password: string} */
    public function passwordChange(array $input): array
    {
        $this->inputValidator->rejectUnknown($input, [
            '_token', 'current_password', 'password', 'password_confirmation',
        ]);
        $current = is_string($input['current_password'] ?? null) ? $input['current_password'] : '';
        $password = is_string($input['password'] ?? null) ? $input['password'] : '';
        $confirmation = is_string($input['password_confirmation'] ?? null) ? $input['password_confirmation'] : '';
        $errors = [];

        if ($current === '') {
            $errors['current_password'][] = 'The current password is required.';
        }

        $this->validatePassword($password, $errors);

        if ($password !== $confirmation) {
            $errors['password_confirmation'][] = 'The password confirmation does not match.';
        }

        $this->inputValidator->throwIfErrors($errors);

        return ['current_password' => $current, 'password' => $password];
    }

    /** @param array<string, list<string>> $errors */
    private function validateEmail(string $email, array &$errors): void
    {
        if ($email === '' || strlen($email) > 254 || ! $this->emailValidator->isValid($email, new RFCValidation)) {
            $errors['email'][] = 'The email address is invalid.';
        } elseif (preg_match('/^[\x00-\x7F]+$/D', $email) !== 1) {
            $errors['email'][] = 'The email address may contain ASCII characters only.';
        }
    }

    /** @param array<string, list<string>> $errors */
    private function validateDisplayName(string $name, array &$errors, string $message = 'The display name cannot be empty.'): void
    {
        if (TextNormalizer::codePoints($name) < 1 || TextNormalizer::codePoints($name) > 80
            || TextNormalizer::hasForbiddenIdentityControl($name)) {
            $errors['display_name'][] = $message;
        }
    }

    /** @param array<string, list<string>> $errors */
    private function validatePassword(string $password, array &$errors): void
    {
        if (str_contains($password, "\0")) {
            $errors['password'][] = 'The password cannot contain a NUL character.';
        } elseif (TextNormalizer::codePoints($password) < 10) {
            $errors['password'][] = 'The password must contain at least 10 characters.';
        } elseif (strlen($password) > 72) {
            $errors['password'][] = 'The password cannot exceed 72 bytes.';
        }
    }
}
