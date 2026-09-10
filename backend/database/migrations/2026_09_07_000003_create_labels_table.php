<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('labels', function (Blueprint $table): void {
            $table->id();
            $table->unsignedBigInteger('user_id');
            $table->string('name', 40)->charset('utf8mb4')->collation('utf8mb4_0900_as_ci');
            $table->unsignedInteger('version')->default(1);
            $table->dateTime('created_at', 6);
            $table->dateTime('updated_at', 6);

            $table->foreign('user_id')->references('id')->on('users')->cascadeOnDelete();
            $table->unique(['user_id', 'name'], 'labels_owner_name_unique');
            $table->index(['user_id', 'name', 'id'], 'labels_owner_name_index');
        });

        DB::statement('ALTER TABLE labels ADD CONSTRAINT labels_version_check CHECK (version >= 1)');
    }

    public function down(): void
    {
        Schema::dropIfExists('labels');
    }
};
