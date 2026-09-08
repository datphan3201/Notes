<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;

class Attachment extends Model
{
    public $incrementing = false;

    protected $keyType = 'string';

    protected $fillable = [
        'id',
        'note_id',
        'original_name',
        'path',
        'mime_type',
        'kind',
        'size_bytes',
        'sha256',
        'deleted_at',
    ];

    protected $hidden = ['path', 'sha256'];

    protected function casts(): array
    {
        return [
            'size_bytes' => 'integer',
            'deleted_at' => 'datetime',
        ];
    }

    public function note()
    {
        return $this->belongsTo(Note::class);
    }

    public function scopeActive($query)
    {
        return $query->whereNull('deleted_at');
    }
}
