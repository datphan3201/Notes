<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;

class UserPreference extends Model
{
    protected $table = 'user_preferences';

    public $incrementing = false;

    protected $primaryKey = 'user_id';

    protected $fillable = [
        'user_id',
        'theme',
        'note_font_size',
        'default_note_color',
        'notes_view',
    ];

    protected function casts(): array
    {
        return ['note_font_size' => 'integer'];
    }

    public function user()
    {
        return $this->belongsTo(User::class);
    }
}
