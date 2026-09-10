<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('notes', function (Blueprint $table): void {
            $table->char('id', 36)->charset('ascii')->collation('ascii_bin')->primary();
            $table->unsignedBigInteger('user_id');
            $table->string('title', 200);
            $table->mediumText('content');
            $table->string('color', 16)->default('neutral');
            $table->dateTime('pinned_at', 6)->nullable();
            $table->unsignedInteger('version')->default(1);
            $table->dateTime('deleted_at', 6)->nullable();
            $table->dateTime('created_at', 6);
            $table->dateTime('updated_at', 6);

            $table->foreign('user_id')->references('id')->on('users')->cascadeOnDelete();
            $table->index(['user_id', 'deleted_at', 'pinned_at', 'updated_at', 'id'], 'notes_owner_order_index');
            $table->index(['user_id', 'deleted_at', 'updated_at', 'id'], 'notes_owner_updated_index');
        });

        DB::statement("ALTER TABLE notes
            ADD CONSTRAINT notes_version_check CHECK (version >= 1),
            ADD CONSTRAINT notes_color_check CHECK (color IN ('neutral', 'lemon', 'mint', 'sky', 'rose'))");
    }

    public function down(): void
    {
        Schema::dropIfExists('notes');
    }
};
