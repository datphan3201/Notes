<?php

namespace Tests\Feature;

use App\Models\Note;
use App\Models\User;
use Illuminate\Http\UploadedFile;
use Illuminate\Support\Facades\Storage;
use Illuminate\Support\Str;
use Tests\TestCase;

class FilesTest extends TestCase
{
    public function test_text_attachment_replay_private_serving_and_tombstone(): void
    {
        Storage::fake('private');
        $user = User::factory()->create(['email' => 'owner@example.test']);
        $noteId = (string) Str::uuid();
        $attachmentId = (string) Str::uuid();
        $this->actingAs($user)->postJson('/api/v1/notes', [
            'id' => $noteId, 'title' => 'Tệp', 'content' => 'Nội dung', 'color' => 'neutral',
        ])->assertCreated();

        $file = UploadedFile::fake()->createWithContent('readme.txt', "Xin chào\n");
        $response = $this->actingAs($user)->post('/api/v1/notes/'.$noteId.'/attachments', [
            'id' => $attachmentId,
            'file' => $file,
        ]);
        $response->assertCreated()->assertJsonPath('data.original_name', 'readme.txt');
        $path = Note::whereKey($noteId)->firstOrFail()->attachments()->firstOrFail()->path;
        Storage::disk('private')->assertExists($path);

        $this->actingAs($user)->post('/api/v1/notes/'.$noteId.'/attachments', [
            'id' => $attachmentId,
            'file' => UploadedFile::fake()->createWithContent('readme.txt', "Xin chào\n"),
        ])->assertOk()->assertJsonPath('meta.replayed', true);

        $this->actingAs($user)->get('/files/attachments/'.$attachmentId.'/download')
            ->assertOk()->assertHeader('X-Content-Type-Options', 'nosniff');
        $other = User::factory()->create(['email' => 'other@example.test']);
        $this->actingAs($other)->get('/files/attachments/'.$attachmentId.'/download')->assertNotFound();

        $this->actingAs($user)->deleteJson('/api/v1/notes/'.$noteId.'/attachments/'.$attachmentId)->assertNoContent();
        $this->actingAs($user)->get('/files/attachments/'.$attachmentId.'/download')->assertNotFound();
    }

    public function test_html_renamed_as_text_is_rejected_and_avatar_is_reencoded(): void
    {
        Storage::fake('private');
        $user = User::factory()->create(['email' => 'owner@example.test']);
        $noteId = (string) Str::uuid();
        $this->actingAs($user)->postJson('/api/v1/notes', [
            'id' => $noteId, 'title' => 'Tệp', 'content' => 'Nội dung', 'color' => 'neutral',
        ])->assertCreated();

        $this->actingAs($user)->post('/api/v1/notes/'.$noteId.'/attachments', [
            'id' => (string) Str::uuid(),
            'file' => UploadedFile::fake()->createWithContent('fake.txt', '<!doctype html><script>alert(1)</script>'),
        ])->assertStatus(422)->assertJsonPath('code', 'VALIDATION_FAILED');

        // A tiny real PNG exercises dimensions, GD decoding and private output.
        $png = base64_decode('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNk+A8AAQUBAScY42YAAAAASUVORK5CYII=', true);
        $avatar = $this->actingAs($user)->post('/api/v1/profile/avatar', [
            'avatar' => UploadedFile::fake()->createWithContent('avatar.png', $png),
        ]);
        $avatar->assertOk()->assertJsonPath('data.avatar_url', route('files.avatar'));
        $this->actingAs($user->fresh())->get('/files/avatar')->assertOk()->assertHeader('Content-Type', 'image/jpeg');
        $this->actingAs($user->fresh())->deleteJson('/api/v1/profile/avatar')->assertNoContent();
    }
}
