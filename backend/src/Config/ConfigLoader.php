<?php

declare(strict_types=1);

namespace Planner\Config;

use DateTimeZone;
use Dotenv\Dotenv;
use InvalidArgumentException;

final class ConfigLoader
{
    /** @param array<string, string> $overrides */
    public function load(string $basePath, array $overrides = []): Config
    {
        $requestedEnvironment = $overrides['APP_ENV'] ?? $_ENV['APP_ENV'] ?? getenv('APP_ENV') ?: 'local';
        $environmentFile = $requestedEnvironment === 'testing' && is_file($basePath.'/.env.testing')
            ? '.env.testing'
            : '.env';

        if (is_file($basePath.'/'.$environmentFile)) {
            Dotenv::createImmutable($basePath, $environmentFile)->safeLoad();
        }

        $env = static function (string $name, ?string $default = null) use ($overrides): ?string {
            if (array_key_exists($name, $overrides)) {
                return $overrides[$name];
            }

            $value = $_ENV[$name] ?? getenv($name);

            return $value === false ? $default : (string) $value;
        };

        $required = static function (string $name) use ($env): string {
            $value = $env($name);

            if ($value === null || trim($value) === '') {
                throw new InvalidArgumentException("Missing required environment value [$name].");
            }

            return $value;
        };

        $boolean = static function (string $name, bool $default) use ($env): bool {
            $raw = $env($name, $default ? 'true' : 'false');
            $value = filter_var($raw, FILTER_VALIDATE_BOOL, FILTER_NULL_ON_FAILURE);

            if ($value === null) {
                throw new InvalidArgumentException("Environment value [$name] must be boolean.");
            }

            return $value;
        };

        $environment = $env('APP_ENV', 'local') ?? 'local';
        $debug = $boolean('APP_DEBUG', false);
        $secureCookie = $boolean('SESSION_SECURE_COOKIE', false);

        if (! in_array($environment, ['local', 'testing', 'production'], true)) {
            throw new InvalidArgumentException('APP_ENV must be local, testing, or production.');
        }

        if ($environment === 'production' && ($debug || ! $secureCookie)) {
            throw new InvalidArgumentException('Production requires debug off and secure session cookies.');
        }

        $database = $required('PLANNER_DB_DATABASE');
        $allowedDatabases = array_values(array_filter(array_map(
            'trim',
            explode(',', $env('PLANNER_DB_ALLOWED', 'goals_dev,goals_test') ?? ''),
        ), static fn (string $value): bool => $value !== ''));

        if (! in_array($database, $allowedDatabases, true)) {
            throw new InvalidArgumentException('PLANNER_DB_DATABASE is not in PLANNER_DB_ALLOWED.');
        }

        if (! in_array($env('PLANNER_DB_CHARSET', 'utf8mb4'), ['utf8mb4'], true)
            || ! in_array($env('PLANNER_DB_COLLATION', 'utf8mb4_0900_ai_ci'), ['utf8mb4_0900_ai_ci'], true)) {
            throw new InvalidArgumentException('Unsupported target database charset or collation.');
        }

        $timezone = $env('APP_TIMEZONE', 'UTC') ?? 'UTC';

        if (! in_array($timezone, DateTimeZone::listIdentifiers(), true) && $timezone !== 'UTC') {
            throw new InvalidArgumentException('APP_TIMEZONE must be a valid IANA timezone.');
        }

        $base = realpath($basePath);

        if ($base === false) {
            throw new InvalidArgumentException('Application base path does not exist.');
        }

        $storageRoot = $env('PRIVATE_STORAGE_ROOT', $base.'/storage/app/private') ?? '';
        $storageRoot = self::normalizeAbsolutePath(str_starts_with($storageRoot, '/') ? $storageRoot : $base.'/'.$storageRoot);
        $publicRoot = self::normalizeAbsolutePath($base.'/public');

        if ($storageRoot === $publicRoot || str_starts_with($storageRoot.'/', $publicRoot.'/')) {
            throw new InvalidArgumentException('Private storage must be outside the public document root.');
        }

        $port = filter_var($env('PLANNER_DB_PORT', $env('DB_PORT', '3306')), FILTER_VALIDATE_INT);
        $sessionLifetime = filter_var($env('SESSION_LIFETIME', '120'), FILTER_VALIDATE_INT);

        if ($port === false || $port < 1 || $port > 65535 || $sessionLifetime === false || $sessionLifetime < 1) {
            throw new InvalidArgumentException('Database port and session lifetime must be positive integers.');
        }

        $aiEnabled = $boolean('AI_ENABLED', false);
        $aiProvider = $env('AI_PROVIDER', 'google') ?? 'google';
        $aiModel = $env('AI_MODEL', 'gemini-2.5-flash-lite') ?? '';
        $aiKey = $env('GOOGLE_AI_API_KEY');
        if (! in_array($aiProvider, ['google'], true)) {
            throw new InvalidArgumentException('AI_PROVIDER must be google.');
        }
        if ($aiEnabled && ($aiModel === '' || $aiKey === null || trim($aiKey) === '')) {
            throw new InvalidArgumentException('Enabled AI requires AI_MODEL and GOOGLE_AI_API_KEY.');
        }
        $databaseUser = $env('PLANNER_DB_USERNAME');
        if ($databaseUser === null || trim($databaseUser) === '') {
            $databaseUser = $required('DB_USERNAME');
        }

        return new Config([
            'app' => [
                'env' => $environment,
                'debug' => $debug,
                'url' => rtrim($env('APP_URL', 'http://localhost:8000') ?? '', '/'),
                'timezone' => $timezone,
                'base_path' => $base,
            ],
            'database' => [
                'host' => $env('PLANNER_DB_HOST', $env('DB_HOST', '127.0.0.1')) ?? '127.0.0.1',
                'port' => $port,
                'name' => $database,
                'user' => $databaseUser,
                'password' => $env('PLANNER_DB_PASSWORD', $env('DB_PASSWORD', '')) ?? '',
                'charset' => $env('PLANNER_DB_CHARSET', 'utf8mb4') ?? 'utf8mb4',
                'collation' => $env('PLANNER_DB_COLLATION', 'utf8mb4_0900_ai_ci') ?? 'utf8mb4_0900_ai_ci',
                'allowed' => $allowedDatabases,
            ],
            'session' => [
                'key' => $env('SESSION_ENCRYPTION_KEY'),
                'lifetime' => $sessionLifetime,
                'secure' => $secureCookie,
            ],
            'storage' => ['private_root' => $storageRoot],
            'logging' => [
                'path' => $env('LOG_PATH', $base.'/storage/logs/planner.log') ?? '',
                'level' => $env('LOG_LEVEL', 'debug') ?? 'debug',
            ],
            'vite' => ['dev_url' => $env('VITE_DEV_URL')],
            'ai' => [
                'enabled' => $aiEnabled,
                'provider' => $aiProvider,
                'model' => $aiModel,
                'key' => $aiKey,
            ],
        ]);
    }

    private static function normalizeAbsolutePath(string $path): string
    {
        if (! str_starts_with($path, '/')) {
            throw new InvalidArgumentException('Configured path must be absolute after resolution.');
        }

        $segments = [];

        foreach (explode('/', str_replace('\\', '/', $path)) as $segment) {
            if ($segment === '' || $segment === '.') {
                continue;
            }

            if ($segment === '..') {
                array_pop($segments);

                continue;
            }

            $segments[] = $segment;
        }

        return '/'.implode('/', $segments);
    }
}
