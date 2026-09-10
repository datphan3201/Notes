<?php

use App\Http\Controllers\Api\AttachmentController as ApiAttachmentController;
use App\Http\Controllers\Api\LabelController as ApiLabelController;
use App\Http\Controllers\Api\NoteController as ApiNoteController;
use App\Http\Controllers\Api\PasswordController as ApiPasswordController;
use App\Http\Controllers\Api\PreferenceController as ApiPreferenceController;
use App\Http\Controllers\Api\ProfileController as ApiProfileController;
use App\Http\Controllers\Api\SessionController as ApiSessionController;
use App\Http\Controllers\AttachmentContentController;
use App\Http\Controllers\Auth\RegisteredUserController;
use App\Http\Controllers\Auth\SessionController;
use App\Http\Controllers\AvatarContentController;
use App\Http\Controllers\NotesPageController;
use App\Http\Controllers\SettingsPageController;
use Illuminate\Support\Facades\Route;

Route::middleware('guest')->group(function (): void {
    Route::get('/login', [SessionController::class, 'create'])->name('login');
    Route::post('/login', [SessionController::class, 'store'])->name('login.store');
    Route::get('/register', [RegisteredUserController::class, 'create'])->name('register');
    Route::post('/register', [RegisteredUserController::class, 'store'])->name('register.store');
});

Route::middleware(['auth', 'auth.session'])->group(function (): void {
    Route::get('/', [NotesPageController::class, 'index'])->name('notes.index');
    Route::post('/logout', [SessionController::class, 'destroy'])->name('logout');

    Route::get('/settings/profile', [SettingsPageController::class, 'profile'])->name('settings.profile');
    Route::get('/settings/preferences', [SettingsPageController::class, 'preferences'])->name('settings.preferences');
    Route::get('/settings/password', [SettingsPageController::class, 'password'])->name('settings.password');

    Route::prefix('api/v1')->group(function (): void {
        Route::get('/session', [ApiSessionController::class, 'show'])->name('api.session');
        Route::get('/notes', [ApiNoteController::class, 'index'])->name('api.notes.index');
        Route::post('/notes', [ApiNoteController::class, 'store'])->name('api.notes.store');
        Route::get('/notes/{note}', [ApiNoteController::class, 'show'])->name('api.notes.show');
        Route::patch('/notes/{note}', [ApiNoteController::class, 'update'])->name('api.notes.update');
        Route::delete('/notes/{note}', [ApiNoteController::class, 'destroy'])->name('api.notes.destroy');

        Route::get('/labels', [ApiLabelController::class, 'index'])->name('api.labels.index');
        Route::post('/labels', [ApiLabelController::class, 'store'])->name('api.labels.store');
        Route::patch('/labels/{label}', [ApiLabelController::class, 'update'])->name('api.labels.update');
        Route::delete('/labels/{label}', [ApiLabelController::class, 'destroy'])->name('api.labels.destroy');

        Route::get('/profile', [ApiProfileController::class, 'show'])->name('api.profile.show');
        Route::patch('/profile', [ApiProfileController::class, 'update'])->name('api.profile.update');
        Route::get('/preferences', [ApiPreferenceController::class, 'show'])->name('api.preferences.show');
        Route::patch('/preferences', [ApiPreferenceController::class, 'update'])->name('api.preferences.update');
        Route::post('/password', [ApiPasswordController::class, 'update'])->name('api.password.update');
        Route::get('/notes/{note}/attachments', [ApiAttachmentController::class, 'index'])->name('api.attachments.index');
        Route::post('/notes/{note}/attachments', [ApiAttachmentController::class, 'store'])->name('api.attachments.store');
        Route::delete('/notes/{note}/attachments/{attachment}', [ApiAttachmentController::class, 'destroy'])->name('api.attachments.destroy');
        Route::post('/profile/avatar', [ApiProfileController::class, 'avatar'])->name('api.profile.avatar');
        Route::delete('/profile/avatar', [ApiProfileController::class, 'removeAvatar'])->name('api.profile.avatar.remove');

    });

    Route::match(['GET', 'HEAD'], '/files/attachments/{attachment}/preview', [AttachmentContentController::class, 'preview'])->name('files.attachment.preview');
    Route::match(['GET', 'HEAD'], '/files/attachments/{attachment}/download', [AttachmentContentController::class, 'download'])->name('files.attachment.download');
    Route::match(['GET', 'HEAD'], '/files/avatar', [AvatarContentController::class, 'show'])->name('files.avatar');
});
