<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Foundation\Auth\User as Authenticatable;
use Illuminate\Notifications\Notifiable;

class User extends Authenticatable
{
    use HasFactory, Notifiable;

    protected $fillable = ['email', 'display_name', 'password'];

    protected $hidden = ['password', 'remember_token', 'avatar_path'];

    protected function casts(): array
    {
        return ['email_verified_at' => 'datetime'];
    }

    public function preferences()
    {
        return $this->hasOne(UserPreference::class);
    }

    public function notes()
    {
        return $this->hasMany(Note::class);
    }

    public function labels()
    {
        return $this->hasMany(Label::class);
    }
}
