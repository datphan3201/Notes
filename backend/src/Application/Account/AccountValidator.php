<?php

declare(strict_types=1);

namespace Planner\Application\Account;

use Egulias\EmailValidator\EmailValidator;
use Egulias\EmailValidator\Validation\RFCValidation;
use Planner\Http\Validation\InputValidator;
use Planner\Http\ValidationException;
use Planner\Domain\Notes\NoteSnapshot;
use Planner\Support\TextNormalizer;
use Planner\Support\TimeZoneNames;

final readonly class AccountValidator
{
    public function __construct(
        private InputValidator $inputValidator,
        private EmailValidator $emailValidator,
    ) {
    }

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
        $this->inputValidator->rejectUnknown($input, ['display_name', 'biography']);
        $displayName = TextNormalizer::displayName(is_string($input['display_name'] ?? null) ? $input['display_name'] : '');
        $errors = [];
        $this->validateDisplayName($displayName, $errors, 'The display name is invalid.');
        $this->inputValidator->throwIfErrors($errors);

        return $displayName;
    }

    /** @param array<string, mixed> $input @return array<string, string|int|bool> */
    public function preferences(array $input): array
    {
        $this->inputValidator->rejectUnknown($input, [
            'theme', 'note_font_size', 'default_note_color', 'notes_view', 'timezone',
            'visual_theme', 'show_background', 'show_illustrations', 'show_quote', 'custom_quote', 'background_color', 'background_id', 'notifications_enabled', 'email_notifications', 'locale',
            'history_completed_hours', 'history_overdue_days', 'history_retention_days',
        ]);

        if ($input === []) {
            throw new ValidationException(['_empty' => ['Select at least one preference.']]);
        }

        $rules = [
            'locale' => ['en', 'vi'],
            'theme' => ['light', 'dark'],
            'note_font_size' => [14, 16, 18],
            'notes_view' => ['grid', 'list'],
            'visual_theme' => ['mountain', 'forest', 'ocean', 'pisces', 'stars'],
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

        foreach (['show_background', 'show_illustrations', 'show_quote', 'notifications_enabled', 'email_notifications'] as $field) {
            if (array_key_exists($field, $input)) {
                if (! is_bool($input[$field])) {
                    $errors[$field][] = 'The value must be boolean.';
                } else {
                    $changes[$field] = $input[$field];
                }
            }
        }

        if (array_key_exists('default_note_color', $input)) {
            $color = NoteSnapshot::normalizeColor($input['default_note_color']);
            if ($color === null) {
                $errors['default_note_color'][] = 'The value is invalid.';
            } else {
                $changes['default_note_color'] = $color;
            }
        }

        foreach (['history_completed_hours' => [1, 720], 'history_overdue_days' => [1, 365]] as $field => [$min, $max]) {
            if (array_key_exists($field, $input)) {
                if (! is_int($input[$field]) || $input[$field] < $min || $input[$field] > $max) {
                    $errors[$field][] = "Enter a whole number from $min to $max.";
                } else {
                    $changes[$field] = $input[$field];
                }
            }
        }

        if (array_key_exists('history_retention_days', $input)) {
            $value = $input['history_retention_days'];
            if ($value !== null && (! is_int($value) || $value < 1 || $value > 3650)) {
                $errors['history_retention_days'][] = 'Enter a whole number from 1 to 3650, or keep history.';
            } else {
                $changes['history_retention_days'] = $value;
            }
        }

        if (array_key_exists('background_color', $input)) {
            if (!is_string($input['background_color']) || ($input['background_color'] !== '' && preg_match('/^#[a-fA-F0-9]{6}$/D', $input['background_color']) !== 1)) {
                $errors['background_color'][] = 'Choose a valid RGB color.';
            } else {
                $changes['background_color'] = $input['background_color'];
            }
        }

        if (array_key_exists('background_id', $input)) {
            // '' shows the preset theme; AccountService checks ownership.
            if (! is_string($input['background_id']) || ($input['background_id'] !== '' && preg_match('/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/D', $input['background_id']) !== 1)) {
                $errors['background_id'][] = 'Choose one of your backgrounds.';
            } else {
                $changes['background_id'] = $input['background_id'] === '' ? null : $input['background_id'];
            }
        }

        if (array_key_exists('custom_quote', $input)) {
            if (! is_string($input['custom_quote'])) {
                $errors['custom_quote'][] = 'The quote must be plain text.';
            } else {
                $quote = TextNormalizer::body($input['custom_quote']);
                if (TextNormalizer::codePoints($quote) > 500) {
                    $errors['custom_quote'][] = 'The quote may contain at most 500 characters.';
                } else {
                    $changes['custom_quote'] = $quote;
                }
            }
        }

        if (array_key_exists('timezone', $input)) {
            $timezone = is_string($input['timezone']) ? TimeZoneNames::canonical($input['timezone']) : null;

            if ($timezone === null) {
                $errors['timezone'][] = 'The time zone is invalid.';
            } else {
                $changes['timezone'] = $timezone;
            }
        }

        $this->inputValidator->throwIfErrors($errors);

        return $changes;
    }

    /** @param array<string, mixed> $input */
    public function walkthroughDismissal(array $input): void
    {
        $this->inputValidator->rejectUnknown($input, []);
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

    /** @param array<string, mixed> $input @return array{current_password: string, email: string} */
    public function emailChange(array $input): array
    {
        $this->inputValidator->rejectUnknown($input, ['current_password', 'email']);
        $email = TextNormalizer::email(is_string($input['email'] ?? null) ? $input['email'] : '');
        $password = is_string($input['current_password'] ?? null) ? $input['current_password'] : '';
        $errors = [];
        if ($password === '') {
            $errors['current_password'][] = 'The current password is required.';
        }
        $this->validateEmail($email, $errors);
        $this->inputValidator->throwIfErrors($errors);

        return ['current_password' => $password, 'email' => $email];
    }

    public function biography(mixed $value): string
    {
        if (!is_string($value) || TextNormalizer::codePoints($value) > 2000 || TextNormalizer::hasForbiddenBodyControl($value)) {
            throw new ValidationException(['biography' => ['Biography must be plain text with at most 2,000 characters.']]);
        }
        return TextNormalizer::body($value);
    }

    /** @param array<string, mixed> $input */
    public function recoveryEmail(array $input): string
    {
        $this->inputValidator->rejectUnknown($input, ['_token', 'email']);
        $email = TextNormalizer::email(is_string($input['email'] ?? null) ? $input['email'] : '');
        $errors = [];
        $this->validateEmail($email, $errors);
        $this->inputValidator->throwIfErrors($errors);
        return $email;
    }

    /** @param array<string, mixed> $input @return array{email:string,token:string,password:string} */
    public function passwordReset(array $input): array
    {
        $this->inputValidator->rejectUnknown($input, ['_token', 'email', 'token', 'password', 'password_confirmation']);
        $email = $this->recoveryEmail(['email' => $input['email'] ?? null]);
        $password = is_string($input['password'] ?? null) ? $input['password'] : '';
        $token = is_string($input['token'] ?? null) ? $input['token'] : '';
        $errors = [];
        $this->validatePassword($password, $errors);
        if ($password !== ($input['password_confirmation'] ?? null)) {
            $errors['password_confirmation'][] = 'The password confirmation does not match.';
        }
        if (preg_match('/^[a-f0-9]{64}$/D', $token) !== 1) {
            $errors['token'][] = 'This reset link is invalid or has expired. Request a new link.';
        }
        $this->inputValidator->throwIfErrors($errors);
        return ['email' => $email, 'token' => $token, 'password' => $password];
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
