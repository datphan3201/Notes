<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;

class Label extends Model
{
    protected $fillable = ['user_id', 'name', 'version'];

    protected function casts(): array
    {
        return ['version' => 'integer'];
    }

    public function user()
    {
        return $this->belongsTo(User::class);
    }

    public function notes()
    {
        return $this->belongsToMany(Note::class, 'label_note');
    }
}
