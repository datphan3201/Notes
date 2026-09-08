<?php

namespace Tests\Feature;

use App\Models\User;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Hash;
use Tests\TestCase;

class AuthenticationTest extends TestCase
{
    public function test_registration_has_only_the_four_visible_account_fields_and_creates_preferences(): void
    {
        $page = $this->get('/register')->assertOk();
        preg_match_all('/<input\b(?![^>]*type=["\']hidden["\'])[^>]*>/i', $page->getContent(), $matches);
        self::assertCount(4, $matches[0]);
        $page->assertSee('name="display_name"', false)
            ->assertSee('name="email"', false)
            ->assertSee('name="password_confirmation"', false);

        $response = $this->post('/register', [
            'display_name' => 'Dat Nguyễn',
            'email' => 'owner@example.test',
            'password' => 'correct horse battery staple',
            'password_confirmation' => 'correct horse battery staple',
        ]);

        $response->assertRedirect('/');
        $this->assertAuthenticated();
        $user = User::where('email', 'owner@example.test')->firstOrFail();
        $this->assertDatabaseHas('user_preferences', ['user_id' => $user->id, 'theme' => 'light']);
        self::assertTrue(Hash::check('correct horse battery staple', $user->password));
    }

    public function test_api_session_requires_authentication_and_returns_contract_shape(): void
    {
        $this->getJson('/api/v1/session')
            ->assertUnauthorized()
            ->assertJsonPath('code', 'AUTH_REQUIRED');

        $user = User::factory()->create(['email' => 'a@example.test']);
        $this->actingAs($user)->getJson('/api/v1/session')
            ->assertOk()
            ->assertJsonStructure(['data' => ['user', 'preferences', 'csrf_token']]);
    }

    public function test_password_change_invalidates_database_sessions(): void
    {
        $user = User::factory()->create(['email' => 'a@example.test', 'password' => bcrypt('old password')]);
        $this->actingAs($user)->get('/');

        $response = $this->actingAs($user)->postJson('/api/v1/password', [
            'current_password' => 'old password',
            'password' => 'new password here',
            'password_confirmation' => 'new password here',
        ]);

        $response->assertOk()->assertJsonPath('data.redirect_to', route('login'));
        $this->assertGuest();
        self::assertTrue(Hash::check('new password here', $user->fresh()->password));
        self::assertSame(0, DB::table('sessions')->where('user_id', $user->id)->count());
    }
}
