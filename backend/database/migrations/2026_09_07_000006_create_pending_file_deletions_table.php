<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('pending_file_deletions', function (Blueprint $table): void {
            $table->id();
            $table->string('path', 255)->unique();
            $table->unsignedInteger('attempts')->default(0);
            $table->dateTime('created_at', 6);
            $table->dateTime('updated_at', 6);
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('pending_file_deletions');
    }
};
