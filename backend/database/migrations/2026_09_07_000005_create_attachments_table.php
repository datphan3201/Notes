<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('attachments', function (Blueprint $table): void {
            $table->char('id', 36)->charset('ascii')->collation('ascii_bin')->primary();
            $table->char('note_id', 36)->charset('ascii')->collation('ascii_bin');
            $table->string('original_name', 255);
            $table->string('path', 255)->nullable();
            $table->string('mime_type', 127);
            $table->string('kind', 8);
            $table->unsignedBigInteger('size_bytes')->default(0);
            $table->char('sha256', 64)->charset('ascii')->collation('ascii_bin')->nullable();
            $table->dateTime('deleted_at', 6)->nullable();
            $table->dateTime('created_at', 6);
            $table->dateTime('updated_at', 6);

            $table->foreign('note_id')->references('id')->on('notes')->cascadeOnDelete();
            $table->unique('path', 'attachments_path_unique');
            $table->index(['note_id', 'deleted_at', 'created_at', 'id'], 'attachments_note_index');
        });

        DB::statement("ALTER TABLE attachments
            ADD CONSTRAINT attachments_kind_check CHECK (kind IN ('image', 'video', 'file'))");
    }

    public function down(): void
    {
        Schema::dropIfExists('attachments');
    }
};
