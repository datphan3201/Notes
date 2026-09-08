<?php

namespace Tests;

use Illuminate\Foundation\Testing\TestCase as BaseTestCase;
use Illuminate\Support\Facades\DB;
use RuntimeException;

abstract class TestCase extends BaseTestCase
{
    protected function setUp(): void
    {
        parent::setUp();

        // A wrong database here is dangerous: the feature suite truncates all
        // application tables, so fail before cleanup rather than “helpfully”
        // running against a developer database or an SQLite substitute.
        $database = (string) (DB::selectOne('SELECT DATABASE() AS database_name')->database_name ?? '');
        if (app()->environment() !== 'testing' || config('database.default') !== 'mysql' || $database !== 'notes_test') {
            throw new RuntimeException('Feature tests require APP_ENV=testing and MySQL database notes_test.');
        }

        $this->clearTestData();
    }

    private function clearTestData(): void
    {
        DB::statement('SET FOREIGN_KEY_CHECKS=0');
        foreach (['pending_file_deletions', 'attachments', 'label_note', 'notes', 'labels', 'user_preferences', 'sessions', 'users'] as $table) {
            DB::table($table)->delete();
        }
        DB::statement('SET FOREIGN_KEY_CHECKS=1');
    }
}
