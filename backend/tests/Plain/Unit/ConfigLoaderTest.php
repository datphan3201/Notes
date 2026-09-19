<?php

declare(strict_types=1);

namespace Tests\Plain\Unit;

use InvalidArgumentException;
use PHPUnit\Framework\TestCase;
use Planner\Config\ConfigLoader;

final class ConfigLoaderTest extends TestCase
{
    /** @return array<string, string> */
    private function validEnvironment(): array
    {
        return [
            'APP_ENV' => 'testing',
            'APP_DEBUG' => 'false',
            'APP_URL' => 'http://localhost:8000',
            'PLANNER_DB_DATABASE' => 'goals_test',
            'PLANNER_DB_ALLOWED' => 'goals_test',
            'PLANNER_DB_USERNAME' => 'test_user',
            'PLANNER_DB_PASSWORD' => 'test_password',
            'DB_USERNAME' => '',
            'SESSION_SECURE_COOKIE' => 'false',
            'PRIVATE_STORAGE_ROOT' => sys_get_temp_dir().'/planner-private-test',
            'AI_ENABLED' => 'false',
        ];
    }

    public function test_loads_typed_configuration_from_valid_environment(): void
    {
        $config = (new ConfigLoader)->load(dirname(__DIR__, 3), $this->validEnvironment());

        self::assertSame('testing', $config->string('app.env'));
        self::assertSame('goals_test', $config->string('database.name'));
        self::assertSame(['goals_test'], $config->stringList('database.allowed'));
        self::assertFalse($config->bool('session.secure'));
    }

    public function test_rejects_database_outside_allowlist(): void
    {
        $environment = $this->validEnvironment();
        $environment['PLANNER_DB_DATABASE'] = 'notes_test';

        $this->expectException(InvalidArgumentException::class);
        $this->expectExceptionMessage('not in PLANNER_DB_ALLOWED');

        (new ConfigLoader)->load(dirname(__DIR__, 3), $environment);
    }

    public function test_rejects_insecure_production_configuration(): void
    {
        $environment = $this->validEnvironment();
        $environment['APP_ENV'] = 'production';

        $this->expectException(InvalidArgumentException::class);
        $this->expectExceptionMessage('Production requires');

        (new ConfigLoader)->load(dirname(__DIR__, 3), $environment);
    }

    public function test_rejects_private_storage_below_public_root(): void
    {
        $environment = $this->validEnvironment();
        $environment['PRIVATE_STORAGE_ROOT'] = dirname(__DIR__, 3).'/public/private';

        $this->expectException(InvalidArgumentException::class);
        $this->expectExceptionMessage('outside the public');

        (new ConfigLoader)->load(dirname(__DIR__, 3), $environment);
    }

    public function test_rejects_private_storage_path_that_lexically_resolves_below_public_root(): void
    {
        $environment = $this->validEnvironment();
        $environment['PRIVATE_STORAGE_ROOT'] = dirname(__DIR__, 3).'/storage/../public/private';

        $this->expectException(InvalidArgumentException::class);
        $this->expectExceptionMessage('outside the public');

        (new ConfigLoader)->load(dirname(__DIR__, 3), $environment);
    }
}
