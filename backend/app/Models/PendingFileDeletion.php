<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;

class PendingFileDeletion extends Model
{
    protected $fillable = ['path', 'attempts'];

    protected function casts(): array
    {
        return ['attempts' => 'integer'];
    }
}
