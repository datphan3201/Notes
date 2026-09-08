<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('label_note', function (Blueprint $table): void {
            $table->char('note_id', 36)->charset('ascii')->collation('ascii_bin');
            $table->unsignedBigInteger('label_id');
            $table->primary(['note_id', 'label_id']);
            $table->foreign('note_id')->references('id')->on('notes')->cascadeOnDelete();
            $table->foreign('label_id')->references('id')->on('labels')->cascadeOnDelete();
            $table->index(['label_id', 'note_id'], 'label_note_label_index');
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('label_note');
    }
};
