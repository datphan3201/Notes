<?php

namespace Tests\Feature;

use App\Models\Label;
use App\Models\Note;
use App\Models\User;
use Illuminate\Support\Str;
use Tests\TestCase;

class NotesTest extends TestCase
{
    public function test_note_create_replay_update_conflict_literal_search_and_tombstone(): void
    {
        $user = User::factory()->create(['email' => 'owner@example.test']);
        $id = (string) Str::uuid();
        $payload = [
            'id' => $id,
            'title' => '  Cơ sở dữ liệu  ',
            'content' => "Dòng một\r\n  <b>%literal</b>",
            'color' => 'sky',
        ];

        $created = $this->actingAs($user)->postJson('/api/v1/notes', $payload)
            ->assertCreated()
            ->assertJsonPath('data.id', $id)
            ->assertJsonPath('data.title', 'Cơ sở dữ liệu')
            ->assertJsonPath('data.content', "Dòng một\n  <b>%literal</b>");

        $created->assertJsonPath('data.version', 1);
        $this->actingAs($user)->postJson('/api/v1/notes', $payload)
            ->assertOk()->assertJsonPath('meta.replayed', true);

        $label = $this->actingAs($user)->postJson('/api/v1/labels', ['name' => 'Công việc'])
            ->assertCreated()->json('data');
        $labelId = (string) $label['id'];

        $this->actingAs($user)->patchJson('/api/v1/notes/'.$id, [
            'base_version' => 1,
            'title' => 'Cơ sở dữ liệu',
            'content' => "Dòng một\n  <b>%literal</b>",
            'color' => 'mint',
            'is_pinned' => true,
            'label_ids' => [$labelId],
        ])->assertOk()->assertJsonPath('data.version', 2)->assertJsonPath('data.is_pinned', true);

        $this->actingAs($user)->patchJson('/api/v1/notes/'.$id, [
            'base_version' => 1,
            'title' => 'Bản khác',
            'content' => 'Không được ghi đè',
            'color' => 'rose',
            'is_pinned' => false,
            'label_ids' => [],
        ])->assertStatus(409)->assertJsonPath('code', 'NOTE_CONFLICT')->assertJsonPath('current.version', 2);

        // A stale retry containing the already-committed complete snapshot is
        // acknowledged as a no-op instead of creating a false conflict.
        $this->actingAs($user)->patchJson('/api/v1/notes/'.$id, [
            'base_version' => 1,
            'title' => 'Cơ sở dữ liệu',
            'content' => "Dòng một\n  <b>%literal</b>",
            'color' => 'mint',
            'is_pinned' => true,
            'label_ids' => [$labelId],
        ])->assertOk()->assertJsonPath('data.version', 2);

        $this->actingAs($user)->getJson('/api/v1/notes?q=%25')
            ->assertOk()->assertJsonPath('data.0.id', $id);
        $this->actingAs($user)->getJson('/api/v1/notes?label_ids[]='.$labelId.'&label_ids[]=999999')
            ->assertStatus(422);

        $this->actingAs($user)->deleteJson('/api/v1/notes/'.$id, ['base_version' => 2])->assertNoContent();
        self::assertNotNull(Note::whereKey($id)->firstOrFail()->deleted_at);
        $this->actingAs($user)->getJson('/api/v1/notes/'.$id)
            ->assertStatus(410)->assertJsonPath('code', 'NOTE_DELETED');
    }

    public function test_label_filter_is_any_and_notes_are_owner_scoped(): void
    {
        $owner = User::factory()->create(['email' => 'owner@example.test']);
        $other = User::factory()->create(['email' => 'other@example.test']);
        $first = Label::create(['user_id' => $owner->id, 'name' => 'Một', 'version' => 1, 'created_at' => now(), 'updated_at' => now()]);
        $second = Label::create(['user_id' => $owner->id, 'name' => 'Hai', 'version' => 1, 'created_at' => now(), 'updated_at' => now()]);
        $id = (string) Str::uuid();

        $this->actingAs($owner)->postJson('/api/v1/notes', [
            'id' => $id, 'title' => 'Có một nhãn', 'content' => 'Nội dung', 'color' => 'neutral',
        ])->assertCreated();
        $this->actingAs($owner)->patchJson('/api/v1/notes/'.$id, [
            'base_version' => 1, 'title' => 'Có một nhãn', 'content' => 'Nội dung', 'color' => 'neutral',
            'is_pinned' => false, 'label_ids' => [(string) $first->id],
        ])->assertOk();

        $this->actingAs($owner)->getJson('/api/v1/notes?label_ids[]='.$first->id.'&label_ids[]='.$second->id)
            ->assertOk()->assertJsonPath('data.0.id', $id);
        $this->actingAs($other)->getJson('/api/v1/notes/'.$id)->assertNotFound();
    }
}
