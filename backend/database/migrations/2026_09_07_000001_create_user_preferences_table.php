<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('user_preferences', function (Blueprint $table): void {
            $table->unsignedBigInteger('user_id')->primary();
            $table->string('theme', 8)->default('light');
            $table->unsignedTinyInteger('note_font_size')->default(16);
            $table->string('default_note_color', 16)->default('neutral');
            $table->string('notes_view', 8)->default('grid');
            $table->dateTime('created_at', 6);
            $table->dateTime('updated_at', 6);

            $table->foreign('user_id')->references('id')->on('users')->cascadeOnDelete();
        });

        DB::statement("ALTER TABLE user_preferences
            ADD CONSTRAINT user_preferences_theme_check CHECK (theme IN ('light', 'dark')),
            ADD CONSTRAINT user_preferences_font_size_check CHECK (note_font_size IN (14, 16, 18)),
            ADD CONSTRAINT user_preferences_color_check CHECK (default_note_color IN ('neutral', 'lemon', 'mint', 'sky', 'rose')),
            ADD CONSTRAINT user_preferences_view_check CHECK (notes_view IN ('grid', 'list'))");
    }

    public function down(): void
    {
        Schema::dropIfExists('user_preferences');
    }
};
